"""Tenancy helpers — active business resolution and Postgres RLS GUC."""
from __future__ import annotations

import uuid
from contextvars import ContextVar
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token, security
from app.models.business import Business, BusinessMembership
from app.models.user import User

_current_business_id: ContextVar[Optional[uuid.UUID]] = ContextVar("current_business_id", default=None)


def get_current_business_id() -> Optional[uuid.UUID]:
    return _current_business_id.get()


def set_current_business_id(business_id: Optional[uuid.UUID]) -> None:
    _current_business_id.set(business_id)


def as_uuid(value) -> uuid.UUID:
    if isinstance(value, uuid.UUID):
        return value
    return uuid.UUID(str(value))


def apply_rls_guc(
    db: Session,
    business_id: uuid.UUID | None,
    user_id: uuid.UUID | None = None,
) -> None:
    """Set Postgres session GUCs used by RLS policies. No-op on SQLite."""
    bind = db.get_bind()
    if bind is None or bind.dialect.name != "postgresql":
        return
    db.execute(
        text("SELECT set_config('app.current_business_id', :bid, true)"),
        {"bid": str(business_id) if business_id else ""},
    )
    db.execute(
        text("SELECT set_config('app.current_user_id', :uid, true)"),
        {"uid": str(user_id) if user_id else ""},
    )


def resolve_business_for_user(
    db: Session,
    user: User,
    preferred_business_id: uuid.UUID | str | None = None,
) -> Business:
    preferred: uuid.UUID | None = None
    if preferred_business_id:
        preferred = as_uuid(preferred_business_id)

    if preferred is not None:
        membership = (
            db.query(BusinessMembership)
            .filter(
                BusinessMembership.user_id == user.id,
                BusinessMembership.business_id == preferred,
            )
            .first()
        )
        if membership:
            business = db.query(Business).filter(Business.id == preferred).first()
            if business:
                return business

    membership = (
        db.query(BusinessMembership)
        .filter(BusinessMembership.user_id == user.id)
        .order_by(BusinessMembership.created_at.asc())
        .first()
    )
    if membership:
        business = db.query(Business).filter(Business.id == membership.business_id).first()
        if business:
            return business

    owned = (
        db.query(Business)
        .filter(Business.owner_user_id == user.id)
        .order_by(Business.created_at.asc())
        .first()
    )
    if owned:
        return owned

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No business workspace found for this account",
    )


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    try:
        uid = as_uuid(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token subject") from exc
    user = db.query(User).filter(User.id == uid).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")

    business = resolve_business_for_user(db, user, payload.get("business_id"))
    set_current_business_id(as_uuid(business.id))
    apply_rls_guc(db, as_uuid(business.id), as_uuid(user.id))
    user._active_business_id = as_uuid(business.id)  # type: ignore[attr-defined]
    user._active_business = business  # type: ignore[attr-defined]
    return user


def require_business_id(user: User) -> uuid.UUID:
    bid = getattr(user, "_active_business_id", None) or get_current_business_id()
    if bid is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active business")
    return as_uuid(bid)
