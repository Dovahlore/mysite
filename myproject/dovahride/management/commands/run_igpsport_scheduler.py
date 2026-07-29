import os
import subprocess
import sys
import time
from datetime import datetime, time as datetime_time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from dovahride.models import RideSyncRequest, RideSyncState


class Command(BaseCommand):
    help = "Run iGPSPORT sync jobs and the daily local-midnight schedule."

    poll_seconds = 5
    heartbeat_seconds = 30
    retry_seconds = 300

    def handle(self, *args, **options):
        zone = ZoneInfo(settings.TIME_ZONE)
        RideSyncRequest.objects.filter(
            status=RideSyncRequest.Status.RUNNING
        ).update(
            status=RideSyncRequest.Status.PENDING,
            started_at=None,
            message="Scheduler restarted; request returned to the queue.",
        )
        state, _ = RideSyncState.objects.get_or_create(pk=1)
        state.heartbeat_at = timezone.now()
        if state.status == RideSyncState.Status.RUNNING:
            state.status = RideSyncState.Status.IDLE
        state.save(update_fields=["heartbeat_at", "status", "updated_at"])

        next_scheduled_run = datetime.now(zone)
        last_heartbeat = 0.0

        while True:
            try:
                monotonic_now = time.monotonic()
                if monotonic_now - last_heartbeat >= self.heartbeat_seconds:
                    RideSyncState.objects.filter(pk=1).update(
                        heartbeat_at=timezone.now()
                    )
                    last_heartbeat = monotonic_now

                request = self._claim_request()
                if request:
                    self._execute_sync(full_sync=request.full_sync, request=request)
                    if next_scheduled_run <= datetime.now(zone):
                        next_scheduled_run = self._next_midnight(zone)
                        self.stdout.write(
                            f"Next iGPSPORT sync: {next_scheduled_run.isoformat()}"
                        )
                    continue

                if datetime.now(zone) >= next_scheduled_run:
                    succeeded = self._execute_sync(full_sync=False)
                    if succeeded:
                        next_scheduled_run = self._next_midnight(zone)
                    else:
                        next_scheduled_run = datetime.now(zone) + timedelta(
                            seconds=self.retry_seconds
                        )
                    self.stdout.write(
                        f"Next iGPSPORT sync: {next_scheduled_run.isoformat()}"
                    )

                time.sleep(self.poll_seconds)
            except KeyboardInterrupt:
                return

    def _claim_request(self):
        with transaction.atomic():
            RideSyncState.objects.select_for_update().get_or_create(pk=1)
            request = (
                RideSyncRequest.objects.select_for_update()
                .filter(status=RideSyncRequest.Status.PENDING)
                .order_by("requested_at")
                .first()
            )
            if not request:
                return None
            request.status = RideSyncRequest.Status.RUNNING
            request.started_at = timezone.now()
            request.message = "Scheduler accepted the request."
            request.save(
                update_fields=["status", "started_at", "message"]
            )
            return request

    def _execute_sync(self, *, full_sync, request=None):
        try:
            command = [
                sys.executable,
                str(settings.BASE_DIR / "manage.py"),
                "sync_igpsport",
            ]
            if full_sync:
                command.append("--all")
            subprocess.run(
                command,
                check=True,
                timeout=int(os.environ.get("IGPSPORT_SYNC_TIMEOUT_SECONDS", "1800")),
            )
        except Exception as exc:
            if request:
                request.status = RideSyncRequest.Status.FAILED
                request.finished_at = timezone.now()
                request.message = str(exc)[:500]
                request.save(
                    update_fields=["status", "finished_at", "message"]
                )
            self.stderr.write(f"iGPSPORT sync failed: {exc}")
            return False

        if request:
            request.status = RideSyncRequest.Status.SUCCESS
            request.finished_at = timezone.now()
            request.message = "Full synchronization completed."
            request.save(update_fields=["status", "finished_at", "message"])
        return True

    @staticmethod
    def _next_midnight(zone):
        now = datetime.now(zone)
        tomorrow = now.date() + timedelta(days=1)
        return datetime.combine(tomorrow, datetime_time.min, tzinfo=zone)
