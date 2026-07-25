from django.db import DatabaseError

from dovahwall.models import photo


def random_photos(limit):
    """Return up to ``limit`` distinct photos in a random order."""
    try:
        return list(photo.objects.exclude(pic="").order_by("?")[:limit])
    except DatabaseError:
        # Keep public and login pages usable while the database is unavailable.
        return []
