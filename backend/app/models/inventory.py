from __future__ import annotations

from sqlalchemy import Column, DateTime, Float, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint

from app.core.database import Base
from app.core.types import GUID, new_uuid, utcnow


class Product(Base):
    __tablename__ = "inventory_products"
    __table_args__ = (
        UniqueConstraint("business_id", "sku", name="uq_inventory_business_sku"),
        Index("ix_inventory_business", "business_id"),
        Index("ix_inventory_business_status", "business_id", "status"),
    )

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False, index=True)
    subtitle = Column(String(255), nullable=True)
    sku = Column(String(100), nullable=False, index=True)
    category = Column(String(100), default="General", nullable=False, index=True)
    stock = Column(Integer, default=0, nullable=False)
    status = Column(String(50), default="In Stock", nullable=False, index=True)
    price = Column(Numeric(14, 2), default=0, nullable=False)
    low_stock_threshold = Column(Integer, default=15, nullable=False)
    image = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )
