from __future__ import annotations

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.types import GUID, new_uuid, utcnow


class Business(Base):
    __tablename__ = "businesses"

    id = Column(GUID(), primary_key=True, default=new_uuid)
    owner_user_id = Column(
        GUID(),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    name = Column(String(120), nullable=False)
    business_type = Column(String(80), nullable=True)
    currency = Column(String(8), nullable=False, default="USD")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )

    memberships = relationship(
        "BusinessMembership",
        back_populates="business",
        cascade="all, delete-orphan",
    )


class BusinessMembership(Base):
    __tablename__ = "business_memberships"
    __table_args__ = (UniqueConstraint("business_id", "user_id", name="uq_business_user"),)

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(40), nullable=False, default="Admin")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    business = relationship("Business", back_populates="memberships")


def ensure_default_business(
    *,
    user_id: uuid.UUID,
    name: str,
    business_type: str | None = None,
    currency: str = "USD",
) -> tuple[Business, BusinessMembership]:
    """Factory used by auth signup — caller must add/commit."""
    business = Business(
        id=new_uuid(),
        owner_user_id=user_id,
        name=(name or "My Business")[:120],
        business_type=(business_type or None),
        currency=currency or "USD",
    )
    membership = BusinessMembership(
        id=new_uuid(),
        business_id=business.id,
        user_id=user_id,
        role="Admin",
    )
    return business, membership
