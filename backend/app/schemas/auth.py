from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserSignup(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=120)
    organization: Optional[str] = Field(None, max_length=120)
    business_type: Optional[str] = Field(None, max_length=120)
    invite_token: Optional[str] = None


class UserLogin(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    organization: Optional[str] = None
    business_type: Optional[str] = None
    business_id: Optional[str] = None
    role: str
    is_active: bool
    email_verified: bool = False
    plan: str = "free"
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=120)
    organization: Optional[str] = Field(None, max_length=120)
    business_type: Optional[str] = Field(None, max_length=120)
    role: Optional[str] = Field(None, max_length=80)


class PasswordResetRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)


class PasswordResetConfirm(BaseModel):
    token: str = Field(..., min_length=10)
    password: str = Field(..., min_length=8, max_length=128)


class EmailVerifyRequest(BaseModel):
    token: str = Field(..., min_length=10)


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(..., min_length=20)
