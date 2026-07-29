import os
import tempfile
from datetime import timedelta

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from dovahride.models import Ride, RideSyncState
from dovahride.services.igpsport import IGPSportClient, IGPSportError
from dovahride.services.importer import (
    find_existing_ride,
    import_ride_file,
    is_generated_ride_title,
    suggest_ride_title,
)
from dovahride.utils.extract import parse_ride_file


class Command(BaseCommand):
    help = "Download new iGPSPORT activities and import them into the Ride table."

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=int(os.environ.get("IGPSPORT_LOOKBACK_DAYS", "14")),
            help="How many recent calendar days to query (default: 14).",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            dest="full_sync",
            help="Query the complete activity history without a date filter.",
        )

    def handle(self, *args, **options):
        state, _ = RideSyncState.objects.get_or_create(pk=1)
        started_at = timezone.now()
        state.status = RideSyncState.Status.RUNNING
        state.heartbeat_at = started_at
        state.last_started_at = started_at
        state.last_message = "正在连接 iGPSPORT…"
        state.save(
            update_fields=[
                "status",
                "heartbeat_at",
                "last_started_at",
                "last_message",
                "updated_at",
            ]
        )

        try:
            self._run_sync(options, state)
        except Exception as exc:
            finished_at = timezone.now()
            RideSyncState.objects.filter(pk=state.pk).update(
                status=RideSyncState.Status.FAILED,
                heartbeat_at=finished_at,
                last_finished_at=finished_at,
                last_message=str(exc)[:500],
            )
            if isinstance(exc, CommandError):
                raise
            raise CommandError(str(exc)) from exc

    def _run_sync(self, options, state):
        username = os.environ.get("IGPSPORT_USERNAME")
        password = os.environ.get("IGPSPORT_PASSWORD")
        if not username or not password:
            raise CommandError(
                "Set IGPSPORT_USERNAME and IGPSPORT_PASSWORD in the environment."
            )

        if options["full_sync"]:
            begin_date = end_date = None
            scope_message = "Checking all available iGPSPORT activities."
        else:
            days = options["days"]
            if days < 1:
                raise CommandError("--days must be at least 1.")
            end_date = timezone.localdate()
            begin_date = end_date - timedelta(days=days - 1)
            scope_message = (
                f"Checking iGPSPORT activities from {begin_date} through {end_date}."
            )

        client = IGPSportClient(username, password)
        imported = skipped = linked = failed = 0

        self.stdout.write(scope_message)
        activities = client.list_activities(begin_date, end_date)
        for activity in activities:
            RideSyncState.objects.filter(pk=state.pk).update(
                heartbeat_at=timezone.now()
            )
            ride_id = str(activity.get("rideId") or "").strip()
            if not ride_id:
                failed += 1
                self.stderr.write("Skipping an activity with no rideId.")
                continue

            preferred_title = self._activity_title(activity)
            existing_ride = Ride.objects.filter(
                source=Ride.Source.IGPSPORT,
                external_id=ride_id,
            ).first()
            if existing_ride:
                if preferred_title and is_generated_ride_title(existing_ride.title):
                    existing_ride.title = suggest_ride_title(
                        existing_ride.start_time,
                        preferred_title,
                    )
                    existing_ride.save(update_fields=["title"])
                skipped += 1
                continue

            try:
                result = self._download_and_import(
                    client,
                    ride_id,
                    preferred_title=preferred_title,
                )
                if result == "linked":
                    linked += 1
                elif result == "imported":
                    imported += 1
                else:
                    skipped += 1
            except Exception as exc:
                failed += 1
                self.stderr.write(f"rideId {ride_id} failed: {exc}")

        summary = (
            f"{imported} imported, {linked} linked, "
            f"{skipped} already present, {failed} failed."
        )
        self.stdout.write(self.style.SUCCESS(f"iGPSPORT sync complete: {summary}"))

        finished_at = timezone.now()
        state.status = (
            RideSyncState.Status.FAILED
            if failed
            else RideSyncState.Status.SUCCESS
        )
        state.heartbeat_at = finished_at
        state.last_finished_at = finished_at
        state.last_message = summary
        state.last_imported = imported
        state.last_linked = linked
        state.last_skipped = skipped
        state.last_failed = failed
        if not failed:
            state.last_success_at = finished_at
        state.save(
            update_fields=[
                "status",
                "heartbeat_at",
                "last_finished_at",
                "last_message",
                "last_imported",
                "last_linked",
                "last_skipped",
                "last_failed",
                "last_success_at",
                "updated_at",
            ]
        )

        if failed:
            raise CommandError(f"{failed} iGPSPORT activities failed to synchronize.")

    @staticmethod
    def _activity_title(activity):
        for key in ("title", "activityName", "rideName", "routeName"):
            value = str(activity.get(key) or "").strip()
            if value:
                return value[:100]
        return None

    def _download_and_import(self, client, ride_id, *, preferred_title=None):
        download_url = client.get_download_url(ride_id)
        with tempfile.NamedTemporaryFile(suffix=".fit", delete=False) as temp_file:
            temp_path = temp_file.name

        try:
            client.download_to(download_url, temp_path)
            if os.path.getsize(temp_path) == 0:
                raise IGPSportError("Downloaded FIT file is empty.")

            parsed_data = parse_ride_file(temp_path)
            if not parsed_data or not parsed_data.get("points"):
                raise IGPSportError("Downloaded FIT file has no usable track points.")

            existing = find_existing_ride(parsed_data)
            if existing:
                existing.source = Ride.Source.IGPSPORT
                existing.external_id = ride_id
                update_fields = ["source", "external_id"]
                if preferred_title and is_generated_ride_title(existing.title):
                    existing.title = suggest_ride_title(
                        existing.start_time,
                        preferred_title,
                    )
                    update_fields.append("title")
                existing.save(update_fields=update_fields)
                return "linked"

            with open(temp_path, "rb") as raw_file:
                imported = import_ride_file(
                    File(raw_file, name=f"igpsport-{ride_id}.fit"),
                    source=Ride.Source.IGPSPORT,
                    external_id=ride_id,
                    parsed_data=parsed_data,
                    preferred_title=preferred_title,
                )
            return "imported" if imported else "skipped"
        finally:
            try:
                os.remove(temp_path)
            except FileNotFoundError:
                pass
