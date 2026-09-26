from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class CustomerCreate(BaseModel):
    id: Optional[str] = None
    name: str = Field(..., max_length=120)
    email: str = Field(..., max_length=255)
    company: str = Field(..., max_length=160)
    industry: str = Field("General", max_length=100)
    customer_type: str = Field("Regular", max_length=40)
    total_spent: float = 0.0
    last_order: Optional[str] = None
    last_order_ts: float = 0.0
    status: str = Field("Active", max_length=30)
    avatar_color: str = Field("blue", max_length=30)
    is_new: bool = True
    high_value: bool = False


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    customer_type: Optional[str] = None
    total_spent: Optional[float] = None
    last_order: Optional[str] = None
    last_order_ts: Optional[float] = None
    status: Optional[str] = None
    avatar_color: Optional[str] = None
    is_new: Optional[bool] = None
    high_value: Optional[bool] = None


class CustomerResponse(CustomerCreate):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CustomerSummaryResponse(BaseModel):
    revision: str
    total_customers: int
    active_customers: int


class SupplierCreate(BaseModel):
    id: Optional[str] = None
    name: str
    initial: str = "S"
    accent: str = "slate"
    categories: List[str] = []
    products: int = 0
    location: str = ""
    rating: float = 4.5
    reviews: int = 0
    response_time: str = "1–3 days"
    min_order: float = 0.0
    verified: bool = False
    status: str = "Pending"
    match_score: int = 80
    spend_this_month: float = 0.0


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    initial: Optional[str] = None
    accent: Optional[str] = None
    categories: Optional[List[str]] = None
    products: Optional[int] = None
    location: Optional[str] = None
    rating: Optional[float] = None
    reviews: Optional[int] = None
    response_time: Optional[str] = None
    min_order: Optional[float] = None
    verified: Optional[bool] = None
    status: Optional[str] = None
    match_score: Optional[int] = None
    spend_this_month: Optional[float] = None


class SupplierResponse(SupplierCreate):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupplierSummaryResponse(BaseModel):
    revision: str
    total_suppliers: int
    active_suppliers: int


class SupplierRequestCreate(BaseModel):
    id: Optional[str] = None
    need: str
    category: str = "General"
    budget: float = 0.0
    created_at: Optional[str] = None
    status: str = "Open"


class SupplierRequestResponse(SupplierRequestCreate):
    id: str

    class Config:
        from_attributes = True
