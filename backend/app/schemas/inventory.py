from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


class ProductBase(BaseModel):
    name: str = Field(..., max_length=255)
    subtitle: Optional[str] = Field(None, max_length=255)
    sku: str = Field(..., max_length=100)
    category: str = Field("General", max_length=100)
    stock: int = Field(0, ge=0)
    price: float = Field(0.0, ge=0.0)
    status: Optional[str] = Field(None, max_length=50)
    low_stock_threshold: int = Field(15, ge=0)
    image: Optional[str] = None


class ProductCreate(ProductBase):
    id: Optional[str] = None


class ProductBulkCreate(BaseModel):
    products: List[ProductCreate] = Field(default_factory=list, max_length=500)


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    subtitle: Optional[str] = Field(None, max_length=255)
    sku: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    stock: Optional[int] = Field(None, ge=0)
    price: Optional[float] = Field(None, ge=0.0)
    status: Optional[str] = Field(None, max_length=50)
    low_stock_threshold: Optional[int] = Field(None, ge=0)
    image: Optional[str] = None


class ProductResponse(ProductBase):
    id: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductBulkCreateResponse(BaseModel):
    created: List[ProductResponse]
    count: int


class StockAdjustRequest(BaseModel):
    amount: int
    is_delta: bool = True
