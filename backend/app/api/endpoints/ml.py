"""Internal ML gateway + user-facing suggestions / undo."""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenancy import require_business_id
from app.models.ml import MlAnomalyFlagModel, MlAuditActionModel, MlEventModel, MlProposalModel
from app.models.user import User
from app.schemas.ml import (
    MlAcceptResponse,
    MlAuditOut,
    MlFlagOut,
    MlProposalIn,
    MlProposalOut,
)
from app.services.ml_apply import (
    accept_proposal,
    apply_user_suggestion,
    dismiss_user_suggestion,
    undo_audit,
)

router = APIRouter()


def _require_service_token(x_ml_service_token: Optional[str] = Header(default=None)) -> None:
    expected = settings.ML_SERVICE_TOKEN
    if not expected:
        return  # open in local/dev when unset
    if not x_ml_service_token or x_ml_service_token != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid ML service token")


@router.post("/internal/proposals", response_model=MlAcceptResponse)
def ingest_proposal(
    body: MlProposalIn,
    db: Session = Depends(get_db),
    _: None = Depends(_require_service_token),
):
    result = accept_proposal(db, body.model_dump())
    return MlAcceptResponse(**result)


@router.get("/suggestions", response_model=List[MlProposalOut])
def list_suggestions(
    status_filter: Optional[str] = Query("suggested", alias="status"),
    kind: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(MlProposalModel).filter(MlProposalModel.business_id == require_business_id(current_user))
    if status_filter and status_filter.lower() != "all":
        q = q.filter(MlProposalModel.status == status_filter)
    if kind:
        q = q.filter(MlProposalModel.kind == kind)
    return q.order_by(MlProposalModel.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/suggestions/{proposal_id}/accept")
def accept_suggestion(
    proposal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = apply_user_suggestion(db, proposal_id, require_business_id(current_user))
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("message", "Accept failed"))
    return result


@router.post("/suggestions/{proposal_id}/dismiss")
def dismiss_suggestion(
    proposal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = dismiss_user_suggestion(db, proposal_id, require_business_id(current_user))
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("message", "Dismiss failed"))
    return result


@router.post("/flags/{flag_id}/dismiss")
def dismiss_flag(
    flag_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = (
        db.query(MlAnomalyFlagModel)
        .filter(MlAnomalyFlagModel.id == flag_id, MlAnomalyFlagModel.business_id == require_business_id(current_user))
        .first()
    )
    if not flag:
        raise HTTPException(status_code=404, detail="Flag not found")
    flag.status = "dismissed"
    db.commit()
    return {"ok": True, "id": flag_id, "status": "dismissed"}


@router.get("/flags", response_model=List[MlFlagOut])
def list_flags(
    status_filter: Optional[str] = Query("open", alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(MlAnomalyFlagModel).filter(MlAnomalyFlagModel.business_id == require_business_id(current_user))
    if status_filter and status_filter.lower() != "all":
        q = q.filter(MlAnomalyFlagModel.status == status_filter)
    return q.order_by(MlAnomalyFlagModel.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/audit", response_model=List[MlAuditOut])
def list_audit(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(MlAuditActionModel)
        .filter(MlAuditActionModel.business_id == require_business_id(current_user))
        .order_by(MlAuditActionModel.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.post("/audit/{audit_id}/undo")
def undo_action(
    audit_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = undo_audit(db, audit_id, require_business_id(current_user))
    if not result.get("ok") and result.get("message") == "Audit action not found":
        raise HTTPException(status_code=404, detail=result["message"])
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("message", "Undo failed"))
    return result


@router.get("/events/pending")
def list_pending_events(
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    _: None = Depends(_require_service_token),
):
    rows = (
        db.query(MlEventModel)
        .filter(MlEventModel.processed_at.is_(None))
        .order_by(MlEventModel.created_at.asc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "business_id": str(r.business_id),
            "event_type": r.event_type,
            "payload_json": r.payload_json,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/events/{event_id}/processed")
def mark_event_processed(
    event_id: str,
    db: Session = Depends(get_db),
    _: None = Depends(_require_service_token),
):
    from datetime import datetime

    row = db.query(MlEventModel).filter(MlEventModel.id == event_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Event not found")
    row.processed_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "id": event_id}
