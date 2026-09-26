"""Redis-backed cache for hot summary endpoints."""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

_client = None
_client_failed = False


def _get_client():
    global _client, _client_failed
    if _client_failed:
        return None
    if _client is not None:
        return _client
    if not settings.REDIS_URL:
        _client_failed = True
        return None
    try:
        import redis

        _client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=1)
        _client.ping()
        return _client
    except Exception as exc:
        logger.warning("Redis unavailable (%s); summary cache disabled", exc)
        _client_failed = True
        _client = None
        return None


def cache_get(key: str) -> Optional[Any]:
    client = _get_client()
    if not client:
        return None
    try:
        raw = client.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        return None


def cache_set(key: str, value: Any, ttl: Optional[int] = None) -> None:
    client = _get_client()
    if not client:
        return
    try:
        client.setex(key, ttl or settings.REDIS_SUMMARY_TTL_SECONDS, json.dumps(value, default=str))
    except Exception:
        return


def cache_delete_prefix(prefix: str) -> None:
    client = _get_client()
    if not client:
        return
    try:
        for key in client.scan_iter(match=f"{prefix}*"):
            client.delete(key)
    except Exception:
        return


def summary_key(domain: str, business_id: str) -> str:
    return f"kpm:summary:{domain}:{business_id}"
