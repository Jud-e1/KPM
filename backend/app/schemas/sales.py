from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class SalesOrderLineIn(BaseModel):
    product_id: Optional[str] = Field(None, max_length=64)
    sku: Optional[str] = Field(None, max_length=80)
    product_name: Optional[str] = Field(None, max_length=255)
    qty: int = Field(1, ge=1)
    unit_price: Optional[float] = Field(None, ge=0.0)


class SalesOrderLineOut(BaseModel):
    id: str
    order_id: str
    product_id: Optional[str] = None
    sku: str
    product_name: str
    qty: int
    unit_price: float
    line_total: float

    model_config = {"from_attributes": True}


class SalesOrderBase(BaseModel):
    order_number: str = Field(..., max_length=50)
    customer_name: str = Field(..., max_length=255)
    customer_id: Optional[str] = Field(None, max_length=50)
    items_count: int = Field(1, ge=1)
    total_amount: float = Field(0.0, ge=0.0)
    status: str = Field("Completed", max_length=50)
    channel: str = Field("Online Store", max_length=100)


class SalesOrderCreate(SalesOrderBase):
    id: Optional[str] = None
    lines: Optional[List[SalesOrderLineIn]] = None


class SalesOrderUpdate(BaseModel):
    status: Optional[str] = Field(None, max_length=50)
    customer_name: Optional[str] = Field(None, max_length=255)
    total_amount: Optional[float] = Field(None, ge=0.0)


class SalesOrderResponse(SalesOrderBase):
    id: str
    order_date: datetime
    created_at: datetime
    updated_at: datetime
    invoice_number: Optional[str] = None
    posted_at: Optional[datetime] = None
    lines: List[SalesOrderLineOut] = []

    model_config = {"from_attributes": True}


class SalesSummaryResponse(BaseModel):
    """Small change token and totals used by the live sales clients."""

    revision: str
    total_orders: int
    total_revenue: float
    outstanding_invoices: float
