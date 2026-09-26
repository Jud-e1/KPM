from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


class MlProposalIn(BaseModel):
    business_id: str
    kind: Literal["reconcile", "anomaly", "reorder", "forecast", "risk"]
    function_id: str = "reconcile"
    entity_type: str
    entity_id: str
    score: float = Field(ge=0.0, le=1.0)
    unique_top: bool = True
    second_score: Optional[float] = None
    model_version: str = "rules-v1"
    explanation: str = ""
    payload: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def _accept_tenant_alias(cls, data: Any) -> Any:
        if isinstance(data, dict) and "business_id" not in data and data.get("tenant_id"):
            data = {**data, "business_id": data["tenant_id"]}
        return data


class MlProposalOut(BaseModel):
    id: str
    business_id: str
    kind: str
    function_id: str
    entity_type: str
    entity_id: str
    score: float
    unique_top: str
    model_version: str
    explanation: str
    payload_json: str
    status: str
    decision: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("id", "business_id", "entity_id", mode="before")
    @classmethod
    def _uuid_to_str(cls, v: Any) -> str:
        if isinstance(v, UUID):
            return str(v)
        return str(v)


class MlAuditOut(BaseModel):
    id: str
    business_id: str
    proposal_id: Optional[str] = None
    kind: str
    action: str
    model_version: str
    score: float
    explanation: str
    entity_type: str
    entity_id: str
    undo_payload: str
    undone: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("id", "business_id", "proposal_id", "entity_id", mode="before")
    @classmethod
    def _uuid_to_str(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, UUID):
            return str(v)
        return str(v)


class MlFlagOut(BaseModel):
    id: str
    business_id: str
    entity_type: str
    entity_id: str
    rule_ids: str
    score: float
    severity: str
    explanation: str
    model_version: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("id", "business_id", "entity_id", mode="before")
    @classmethod
    def _uuid_to_str(cls, v: Any) -> str:
        if isinstance(v, UUID):
            return str(v)
        return str(v)


class MlAcceptResponse(BaseModel):
    proposal_id: str
    decision: str
    status: str
    audit_id: Optional[str] = None
    message: str
