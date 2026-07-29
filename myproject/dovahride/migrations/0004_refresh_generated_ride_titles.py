import re

from django.db import migrations
from django.utils import timezone


DATE_TITLE = re.compile(r"^\d{4}-\d{2}-\d{2}\s+骑行$")


def title_for_time(start_time):
    hour = timezone.localtime(start_time).hour
    if hour < 5:
        return "凌晨骑行"
    if hour < 10:
        return "晨间骑行"
    if hour < 12:
        return "上午骑行"
    if hour < 17:
        return "午后骑行"
    if hour < 20:
        return "傍晚骑行"
    return "夜间骑行"


def refresh_generated_titles(apps, schema_editor):
    Ride = apps.get_model("dovahride", "Ride")
    rides_to_update = []
    for ride in Ride.objects.exclude(start_time=None).only(
        "id",
        "title",
        "start_time",
    ):
        if DATE_TITLE.fullmatch((ride.title or "").strip()):
            ride.title = title_for_time(ride.start_time)
            rides_to_update.append(ride)

    if rides_to_update:
        Ride.objects.bulk_update(rides_to_update, ["title"], batch_size=500)


class Migration(migrations.Migration):
    dependencies = [
        ("dovahride", "0003_ridesyncrequest_ridesyncstate"),
    ]

    operations = [
        migrations.RunPython(refresh_generated_titles, migrations.RunPython.noop),
    ]
