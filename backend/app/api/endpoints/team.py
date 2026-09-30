"""Team invites on top of BusinessMembership."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.account_tokens import find_invite, issue_invite
from app.core.config import settings
from app.core.database import get_db
from app.core.mail import send_email
from app.core.security import get_current_user
from app.core.tenancy import require_business_id
from app.core.types import new_uuid
from app.models.access import BusinessInviteModel
from app.models.business import Business, BusinessMembership
from app.models.user import User

router = APIRouter()


class InviteCreate(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    role: str = Field("Member", max_length=40)


class InviteAccept(BaseModel):
    token: str = Field(..., min_length=10)


class InviteOut(BaseModel):
    email: str
    role: str
    expires_at: datetime


def accept_invite_for_user(db: Session, user: User, raw_token: str) -> Business:
    invite = find_invite(db, raw_token)
    if invite is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite is invalid or expired")
    if invite.email != user.email.lower():
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This invite was sent to a different email")
    existing = (
        db.query(BusinessMembership)
        .filter(
            BusinessMembership.business_id == invite.business_id,
            BusinessMembership.user_id == user.id,
        )
        .first()
    )
    if existing is None:
        db.add(
            BusinessMembership(
                id=new_uuid(),
                business_id=invite.business_id,
                user_id=user.id,
                role=invite.role,
            )
        )
    invite.accepted_at = datetime.now(timezone.utc)
    user.role = invite.role
    business = db.query(Business).filter(Business.id == invite.business_id).first()
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    db.commit()
    return business


@router.post("/invites", response_model=InviteOut)
def create_invite(
    payload: InviteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    business_id = require_business_id(user)
    business = db.query(Business).filter(Business.id == business_id).first()
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    raw = issue_invite(db, business_id, payload.email, payload.role)
    db.commit()
    link = f"{settings.PUBLIC_APP_URL.rstrip('/')}/invite?token={raw}"
    send_email(
        payload.email.lower().strip(),
        f"Join {business.name} on KPM",
        f"{user.full_name} invited you to {business.name} on KPM.\n\nOpen this link to join:\n{link}\n",
    )
    expires = datetime.now(timezone.utc)
    return InviteOut(
        email=payload.email.lower().strip(),
        role=payload.role,
        expires_at=expires + timedelta(days=7),
    )


@router.get("/invites", response_model=list[InviteOut])
def list_invites(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(BusinessInviteModel)
        .filter(
            BusinessInviteModel.business_id == require_business_id(user),
            BusinessInviteModel.accepted_at.is_(None),
        )
        .order_by(BusinessInviteModel.created_at.desc())
        .all()
    )
    return [InviteOut(email=row.email, role=row.role, expires_at=row.expires_at) for row in rows]


@router.post("/invites/accept")
def accept_invite(
    payload: InviteAccept,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    business = accept_invite_for_user(db, user, payload.token)
    return {"business_id": str(business.id), "name": business.name}
