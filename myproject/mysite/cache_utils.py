import hashlib
import time

from django.core.cache import cache


def client_ip(request):
    """Return the direct client IP supplied by Nginx/uWSGI."""
    return request.META.get("REMOTE_ADDR", "unknown")


def _rate_limit_key(namespace, identity, period):
    digest = hashlib.sha256(str(identity).encode("utf-8")).hexdigest()[:24]
    window = int(time.time() // period)
    return f"rate:{namespace}:{digest}:{window}"


def rate_limit_allows(namespace, identity, limit, period):
    """
    Increment a fixed-window counter and return whether the request is allowed.

    Cache failures deliberately fail open: Redis is an optimization and should
    not make the personal site unavailable.
    """
    key = _rate_limit_key(namespace, identity, period)
    try:
        if cache.add(key, 1, timeout=period + 1):
            return True
        count = cache.incr(key)
        return not isinstance(count, int) or count <= limit
    except Exception:
        return True
