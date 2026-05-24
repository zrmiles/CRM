from __future__ import annotations

import asyncio
import time
from asyncio import Lock

from fastapi import Request

from app.core.config import get_settings
from app.core.exceptions import TooManyRequestsException

try:
    from redis.asyncio import Redis
    from redis.exceptions import RedisError
except ImportError:  # pragma: no cover - only used before dependencies are installed.
    Redis = None  # type: ignore[assignment]
    RedisError = Exception  # type: ignore[assignment]


_redis_client: Redis | None = None
_redis_client_loop: asyncio.AbstractEventLoop | None = None
_redis_unavailable = False
_fallback_requests: dict[str, list[float]] = {}
_fallback_lock = Lock()

_SLIDING_WINDOW_SCRIPT = """
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
local count = redis.call('ZCARD', KEYS[1])
if count >= tonumber(ARGV[3]) then
  return count
end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[4])
return count + 1
"""


def _get_redis_client() -> Redis | None:
    global _redis_client, _redis_client_loop
    settings = get_settings()
    if not settings.REDIS_URL or Redis is None or _redis_unavailable:
        return None
    loop = asyncio.get_running_loop()
    if _redis_client is None or _redis_client_loop is not loop:
        _redis_client = Redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        _redis_client_loop = loop
    return _redis_client


async def _client_key(request: Request) -> str:
    client_host = request.client.host if request.client else "unknown"
    identity = ""
    try:
        body = await request.json()
        if isinstance(body, dict) and body.get("email"):
            identity = f":{str(body['email']).lower()}"
    except Exception:
        identity = ""
    return f"auth-rate:{client_host}:{request.url.path}{identity}"


async def _redis_rate_limit(key: str, limit: int, window_seconds: int) -> bool | None:
    global _redis_unavailable
    redis = _get_redis_client()
    if redis is None:
        return None

    now_ms = int(time.time() * 1000)
    cutoff_ms = now_ms - window_seconds * 1000
    try:
        count = await redis.eval(
            _SLIDING_WINDOW_SCRIPT,
            1,
            key,
            cutoff_ms,
            now_ms,
            limit,
            window_seconds,
        )
    except (OSError, RedisError, RuntimeError):
        _redis_unavailable = True
        return None
    return int(count) <= limit


async def _fallback_rate_limit(key: str, limit: int, window_seconds: int) -> bool:
    now = time.monotonic()
    cutoff = now - window_seconds

    async with _fallback_lock:
        for stored_key, timestamps in list(_fallback_requests.items()):
            retained = [timestamp for timestamp in timestamps if timestamp > cutoff]
            if retained:
                _fallback_requests[stored_key] = retained
            else:
                del _fallback_requests[stored_key]

        recent = _fallback_requests.get(key, [])
        if len(recent) >= limit:
            _fallback_requests[key] = recent
            return False

        recent.append(now)
        _fallback_requests[key] = recent
        return True


async def auth_rate_limiter(request: Request) -> None:
    """Redis-backed sliding-window limiter for auth endpoints.

    REDIS_URL enables cross-process limiting. The local fallback keeps tests and
    one-off development usable when Redis is not configured.
    """
    settings = get_settings()
    limit = settings.AUTH_RATE_LIMIT_PER_MINUTE
    window_seconds = 60
    key = await _client_key(request)

    allowed = await _redis_rate_limit(key, limit, window_seconds)
    if allowed is None:
        allowed = await _fallback_rate_limit(key, limit, window_seconds)

    if not allowed:
        raise TooManyRequestsException("Слишком много попыток входа")
