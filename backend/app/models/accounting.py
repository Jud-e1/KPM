from __future__ import annotations

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Numeric, String, UniqueConstraint

from app.core.database import Base
from app.core.types import GUID, new_uuid, utcnow


class AccountingTransactionModel(Base):
    __tablename__ = "accounting_transactions"
    __table_args__ = (
        Index("ix_accounting_tx_business", "business_id"),
        Index("ix_accounting_tx_business_status", "business_id", "status"),
    )

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    transaction_date = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    description = Column(String(255), nullable=False, index=True)
    reference = Column(String(80), nullable=True, index=True)
    counterparty = Column(String(255), nullable=True)
    category = Column(String(100), nullable=False, index=True)
    account = Column(String(100), nullable=False, index=True)
    transaction_type = Column(String(30), nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    status = Column(String(30), default="Cleared", nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )


class AccountingProfileModel(Base):
    __tablename__ = "accounting_profiles"
    __table_args__ = (UniqueConstraint("business_id", name="uq_accounting_profile_business"),)

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    full_name = Column(String(120), nullable=False, default="User")
    role = Column(String(80), nullable=False, default="Admin")
    organization = Column(String(120), nullable=False, default="My Business")
    auto_reconciliation = Column(String(8), nullable=False, default="true")
    notifications_enabled = Column(String(8), nullable=False, default="true")
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)


class AccountingActivityModel(Base):
    __tablename__ = "accounting_activities"
    __table_args__ = (Index("ix_accounting_activity_business", "business_id"),)

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    subtitle = Column(String(255), nullable=True)
    time = Column(String(50), nullable=False, default="Just now")
    timestamp = Column(Float, nullable=False, index=True)
    tone = Column(String(20), nullable=False, default="info", index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
