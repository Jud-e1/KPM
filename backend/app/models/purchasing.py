from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text

from app.core.database import Base
from app.core.types import GUID, new_uuid, utcnow


class PurchaseDraftModel(Base):
    __tablename__ = "purchase_drafts"

    id = Column(GUID(), primary_key=True, default=new_uuid)
    business_id = Column(
        GUID(),
        ForeignKey("businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id = Column(
        GUID(),
        ForeignKey("inventory_products.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sku = Column(String(100), nullable=False, default="")
    product_name = Column(String(255), nullable=False, default="")
    qty = Column(Integer, nullable=False, default=1)
    reason = Column(Text, nullable=False, default="")
    status = Column(String(30), nullable=False, default="draft", index=True)
    proposal_id = Column(GUID(), nullable=True, index=True)
    supplier_id = Column(GUID(), ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)
