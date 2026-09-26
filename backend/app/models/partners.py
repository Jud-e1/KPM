from __future__ import annotations

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Index, Integer, Numeric, String, Text

from app.core.database import Base
from app.core.types import GUID, new_uuid, utcnow


class CustomerModel(Base):
    __tablename__ = "customers"
    __table_args__ = (
        Index("ix_customers_business", "business_id"),
        Index("ix_customers_business_status", "business_id", "status"),
    )

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(120), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    company = Column(String(160), nullable=False, index=True)
    industry = Column(String(100), nullable=False, default="General")
    customer_type = Column(String(40), nullable=False, default="Regular", index=True)
    total_spent = Column(Numeric(14, 2), nullable=False, default=0)
    last_order = Column(String(40), nullable=True)
    last_order_ts = Column(Float, nullable=False, default=0.0, index=True)
    status = Column(String(30), nullable=False, default="Active", index=True)
    avatar_color = Column(String(30), nullable=False, default="blue")
    is_new = Column(Boolean, nullable=False, default=True)
    high_value = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )


class SupplierModel(Base):
    __tablename__ = "suppliers"
    __table_args__ = (
        Index("ix_suppliers_business", "business_id"),
        Index("ix_suppliers_business_status", "business_id", "status"),
    )

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(160), nullable=False, index=True)
    initial = Column(String(4), nullable=False, default="S")
    accent = Column(String(20), nullable=False, default="slate")
    categories = Column(Text, nullable=False, default="[]")
    products = Column(Integer, nullable=False, default=0)
    location = Column(String(160), nullable=False, default="")
    rating = Column(Float, nullable=False, default=4.5)
    reviews = Column(Integer, nullable=False, default=0)
    response_time = Column(String(40), nullable=False, default="1–3 days")
    min_order = Column(Numeric(14, 2), nullable=False, default=0)
    verified = Column(Boolean, nullable=False, default=False)
    status = Column(String(30), nullable=False, default="Pending", index=True)
    match_score = Column(Integer, nullable=False, default=80)
    spend_this_month = Column(Numeric(14, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )


class SupplierRequestModel(Base):
    __tablename__ = "supplier_requests"
    __table_args__ = (Index("ix_supplier_requests_business", "business_id"),)

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    need = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False, default="General")
    budget = Column(Numeric(14, 2), nullable=False, default=0)
    created_at = Column(String(40), nullable=False)
    status = Column(String(30), nullable=False, default="Open", index=True)
    updated_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )
