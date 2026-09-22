import datetime

from sqlalchemy import Column, DateTime, Float, String

from app.core.database import Base


class AccountingTransactionModel(Base):
    __tablename__ = "accounting_transactions"

    id = Column(String(64), primary_key=True, index=True)
    transaction_date = Column(DateTime, default=datetime.datetime.utcnow, nullable=False, index=True)
    description = Column(String(255), nullable=False, index=True)
    reference = Column(String(80), nullable=True, index=True)
    counterparty = Column(String(255), nullable=True)
    category = Column(String(100), nullable=False, index=True)
    account = Column(String(100), nullable=False, index=True)
    transaction_type = Column(String(30), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    status = Column(String(30), default="Cleared", nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )


class AccountingProfileModel(Base):
    __tablename__ = "accounting_profiles"

    id = Column(String(64), primary_key=True)
    full_name = Column(String(120), nullable=False, default="Jude Azane")
    role = Column(String(80), nullable=False, default="Admin")
    organization = Column(String(120), nullable=False, default="Acme Trading Co.")
    auto_reconciliation = Column(String(8), nullable=False, default="true")
    notifications_enabled = Column(String(8), nullable=False, default="true")
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)


class AccountingActivityModel(Base):
    __tablename__ = "accounting_activities"

    id = Column(String(64), primary_key=True)
    title = Column(String(255), nullable=False)
    subtitle = Column(String(255), nullable=True)
    time = Column(String(50), nullable=False, default="Just now")
    timestamp = Column(Float, nullable=False, index=True)
    tone = Column(String(20), nullable=False, default="info", index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
