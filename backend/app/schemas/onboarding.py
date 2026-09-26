from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

BusinessType = Literal["Retail", "Wholesale", "Manufacturing"]
TeamSize = Literal["Just me", "2-10", "11-50", "51+"]
TaxMode = Literal["included", "added_at_sale"]
AutomationMode = Literal["off", "suggest", "automatic"]
IntegrationStatus = Literal["skipped", "saved"]
OnboardingStep = Literal["company", "connections", "ai", "review", "done"]

AUTOMATION_FUNCTIONS = (
    "reconcile",
    "flag_anomalies",
    "reorder",
    "customer_replies",
    "forecast",
)


class CompanyProfileOut(BaseModel):
    company_name: str
    business_type: BusinessType
    team_size: TeamSize
    country: str
    currency: str
    tax_mode: TaxMode
    current_step: OnboardingStep
    completed: bool
    completed_at: Optional[datetime] = None
    tour_dismissed: bool = False


class CompanyProfileUpdate(BaseModel):
    company_name: str = Field(min_length=1, max_length=120)
    business_type: BusinessType
    team_size: TeamSize = "Just me"
    country: str = Field(default="", max_length=80)
    currency: str = Field(default="USD", max_length=8)
    tax_mode: TaxMode = "added_at_sale"
    current_step: Optional[OnboardingStep] = None


class IntegrationOut(BaseModel):
    provider_id: str
    category: str
    status: IntegrationStatus
    key_last4: Optional[str] = None
    updated_at: Optional[datetime] = None


class IntegrationConnect(BaseModel):
    provider_id: str = Field(min_length=1, max_length=64)
    category: str = Field(min_length=1, max_length=40)
    api_key: str = Field(default="", max_length=512)


class IntegrationSkip(BaseModel):
    provider_id: str = Field(min_length=1, max_length=64)
    category: str = Field(min_length=1, max_length=40)


class AutomationOut(BaseModel):
    function_id: str
    mode: AutomationMode


class AutomationUpdate(BaseModel):
    function_id: str
    mode: AutomationMode


class AutomationsBulkUpdate(BaseModel):
    items: List[AutomationUpdate]


class CompleteOnboardingRequest(BaseModel):
    pass


class TourDismissRequest(BaseModel):
    dismissed: bool = True


class OnboardingStateOut(BaseModel):
    profile: CompanyProfileOut
    integrations: List[IntegrationOut]
    automations: List[AutomationOut]
