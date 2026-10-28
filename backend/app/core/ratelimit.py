"""Fixed-window rate limits per client IP, counted in Redis (decision 31).

If Redis is unreachable the limit fails open: the request is allowed and a warning is
logged, so local prototype work runs without Redis. The client uses short timeouts, so a
missing Redis can't hang a request.
"""

import logging
import time
from collections.abc import Callable
from functools import lru_cache

from fastapi import Request, status
from redis import Redis, RedisError

from app.core.errors import AppError
from app.core.settings import Settings, get_settings

logger = logging.getLogger(__name__)

WINDOW_SECONDS = 60


@lru_cache
def get_ratelimit_redis() -> Redis:
    return Redis.from_url(get_settings().redis_url, socket_connect_timeout=0.5, socket_timeout=0.5)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def rate_limit(
    bucket: str, per_minute_setting: str, per_path_param: str | None = None
) -> Callable[[Request], None]:
    """A FastAPI dependency allowing `getattr(settings, per_minute_setting)` requests per
    minute per client IP in `bucket`; over that it raises 429 `rate_limited`."""
    if per_minute_setting not in Settings.model_fields:
        raise ValueError(f"Unknown setting for rate limit: {per_minute_setting}")

    def dependency(request: Request) -> None:
        limit: int = getattr(get_settings(), per_minute_setting)
        window = int(time.time() // WINDOW_SECONDS)
        # Optionally counted per resource too, so one Event's rush can't block another's.
        scope = f":{request.path_params.get(per_path_param, '')}" if per_path_param else ""
        key = f"ratelimit:{bucket}{scope}:{_client_ip(request)}:{window}"
        try:
            client = get_ratelimit_redis()
            count = client.incr(key)
            if count == 1:
                client.expire(key, WINDOW_SECONDS)
        except (RedisError, OSError) as exc:
            logger.warning("Rate limit %r skipped, Redis unavailable: %s", bucket, exc)
            return
        if count > limit:
            raise AppError(
                "rate_limited",
                "Too many requests. Wait a minute and try again.",
                status.HTTP_429_TOO_MANY_REQUESTS,
            )

    return dependency


login_rate_limit = rate_limit("login", "rate_limit_login_per_minute")
public_rate_limit = rate_limit("public", "rate_limit_public_per_minute")
event_page_rate_limit = rate_limit(
    "event_page", "rate_limit_event_page_per_minute", per_path_param="event_id"
)
