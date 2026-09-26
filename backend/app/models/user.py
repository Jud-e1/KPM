from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, String

from app.core.database import Base
from app.core.types import GUID, new_uuid, utcnow


class User(Base):
    __tablename__ = "users"

    id = Column(GUID(), primary_key=True, default=new_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(120), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    # Kept for API compatibility — source of truth is businesses.name / business_type
    organization = Column(String(120), nullable=True)
    business_type = Column(String(80), nullable=True)
    role = Column(String(80), nullable=False, default="Admin")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )
