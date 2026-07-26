import os
import tempfile
from datetime import timedelta

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from dovahride.models import Ride
from dovahride.services.igpsport import IGPSportClient, IGPSportError
from dovahride.services.importer import find_existing_ride, import_ride_file
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

    def handle(self, *args, **options):
        username = os.environ.get("IGPSPORT_USERNAME")
        password = os.environ.get("IGPSPORT_PASSWORD")
        if not username or not password:
            raise CommandError(
                "Set IGPSPORT_USERNAME and IGPSPORT_PASSWORD in the environment."
            )

        days = options["days"]
        if days < 1:
            raise CommandError("--days must be at least 1.")

        end_date = timezone.localdate()
        begin_date = end_date - timedelta(days=days - 1)
        client = IGPSportClient(username, password)
        imported = skipped = linked = failed = 0

        self.stdout.write(
            f"Checking iGPSPORT activities from {begin_date} through {end_date}."
        )
        try:
            activities = client.list_activities(begin_date, end_date)
            for activity in activities:
                ride_id = str(activity.get("rideId") or "").strip()
                if not ride_id:
                    failed += 1
                    self.stderr.write("Skipping an activity with no rideId.")
                    continue

                if Ride.objects.filter(
                    source=Ride.Source.IGPSPORT,
                    external_id=ride_id,
                ).exists():
                    skipped += 1
                    continue

                try:
                    result = self._download_and_import(client, ride_id)
                    if result == "linked":
                        linked += 1
                    elif result == "imported":
                        imported += 1
                    else:
                        skipped += 1
                except Exception as exc:
                    failed += 1
                    self.stderr.write(f"rideId {ride_id} failed: {exc}")
        except IGPSportError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(
            self.style.SUCCESS(
                "iGPSPORT sync complete: "
                f"{imported} imported, {linked} linked to existing rides, "
                f"{skipped} already present, {failed} failed."
            )
        )
        if failed:
            raise CommandError(f"{failed} iGPSPORT activities failed to synchronize.")

    def _download_and_import(self, client, ride_id):
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
                existing.save(update_fields=["source", "external_id"])
                return "linked"

            with open(temp_path, "rb") as raw_file:
                imported = import_ride_file(
                    File(raw_file, name=f"igpsport-{ride_id}.fit"),
                    source=Ride.Source.IGPSPORT,
                    external_id=ride_id,
                    parsed_data=parsed_data,
                )
            return "imported" if imported else "skipped"
        finally:
            try:
                os.remove(temp_path)
            except FileNotFoundError:
                pass
