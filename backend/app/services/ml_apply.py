"""Apply ML proposals under tenant autonomy policy with audit + undo."""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.autonomy import decide, is_unique_top
from app.models.accounting import AccountingActivityModel, AccountingTransactionModel
from app.models.ml import (
    MlAnomalyFlagModel,
    MlAuditActionModel,
    MlMatchLinkModel,
    MlProposalModel,
    new_id,
)
from app.models.onboarding import OnboardingAutomationModel
from app.models.sales import SalesOrderModel


FUNCTION_MODE_MAP = {
    "reconcile": "reconcile",
    "flag_anomalies": "flag_anomalies",
    "anomaly": "flag_anomalies",
    "reorder": "reorder",
    "forecast": "forecast",
    "risk": "flag_anomalies",
}


def _automation_mode(db: Session, tenant_id: str, function_id: str) -> str:
    key = FUNCTION_MODE_MAP.get(function_id, function_id)
    row = (
        db.query(OnboardingAutomationModel)
        .filter(
            OnboardingAutomationModel.business_id == tenant_id,
            OnboardingAutomationModel.function_id == key,
        )
        .first()
    )
    return (row.mode if row else "suggest") or "suggest"


def _activity(
    db: Session,
    tenant_id: str,
    *,
    kind: str,
    title: str,
    detail: str,
    tone: str = "info",
) -> None:
    now = datetime.utcnow()
    db.add(
        AccountingActivityModel(
            id=new_id("act"),
            business_id=tenant_id,
            title=title,
            subtitle=detail[:255] if detail else kind,
            time="Just now",
            timestamp=now.timestamp(),
            tone=tone,
            created_at=now,
        )
    )


def accept_proposal(db: Session, body: dict[str, Any]) -> dict[str, Any]:
    tenant_id = body["business_id"]
    kind = body["kind"]
    function_id = body.get("function_id") or ("reconcile" if kind == "reconcile" else "flag_anomalies")
    score = float(body.get("score") or 0.0)
    unique = bool(body.get("unique_top", True))
    if body.get("second_score") is not None:
        unique = is_unique_top(score, float(body["second_score"]))

    mode = _automation_mode(db, tenant_id, function_id)
    # reconcile + reorder can auto-apply; anomaly/forecast/risk stay suggest/flag only
    allow_auto_apply = kind in ("reconcile", "reorder")

    result = decide(
        mode,
        score,
        unique=unique,
        allow_auto_apply=allow_auto_apply,
    )

    proposal = MlProposalModel(
        id=new_id("mlp"),
        business_id=tenant_id,
        kind=kind,
        function_id=function_id,
        entity_type=body["entity_type"],
        entity_id=body["entity_id"],
        score=score,
        unique_top="true" if unique else "false",
        model_version=body.get("model_version") or "rules-v1",
        explanation=body.get("explanation") or "",
        payload_json=json.dumps(body.get("payload") or {}, default=str),
        status="pending",
        decision=result.decision,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(proposal)
    db.flush()

    if result.decision == "drop":
        proposal.status = "dismissed"
        db.commit()
        return {
            "proposal_id": proposal.id,
            "decision": "drop",
            "status": proposal.status,
            "audit_id": None,
            "message": result.reason,
        }

    if kind == "reconcile":
        return _apply_reconcile(db, proposal, result.decision, body, result.reason)
    if kind == "anomaly":
        return _apply_anomaly(db, proposal, result.decision, body, result.reason)
    if kind in ("reorder", "forecast", "risk"):
        return _apply_soft_proposal(db, proposal, result.decision, body, result.reason, kind=kind)
    return _apply_anomaly(db, proposal, result.decision, body, result.reason)


def apply_user_suggestion(db: Session, proposal_id: str, tenant_id: str) -> dict[str, Any]:
    """Human approves a suggested proposal → force auto apply path."""
    proposal = (
        db.query(MlProposalModel)
        .filter(MlProposalModel.id == proposal_id, MlProposalModel.business_id == tenant_id)
        .first()
    )
    if not proposal:
        return {"ok": False, "message": "Suggestion not found"}
    if proposal.status not in ("suggested", "pending"):
        return {"ok": False, "message": f"Cannot accept status={proposal.status}"}

    body = {
        "business_id": tenant_id,
        "kind": proposal.kind,
        "function_id": proposal.function_id,
        "entity_type": proposal.entity_type,
        "entity_id": proposal.entity_id,
        "score": proposal.score,
        "unique_top": proposal.unique_top == "true",
        "model_version": proposal.model_version,
        "explanation": proposal.explanation,
        "payload": json.loads(proposal.payload_json or "{}"),
    }
    # Delete the pending suggestion row and re-apply as forced auto
    db.delete(proposal)
    db.flush()
    body["_force_auto"] = True
    result = accept_proposal_forced(db, body)
    return {"ok": True, **result}


def dismiss_user_suggestion(db: Session, proposal_id: str, tenant_id: str) -> dict[str, Any]:
    proposal = (
        db.query(MlProposalModel)
        .filter(MlProposalModel.id == proposal_id, MlProposalModel.business_id == tenant_id)
        .first()
    )
    if not proposal:
        return {"ok": False, "message": "Suggestion not found"}
    proposal.status = "dismissed"
    proposal.updated_at = datetime.utcnow()
    _activity(
        db,
        tenant_id,
        kind="ml_dismiss",
        title="Suggestion dismissed",
        detail=proposal.explanation or proposal.kind,
        tone="info",
    )
    db.commit()
    return {"ok": True, "proposal_id": proposal.id, "status": "dismissed"}


def accept_proposal_forced(db: Session, body: dict[str, Any]) -> dict[str, Any]:
    """Like accept_proposal but always takes the auto/apply branch when possible."""
    tenant_id = body["business_id"]
    kind = body["kind"]
    function_id = body.get("function_id") or ("reconcile" if kind == "reconcile" else "flag_anomalies")
    score = float(body.get("score") or 0.0)
    unique = bool(body.get("unique_top", True))
    proposal = MlProposalModel(
        id=new_id("mlp"),
        business_id=tenant_id,
        kind=kind,
        function_id=function_id,
        entity_type=body["entity_type"],
        entity_id=body["entity_id"],
        score=score,
        unique_top="true" if unique else "false",
        model_version=body.get("model_version") or "rules-v1",
        explanation=body.get("explanation") or "",
        payload_json=json.dumps(body.get("payload") or {}, default=str),
        status="pending",
        decision="auto",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(proposal)
    db.flush()
    if kind == "reconcile":
        return _apply_reconcile(db, proposal, "auto", body, "Approved by user.")
    if kind == "anomaly":
        return _apply_anomaly(db, proposal, "auto", body, "Approved by user.")
    return _apply_soft_proposal(db, proposal, "auto", body, "Approved by user.", kind=kind)


def _apply_soft_proposal(
    db: Session,
    proposal: MlProposalModel,
    decision: str,
    body: dict[str, Any],
    reason: str,
    *,
    kind: str,
) -> dict[str, Any]:
    """forecast / reorder / risk — persist suggestion or draft without book voiding."""
    payload = body.get("payload") or {}
    if decision == "drop":
        proposal.status = "dismissed"
        db.commit()
        return {
            "proposal_id": proposal.id,
            "decision": "drop",
            "status": proposal.status,
            "audit_id": None,
            "message": reason,
        }

    if kind == "reorder" and decision == "auto":
        from app.models.purchasing import PurchaseDraftModel

        draft = PurchaseDraftModel(
            id=new_id("pod"),
            business_id=proposal.business_id,
            product_id=str(payload.get("product_id") or proposal.entity_id),
            sku=str(payload.get("sku") or ""),
            product_name=str(payload.get("product_name") or ""),
            qty=int(payload.get("qty") or 1),
            reason=proposal.explanation or "ROP suggest",
            status="draft",
            proposal_id=proposal.id,
            created_at=datetime.utcnow(),
        )
        db.add(draft)
        audit = _audit(
            db,
            proposal,
            action="apply",
            undo_payload={"type": "dismiss_draft", "draft_id": draft.id},
        )
        proposal.status = "applied"
        _activity(
            db,
            proposal.business_id,
            kind="ml_reorder",
            title="Draft purchase order created",
            detail=proposal.explanation or draft.sku,
            tone="success",
        )
        db.commit()
        return {
            "proposal_id": proposal.id,
            "decision": "auto",
            "status": proposal.status,
            "audit_id": audit.id,
            "message": reason,
        }

    proposal.status = "suggested" if decision == "suggest" else "applied"
    if kind == "reorder" and decision == "suggest":
        from app.models.purchasing import PurchaseDraftModel

        draft = PurchaseDraftModel(
            id=new_id("pod"),
            business_id=proposal.business_id,
            product_id=str(payload.get("product_id") or proposal.entity_id),
            sku=str(payload.get("sku") or ""),
            product_name=str(payload.get("product_name") or ""),
            qty=int(payload.get("qty") or 1),
            reason=proposal.explanation or "ROP suggest",
            status="suggested",
            proposal_id=proposal.id,
            created_at=datetime.utcnow(),
        )
        db.add(draft)
        payload = {**payload, "draft_id": draft.id}
        proposal.payload_json = json.dumps(payload, default=str)

    if kind == "risk":
        from app.models.ml import MlRiskScoreModel

        existing = (
            db.query(MlRiskScoreModel)
            .filter(
                MlRiskScoreModel.business_id == proposal.business_id,
                MlRiskScoreModel.partner_type == str(payload.get("partner_type") or proposal.entity_type),
                MlRiskScoreModel.partner_id == str(payload.get("partner_id") or proposal.entity_id),
            )
            .first()
        )
        if existing:
            existing.score = float(payload.get("score") or proposal.score or 0)
            existing.band = str(payload.get("band") or "low")
            existing.explanation = proposal.explanation or existing.explanation
            existing.factors_json = json.dumps(payload.get("factors") or {}, default=str)
            existing.updated_at = datetime.utcnow()
        else:
            db.add(
                MlRiskScoreModel(
                    id=new_id("mrs"),
                    business_id=proposal.business_id,
                    partner_type=str(payload.get("partner_type") or proposal.entity_type),
                    partner_id=str(payload.get("partner_id") or proposal.entity_id),
                    score=float(payload.get("score") or proposal.score or 0),
                    band=str(payload.get("band") or "low"),
                    explanation=proposal.explanation or "",
                    factors_json=json.dumps(payload.get("factors") or {}, default=str),
                    updated_at=datetime.utcnow(),
                )
            )
        proposal.status = "applied" if decision == "auto" else "suggested"

    audit = _audit(
        db,
        proposal,
        action="suggest" if decision == "suggest" else "apply",
        undo_payload={"type": "noop"},
    )
    _activity(
        db,
        proposal.business_id,
        kind=f"ml_{kind}",
        title=f"{kind.title()} suggestion",
        detail=proposal.explanation or kind,
        tone="info",
    )
    db.commit()
    return {
        "proposal_id": proposal.id,
        "decision": decision,
        "status": proposal.status,
        "audit_id": audit.id,
        "message": reason,
    }


def _apply_reconcile(
    db: Session,
    proposal: MlProposalModel,
    decision: str,
    body: dict[str, Any],
    reason: str,
) -> dict[str, Any]:
    payload = body.get("payload") or {}
    payment_id = payload.get("payment_id") or proposal.entity_id
    order_id = payload.get("matched_order_id") or payload.get("order_id")

    if decision == "suggest":
        proposal.status = "suggested"
        _activity(
            db,
            proposal.business_id,
            kind="ml_suggest",
            title="Reconciliation suggestion",
            detail=proposal.explanation or f"Match payment {payment_id} → order {order_id} (score {proposal.score:.2f})",
            tone="info",
        )
        audit = _audit(
            db,
            proposal,
            action="suggest",
            undo_payload={"type": "noop"},
        )
        db.commit()
        return {
            "proposal_id": proposal.id,
            "decision": "suggest",
            "status": proposal.status,
            "audit_id": audit.id,
            "message": reason,
        }

    # auto apply match link
    if not order_id:
        proposal.status = "suggested"
        db.commit()
        return {
            "proposal_id": proposal.id,
            "decision": "suggest",
            "status": proposal.status,
            "audit_id": None,
            "message": "Missing matched_order_id; kept as suggestion.",
        }

    existing = (
        db.query(MlMatchLinkModel)
        .filter(MlMatchLinkModel.payment_id == payment_id)
        .first()
    )
    if existing:
        proposal.status = "dismissed"
        db.commit()
        return {
            "proposal_id": proposal.id,
            "decision": "drop",
            "status": proposal.status,
            "audit_id": None,
            "message": "Payment already matched.",
        }

    order = (
        db.query(SalesOrderModel)
        .filter(SalesOrderModel.id == order_id, SalesOrderModel.business_id == proposal.business_id)
        .first()
    )
    payment = (
        db.query(AccountingTransactionModel)
        .filter(
            AccountingTransactionModel.id == payment_id,
            AccountingTransactionModel.business_id == proposal.business_id,
        )
        .first()
    )
    if not order or not payment:
        proposal.status = "suggested"
        db.commit()
        return {
            "proposal_id": proposal.id,
            "decision": "suggest",
            "status": proposal.status,
            "audit_id": None,
            "message": "Entities not found; kept as suggestion.",
        }

    prev_status = payment.status
    payment.status = "Matched"
    link = MlMatchLinkModel(
        id=new_id("lnk"),
        business_id=proposal.business_id,
        payment_id=payment_id,
        order_id=order_id,
        score=proposal.score,
        model_version=proposal.model_version,
        created_at=datetime.utcnow(),
    )
    db.add(link)
    audit = _audit(
        db,
        proposal,
        action="apply",
        undo_payload={
            "type": "unlink_match",
            "payment_id": payment_id,
            "order_id": order_id,
            "link_id": link.id,
            "prev_payment_status": prev_status,
        },
    )
    link.audit_id = audit.id
    proposal.status = "applied"
    _activity(
        db,
        proposal.business_id,
        kind="ml_auto",
        title="Payment auto-matched",
        detail=proposal.explanation or f"Linked {payment_id} to {order.order_number}",
        tone="success",
    )
    db.commit()
    return {
        "proposal_id": proposal.id,
        "decision": "auto",
        "status": proposal.status,
        "audit_id": audit.id,
        "message": reason,
    }


def _apply_anomaly(
    db: Session,
    proposal: MlProposalModel,
    decision: str,
    body: dict[str, Any],
    reason: str,
) -> dict[str, Any]:
    """Anomaly Auto never edits books — always creates a flag."""
    payload = body.get("payload") or {}
    severity = payload.get("severity") or ("hard" if proposal.score >= 0.85 else "soft")
    rule_ids = ",".join(payload.get("rule_ids") or [])

    flag = MlAnomalyFlagModel(
        id=new_id("flg"),
        business_id=proposal.business_id,
        entity_type=proposal.entity_type,
        entity_id=proposal.entity_id,
        rule_ids=rule_ids,
        score=proposal.score,
        severity=severity,
        explanation=proposal.explanation,
        model_version=proposal.model_version,
        status="open",
        created_at=datetime.utcnow(),
    )
    db.add(flag)
    action = "flag" if decision in ("auto", "suggest") else "suggest"
    audit = _audit(
        db,
        proposal,
        action=action,
        undo_payload={"type": "dismiss_flag", "flag_id": flag.id},
    )
    flag.audit_id = audit.id
    proposal.status = "applied" if decision == "auto" else "suggested"
    # Even on "auto", we only flagged — books untouched
    if decision == "auto":
        proposal.status = "applied"

    _activity(
        db,
        proposal.business_id,
        kind="ml_flag",
        title="Anomaly flagged",
        detail=proposal.explanation or f"{proposal.entity_type}:{proposal.entity_id}",
        tone="warning",
    )
    db.commit()
    return {
        "proposal_id": proposal.id,
        "decision": decision,
        "status": proposal.status,
        "audit_id": audit.id,
        "message": reason,
    }


def _audit(
    db: Session,
    proposal: MlProposalModel,
    *,
    action: str,
    undo_payload: dict[str, Any],
) -> MlAuditActionModel:
    row = MlAuditActionModel(
        id=new_id("aud"),
        business_id=proposal.business_id,
        proposal_id=proposal.id,
        kind=proposal.kind,
        action=action,
        model_version=proposal.model_version,
        score=proposal.score,
        explanation=proposal.explanation,
        entity_type=proposal.entity_type,
        entity_id=proposal.entity_id,
        undo_payload=json.dumps(undo_payload, default=str),
        undone="false",
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.flush()
    return row


def undo_audit(db: Session, audit_id: str, tenant_id: str) -> dict[str, Any]:
    audit = (
        db.query(MlAuditActionModel)
        .filter(MlAuditActionModel.id == audit_id, MlAuditActionModel.business_id == tenant_id)
        .first()
    )
    if not audit:
        return {"ok": False, "message": "Audit action not found"}
    if audit.undone == "true":
        return {"ok": True, "message": "Already undone"}

    payload = json.loads(audit.undo_payload or "{}")
    undo_type = payload.get("type")

    if undo_type == "unlink_match":
        link = (
            db.query(MlMatchLinkModel)
            .filter(MlMatchLinkModel.id == payload.get("link_id"))
            .first()
        )
        if link:
            db.delete(link)
        payment = (
            db.query(AccountingTransactionModel)
            .filter(
                AccountingTransactionModel.id == payload.get("payment_id"),
                AccountingTransactionModel.business_id == tenant_id,
            )
            .first()
        )
        if payment:
            payment.status = payload.get("prev_payment_status") or "Posted"
        if audit.proposal_id:
            prop = db.query(MlProposalModel).filter(MlProposalModel.id == audit.proposal_id).first()
            if prop:
                prop.status = "undone"
        _activity(
            db,
            tenant_id,
            kind="ml_undo",
            title="Match undone",
            detail=f"Unlinked payment {payload.get('payment_id')}",
            tone="info",
        )
    elif undo_type == "dismiss_flag":
        flag = (
            db.query(MlAnomalyFlagModel)
            .filter(
                MlAnomalyFlagModel.id == payload.get("flag_id"),
                MlAnomalyFlagModel.business_id == tenant_id,
            )
            .first()
        )
        if flag:
            flag.status = "dismissed"
        if audit.proposal_id:
            prop = db.query(MlProposalModel).filter(MlProposalModel.id == audit.proposal_id).first()
            if prop:
                prop.status = "undone"
        _activity(
            db,
            tenant_id,
            kind="ml_undo",
            title="Anomaly flag cleared",
            detail=f"Dismissed flag {payload.get('flag_id')}",
            tone="info",
        )
    elif undo_type == "dismiss_draft":
        from app.models.purchasing import PurchaseDraftModel

        draft = (
            db.query(PurchaseDraftModel)
            .filter(
                PurchaseDraftModel.id == payload.get("draft_id"),
                PurchaseDraftModel.business_id == tenant_id,
            )
            .first()
        )
        if draft:
            draft.status = "cancelled"
        if audit.proposal_id:
            prop = db.query(MlProposalModel).filter(MlProposalModel.id == audit.proposal_id).first()
            if prop:
                prop.status = "undone"
        _activity(
            db,
            tenant_id,
            kind="ml_undo",
            title="Draft PO cancelled",
            detail=f"Cancelled draft {payload.get('draft_id')}",
            tone="info",
        )
    elif undo_type == "noop":
        if audit.proposal_id:
            prop = db.query(MlProposalModel).filter(MlProposalModel.id == audit.proposal_id).first()
            if prop:
                prop.status = "dismissed"
    else:
        return {"ok": False, "message": f"Unknown undo type: {undo_type}"}

    audit.undone = "true"
    db.commit()
    return {"ok": True, "message": "Undone", "audit_id": audit.id}
