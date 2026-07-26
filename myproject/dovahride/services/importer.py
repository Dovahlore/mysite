import re
from datetime import timezone as datetime_timezone

from django.core.exceptions import ValidationError
from django.utils import timezone

from ..models import Ride
from ..utils.extract import generate_track_thumbnail, parse_ride_file


GENERATED_RIDE_TITLES = {
    "凌晨骑行",
    "晨间骑行",
    "上午骑行",
    "午后骑行",
    "傍晚骑行",
    "夜间骑行",
}


def normalize_start_time(value):
    if value and timezone.is_naive(value):
        return timezone.make_aware(value, datetime_timezone.utc)
    return value


def suggest_ride_title(start_time, preferred_title=None):
    preferred_title = str(preferred_title or "").strip()
    if preferred_title:
        return preferred_title[:100]

    start_time = normalize_start_time(start_time)
    if not start_time:
        return "未命名骑行"

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


def is_generated_ride_title(title):
    title = str(title or "").strip()
    return bool(
        title in GENERATED_RIDE_TITLES
        or re.fullmatch(r"\d{4}-\d{2}-\d{2}\s+骑行", title)
    )


def find_existing_ride(parsed_data):
    """Find a previously manual-imported copy of the same activity."""
    start_time = normalize_start_time(parsed_data.get("start_time"))
    if not start_time:
        return None

    distance = float(parsed_data.get("total_distance") or 0)
    duration = int(parsed_data.get("total_duration") or 0)
    candidates = Ride.objects.filter(start_time=start_time, external_id__isnull=True)

    matches = []
    for candidate in candidates:
        distance_tolerance = max(0.05, distance * 0.005)
        if abs(candidate.total_distance - distance) > distance_tolerance:
            continue
        if duration and abs(candidate.total_duration - duration) > 5:
            continue
        matches.append(candidate)

    return matches[0] if len(matches) == 1 else None


def import_ride_file(
    uploaded_file,
    *,
    source=Ride.Source.MANUAL,
    external_id=None,
    parsed_data=None,
    preferred_title=None,
):
    """Persist and parse one FIT/GPX file using the website's canonical flow."""
    if external_id and Ride.objects.filter(
        source=source,
        external_id=external_id,
    ).exists():
        return None

    instance = Ride(
        source=source,
        external_id=external_id,
        data_file=uploaded_file,
    )
    try:
        instance.save()
        data = parsed_data or parse_ride_file(instance.data_file.path)
        if not data or not data.get("points"):
            raise ValidationError("The ride file contains no usable track points.")

        start_time = normalize_start_time(data.get("start_time"))
        if start_time:
            instance.start_time = start_time
        instance.title = suggest_ride_title(start_time, preferred_title)

        instance.total_distance = data.get("total_distance", 0)
        instance.total_duration = data.get("total_duration", 0)
        instance.moving_time = data.get("total_timer_time", 0)
        instance.total_ascent = data.get("total_ascent", 0)
        instance.avg_speed = data.get("avg_speed", 0)
        instance.max_speed = data.get("max_speed", 0)
        instance.calories = data.get("total_calories")
        instance.avg_heart_rate = data.get("avg_heart_rate")
        instance.avg_power = data.get("avg_power")

        thumb_file = generate_track_thumbnail(data["points"])
        if thumb_file:
            instance.thumbnail.save("thumb.png", thumb_file, save=False)

        instance.save()
        return instance
    except Exception:
        if instance.pk:
            instance.delete()
        elif instance.data_file.name:
            instance.data_file.storage.delete(instance.data_file.name)
        raise
