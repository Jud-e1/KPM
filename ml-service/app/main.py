"""KPM ML service — scoring API + health."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.policy.autonomy import decide
from app.worker import poll_once
from app.services.anomaly import (
    IF_MIN_ROWS,
    build_anomaly_proposal,
    detect_anomaly,
    train_isolation_forest,
)
from app.services.reconciliation import build_reconcile_proposal, score_payment_against_orders

app = FastAPI(
    title="KPM ML Service",
    version="0.1.0",
    description="Tenant-scoped reconciliation and anomaly scoring for KPM.",
)


class ReconScoreRequest(BaseModel):
    tenant_id: str
    payment: dict[str, Any]
    open_orders: list[dict[str, Any]] = Field(default_factory=list)
    confirmed_match_count: int = 0


class AnomalyScoreRequest(BaseModel):
    tenant_id: str
    entity_type: str
    entity: dict[str, Any]
    sibling_orders: list[dict[str, Any]] = Field(default_factory=list)
    transactions: list[dict[str, Any]] = Field(default_factory=list)
    known_counterparties: list[str] = Field(default_factory=list)
    last_prices: dict[str, float] = Field(default_factory=dict)
    tx_count: int = 0
    context: dict[str, Any] = Field(default_factory=dict)


class TrainIFRequest(BaseModel):
    tenant_id: str
    rows: list[list[float]]
    version: str = "if-v1"


class AutonomyProbe(BaseModel):
    mode: str
    score: float
    unique: bool = True
    allow_auto_apply: bool = True


@app.get("/health")
def health():
    return {"status": "ok", "service": "kpm-ml", "version": "0.1.0"}


class TickResponse(BaseModel):
    processed: int


@app.api_route("/internal/tick", methods=["GET", "POST"], response_model=TickResponse)
def tick(authorization: str | None = Header(default=None), x_ml_service_token: str | None = Header(default=None)):
    expected = settings.ML_SERVICE_TOKEN
    bearer = (authorization or "").removeprefix("Bearer ").strip()
    if expected and x_ml_service_token != expected and bearer != expected:
        raise HTTPException(status_code=401, detail="Invalid ML service token")
    return TickResponse(processed=poll_once())


@app.post("/score/reconcile")
def score_reconcile(body: ReconScoreRequest):
    proposal = build_reconcile_proposal(
        body.tenant_id,
        body.payment,
        body.open_orders,
        confirmed_match_count=body.confirmed_match_count,
    )
    ranked = score_payment_against_orders(
        body.tenant_id,
        body.payment,
        body.open_orders,
        confirmed_match_count=body.confirmed_match_count,
    )
    return {
        "proposal": proposal,
        "candidates": [
            {
                "order_id": c.order_id,
                "order_number": c.order_number,
                "score": c.score,
                "explanation": c.explanation,
                "features": c.features,
                "model_version": c.model_version,
            }
            for c in ranked[:10]
        ],
    }


@app.post("/score/anomaly")
def score_anomaly(body: AnomalyScoreRequest):
    hit = detect_anomaly(
        body.tenant_id,
        entity_type=body.entity_type,
        entity=body.entity,
        sibling_orders=body.sibling_orders,
        transactions=body.transactions,
        known_counterparties=set(body.known_counterparties),
        last_prices=body.last_prices,
        tx_count=body.tx_count,
        context=body.context,
    )
    if not hit:
        return {"hit": None, "proposal": None}
    return {
        "hit": {
            "score": hit.score,
            "severity": hit.severity,
            "rule_ids": hit.rule_ids,
            "explanation": hit.explanation,
            "model_version": hit.model_version,
        },
        "proposal": build_anomaly_proposal(body.tenant_id, hit),
        "auto_semantics": "flag_only",
        "if_min_rows": IF_MIN_ROWS,
    }


@app.post("/train/anomaly-if")
def train_if(body: TrainIFRequest):
    version = train_isolation_forest(body.tenant_id, body.rows, body.version)
    return {"ok": True, "version": version, "n_rows": len(body.rows)}


@app.post("/policy/decide")
def policy_decide(body: AutonomyProbe):
    result = decide(
        body.mode,
        body.score,
        unique=body.unique,
        allow_auto_apply=body.allow_auto_apply,
    )
    return {"decision": result.decision, "reason": result.reason}
