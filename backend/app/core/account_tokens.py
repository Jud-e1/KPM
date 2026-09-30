"""One-time tokens for email verification, password reset, and team invites."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.types import new_uuid
from app.models.access import AuthTokenModel, BusinessInviteModel
from app.models.user import User


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def issue_auth_token(db: Session, user: User, purpose: str, hours: int) -> str:
    raw = secrets.token_urlsafe(32)
    db.add(
        AuthTokenModel(
            id=new_uuid(),
            user_id=user.id,
            purpose=purpose,
            token_hash=hash_token(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=hours),
        )
    )
    return raw


def consume_auth_token(db: Session, raw: str, purpose: str) -> User | None:
    row = (
        db.query(AuthTokenModel)
        .filter(AuthTokenModel.token_hash == hash_token(raw), AuthTokenModel.purpose == purpose)
        .first()
    )
    if row is None or row.used_at is not None:
        return None
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        return None
    user = db.query(User).filter(User.id == row.user_id).first()
    if user is None:
        return None
    row.used_at = datetime.now(timezone.utc)
    return user


def issue_invite(db: Session, business_id, email: str, role: str, days: int = 7) -> str:
    raw = secrets.token_urlsafe(32)
    db.add(
        BusinessInviteModel(
            id=new_uuid(),
            business_id=business_id,
            email=email.lower().strip(),
            role=(role or "Member")[:40],
            token_hash=hash_token(raw),
            expires_at=datetime.now(timezone.utc) + timedelta(days=days),
        )
    )
    return raw


def find_invite(db: Session, raw: str) -> BusinessInviteModel | None:
    row = db.query(BusinessInviteModel).filter(BusinessInviteModel.token_hash == hash_token(raw)).first()
    if row is None or row.accepted_at is not None:
        return None
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        return None
    return row
