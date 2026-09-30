"""Shared DB column helpers for multi-tenant UUID schema."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.types import CHAR, TypeDecorator


class GUID(TypeDecorator):
    """Platform-independent UUID type.

    Uses PostgreSQL UUID; stores as CHAR(36) elsewhere (SQLite).
    """

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value if dialect.name == "postgresql" else str(value)
        try:
            parsed = uuid.UUID(str(value))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Invalid UUID: {value!r}") from exc
        return parsed if dialect.name == "postgresql" else str(parsed)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return str(value)
        return str(uuid.UUID(str(value)))


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


def coerce_uuid(value) -> uuid.UUID:
    """Parse a UUID or mint a new one when the client sent a legacy/non-UUID id."""
    if value is None or value == "":
        return new_uuid()
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return new_uuid()


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def business_fk(nullable: bool = False):
    return ForeignKey("businesses.id", ondelete="CASCADE"),


KPM_ID_NAMESPACE = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")


def stable_uuid(legacy_id: str) -> uuid.UUID:
    """Deterministic UUID from a legacy string primary key."""
    return uuid.uuid5(KPM_ID_NAMESPACE, f"kpm:{legacy_id}")
