from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, Numeric, String, UniqueConstraint

from app.core.database import Base
from app.core.types import GUID, new_uuid, utcnow


class SalesOrderModel(Base):
    __tablename__ = "sales_orders"
    __table_args__ = (
        UniqueConstraint("business_id", "order_number", name="uq_sales_business_order_number"),
        Index("ix_sales_business", "business_id"),
        Index("ix_sales_business_status", "business_id", "status"),
    )

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_number = Column(String(50), nullable=False, index=True)
    customer_name = Column(String(255), nullable=False, index=True)
    customer_id = Column(GUID(), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    items_count = Column(Integer, default=1, nullable=False)
    total_amount = Column(Numeric(14, 2), default=0, nullable=False)
    status = Column(String(50), default="Completed", nullable=False, index=True)
    channel = Column(String(100), default="Online Store", nullable=False, index=True)
    order_date = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    posted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
        nullable=False,
    )


class SalesOrderLineModel(Base):
    __tablename__ = "sales_order_lines"
    __table_args__ = (Index("ix_sales_lines_business", "business_id"),)

    id = Column(GUID(), primary_key=True, default=new_uuid)
    order_id = Column(
        GUID(),
        ForeignKey("sales_orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id = Column(
        GUID(),
        ForeignKey("inventory_products.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    sku = Column(String(80), nullable=False, default="")
    product_name = Column(String(255), nullable=False, default="")
    qty = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(14, 2), nullable=False, default=0)
    line_total = Column(Numeric(14, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
