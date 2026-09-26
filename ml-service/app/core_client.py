"""HTTP client for core FastAPI ML gateway."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if settings.ML_SERVICE_TOKEN:
        headers["X-ML-Service-Token"] = settings.ML_SERVICE_TOKEN
    return headers


def fetch_pending_events(limit: int = 50) -> list[dict[str, Any]]:
    url = f"{settings.CORE_API_BASE.rstrip('/')}/ml/events/pending"
    try:
        with httpx.Client(timeout=30.0) as client:
            r = client.get(url, params={"limit": limit}, headers=_headers())
            r.raise_for_status()
            return r.json()
    except Exception as exc:
        logger.error("Failed to fetch pending ML events: %s", exc)
        return []


def mark_processed(event_id: str) -> bool:
    url = f"{settings.CORE_API_BASE.rstrip('/')}/ml/events/{event_id}/processed"
    try:
        with httpx.Client(timeout=30.0) as client:
            r = client.post(url, headers=_headers())
            r.raise_for_status()
            return True
    except Exception as exc:
        logger.error("Failed to mark event %s processed: %s", event_id, exc)
        return False


def post_proposal(proposal: dict[str, Any]) -> dict[str, Any] | None:
    url = f"{settings.CORE_API_BASE.rstrip('/')}/ml/internal/proposals"
    try:
        with httpx.Client(timeout=30.0) as client:
            r = client.post(url, json=proposal, headers=_headers())
            r.raise_for_status()
            return r.json()
    except Exception as exc:
        logger.error("Failed to post proposal: %s", exc)
        return None
