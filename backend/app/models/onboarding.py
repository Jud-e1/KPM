from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, UniqueConstraint

from app.core.database import Base
from app.core.types import GUID, new_uuid, utcnow


class OnboardingProfileModel(Base):
    __tablename__ = "onboarding_profiles"

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    company_name = Column(String(120), nullable=False, default="")
    business_type = Column(String(40), nullable=False, default="Retail")
    team_size = Column(String(40), nullable=False, default="Just me")
    country = Column(String(80), nullable=False, default="")
    currency = Column(String(8), nullable=False, default="USD")
    tax_mode = Column(String(40), nullable=False, default="added_at_sale")
    current_step = Column(String(40), nullable=False, default="company")
    completed = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    tour_dismissed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )


class OnboardingIntegrationModel(Base):
    __tablename__ = "onboarding_integrations"
    __table_args__ = (UniqueConstraint("business_id", "provider_id", name="uq_business_provider"),)

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    provider_id = Column(String(64), nullable=False, index=True)
    category = Column(String(40), nullable=False)
    status = Column(String(20), nullable=False, default="skipped")
    key_last4 = Column(String(8), nullable=True)
    encrypted_secret = Column(Text, nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )


class OnboardingAutomationModel(Base):
    __tablename__ = "onboarding_automations"
    __table_args__ = (UniqueConstraint("business_id", "function_id", name="uq_business_function"),)

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    function_id = Column(String(64), nullable=False, index=True)
    mode = Column(String(20), nullable=False, default="off")
    updated_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )
