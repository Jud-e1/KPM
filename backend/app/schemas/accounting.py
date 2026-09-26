from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AccountingCsvImportResponse(BaseModel):
    imported: int
    skipped: int
    message: str


class AccountingTransactionBase(BaseModel):
    description: str = Field(..., max_length=255)
    reference: Optional[str] = Field(None, max_length=80)
    counterparty: Optional[str] = Field(None, max_length=255)
    category: str = Field(..., max_length=100)
    account: str = Field(..., max_length=100)
    transaction_type: str = Field(..., max_length=30)
    amount: float = Field(..., ge=0)
    status: str = Field("Cleared", max_length=30)
    transaction_date: Optional[datetime] = None


class AccountingTransactionCreate(AccountingTransactionBase):
    id: Optional[str] = None


class AccountingTransactionUpdate(BaseModel):
    description: Optional[str] = Field(None, max_length=255)
    reference: Optional[str] = Field(None, max_length=80)
    counterparty: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    account: Optional[str] = Field(None, max_length=100)
    transaction_type: Optional[str] = Field(None, max_length=30)
    amount: Optional[float] = Field(None, ge=0)
    status: Optional[str] = Field(None, max_length=30)
    transaction_date: Optional[datetime] = None


class AccountingTransactionResponse(AccountingTransactionBase):
    id: str
    transaction_date: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AccountingSummaryResponse(BaseModel):
    revision: str
    transactions_revision: str
    profile_revision: str
    activities_revision: str
    total_transactions: int
    income: float
    expenses: float
    pending_amount: float


class AccountingActivityResponse(BaseModel):
    id: str
    title: str
    subtitle: Optional[str] = None
    time: str
    timestamp: float
    tone: str

    class Config:
        from_attributes = True


class AccountingActivityCreate(BaseModel):
    id: Optional[str] = None
    title: str = Field(..., max_length=255)
    subtitle: Optional[str] = Field(None, max_length=255)
    time: str = Field("Just now", max_length=50)
    timestamp: Optional[float] = None
    tone: str = Field("info", max_length=20)


class AccountingProfileResponse(BaseModel):
    id: str
    full_name: str
    role: str
    organization: str
    auto_reconciliation: bool
    notifications_enabled: bool
    updated_at: datetime


class AccountingProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, max_length=120)
    role: Optional[str] = Field(None, max_length=80)
    organization: Optional[str] = Field(None, max_length=120)
    auto_reconciliation: Optional[bool] = None
    notifications_enabled: Optional[bool] = None
