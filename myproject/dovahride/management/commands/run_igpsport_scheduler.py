import time
from datetime import datetime, time as datetime_time, timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Run iGPSPORT sync now, then every day at local midnight."

    retry_seconds = 300

    def handle(self, *args, **options):
        zone = ZoneInfo(settings.TIME_ZONE)

        while True:
            try:
                call_command("sync_igpsport")
            except KeyboardInterrupt:
                return
            except Exception as exc:
                self.stderr.write(
                    f"iGPSPORT sync failed; retrying in {self.retry_seconds}s: {exc}"
                )
                time.sleep(self.retry_seconds)
                continue

            now = datetime.now(zone)
            tomorrow = now.date() + timedelta(days=1)
            next_run = datetime.combine(tomorrow, datetime_time.min, tzinfo=zone)
            sleep_seconds = max(1, (next_run - now).total_seconds())
            self.stdout.write(f"Next iGPSPORT sync: {next_run.isoformat()}")
            try:
                time.sleep(sleep_seconds)
            except KeyboardInterrupt:
                return
