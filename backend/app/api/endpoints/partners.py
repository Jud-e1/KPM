import json
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenancy import require_business_id
from app.core.types import coerce_uuid, new_uuid
from app.core.cache import cache_delete_prefix, cache_get, cache_set, summary_key
from app.models.partners import CustomerModel, SupplierModel, SupplierRequestModel
from app.models.ml import MlRiskScoreModel
from app.models.user import User
from app.schemas.partners import (
    CustomerCreate,
    CustomerResponse,
    CustomerSummaryResponse,
    CustomerUpdate,
    SupplierCreate,
    SupplierRequestCreate,
    SupplierRequestResponse,
    SupplierResponse,
    SupplierSummaryResponse,
    SupplierUpdate,
)

router = APIRouter()


def _invalidate_partner_cache(user: User, domain: str) -> None:
    try:
        cache_delete_prefix(summary_key(domain, str(require_business_id(user))))
    except Exception:
        pass


def serialize_customer(row: CustomerModel) -> CustomerResponse:
    return CustomerResponse(
        id=row.id,
        name=row.name,
        email=row.email,
        company=row.company,
        industry=row.industry,
        customer_type=row.customer_type,
        total_spent=row.total_spent,
        last_order=row.last_order,
        last_order_ts=row.last_order_ts,
        status=row.status,
        avatar_color=row.avatar_color,
        is_new=row.is_new,
        high_value=row.high_value,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def serialize_supplier(row: SupplierModel) -> SupplierResponse:
    try:
        categories = json.loads(row.categories or "[]")
    except json.JSONDecodeError:
        categories = []
    return SupplierResponse(
        id=row.id,
        name=row.name,
        initial=row.initial,
        accent=row.accent,
        categories=categories if isinstance(categories, list) else [],
        products=row.products,
        location=row.location,
        rating=row.rating,
        reviews=row.reviews,
        response_time=row.response_time,
        min_order=row.min_order,
        verified=row.verified,
        status=row.status,
        match_score=row.match_score,
        spend_this_month=row.spend_this_month,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("/customers/summary", response_model=CustomerSummaryResponse)
def customers_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bid = str(require_business_id(current_user))
    cached = cache_get(summary_key("customers", bid))
    if cached:
        return CustomerSummaryResponse(**cached)
    total = db.query(func.count(CustomerModel.id)).filter(CustomerModel.business_id == require_business_id(current_user)).scalar() or 0
    active = (
        db.query(func.count(CustomerModel.id))
        .filter(CustomerModel.business_id == require_business_id(current_user), CustomerModel.status == "Active")
        .scalar()
        or 0
    )
    updated_at = (
        db.query(func.max(CustomerModel.updated_at)).filter(CustomerModel.business_id == require_business_id(current_user)).scalar()
    )
    revision = "empty" if updated_at is None else f"{updated_at.isoformat()}:{total}:{active}"
    payload = {"revision": revision, "total_customers": total, "active_customers": active}
    cache_set(summary_key("customers", bid), payload)
    return CustomerSummaryResponse(**payload)


@router.get("/customers", response_model=List[CustomerResponse])
def list_customers(
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = Query(500, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(CustomerModel).filter(CustomerModel.business_id == require_business_id(current_user))
    if search:
        value = f"%{search}%"
        query = query.filter(
            (CustomerModel.name.ilike(value))
            | (CustomerModel.email.ilike(value))
            | (CustomerModel.company.ilike(value))
        )
    rows = query.order_by(CustomerModel.last_order_ts.desc()).offset(skip).limit(limit).all()
    return [serialize_customer(row) for row in rows]


@router.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    customer_id = coerce_uuid(payload.id)
    existing = db.query(CustomerModel).filter(CustomerModel.id == customer_id).first()
    if existing and existing.business_id == require_business_id(current_user):
        return serialize_customer(existing)
    if existing and existing.business_id != require_business_id(current_user):
        customer_id = new_uuid()

    row = CustomerModel(
        id=customer_id,
        business_id=require_business_id(current_user),
        name=payload.name,
        email=payload.email,
        company=payload.company,
        industry=payload.industry,
        customer_type=payload.customer_type,
        total_spent=payload.total_spent,
        last_order=payload.last_order,
        last_order_ts=payload.last_order_ts or 0,
        status=payload.status,
        avatar_color=payload.avatar_color,
        is_new=payload.is_new,
        high_value=payload.high_value,
    )
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(error))
    _invalidate_partner_cache(current_user, "customers")
    return serialize_customer(row)


@router.put("/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(CustomerModel)
        .filter(CustomerModel.id == customer_id, CustomerModel.business_id == require_business_id(current_user))
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    try:
        db.commit()
        db.refresh(row)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(error))
    _invalidate_partner_cache(current_user, "customers")
    return serialize_customer(row)


@router.delete("/customers/{customer_id}")
def delete_customer(
    customer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(CustomerModel)
        .filter(CustomerModel.id == customer_id, CustomerModel.business_id == require_business_id(current_user))
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(row)
    db.commit()
    _invalidate_partner_cache(current_user, "customers")
    return {"message": "deleted", "id": customer_id}


@router.get("/suppliers/summary", response_model=SupplierSummaryResponse)
def suppliers_summary(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    bid = str(require_business_id(current_user))
    cached = cache_get(summary_key("suppliers", bid))
    if cached:
        return SupplierSummaryResponse(**cached)
    total = db.query(func.count(SupplierModel.id)).filter(SupplierModel.business_id == require_business_id(current_user)).scalar() or 0
    active = (
        db.query(func.count(SupplierModel.id))
        .filter(SupplierModel.business_id == require_business_id(current_user), SupplierModel.status == "Active")
        .scalar()
        or 0
    )
    updated_at = (
        db.query(func.max(SupplierModel.updated_at)).filter(SupplierModel.business_id == require_business_id(current_user)).scalar()
    )
    revision = "empty" if updated_at is None else f"{updated_at.isoformat()}:{total}:{active}"
    payload = {"revision": revision, "total_suppliers": total, "active_suppliers": active}
    cache_set(summary_key("suppliers", bid), payload)
    return SupplierSummaryResponse(**payload)


@router.get("/suppliers", response_model=List[SupplierResponse])
def list_suppliers(
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = Query(500, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(SupplierModel).filter(SupplierModel.business_id == require_business_id(current_user))
    if search:
        value = f"%{search}%"
        query = query.filter((SupplierModel.name.ilike(value)) | (SupplierModel.location.ilike(value)))
    rows = query.order_by(SupplierModel.match_score.desc()).offset(skip).limit(limit).all()
    return [serialize_supplier(row) for row in rows]


@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    supplier_id = coerce_uuid(payload.id)
    existing = db.query(SupplierModel).filter(SupplierModel.id == supplier_id).first()
    if existing and existing.business_id == require_business_id(current_user):
        return serialize_supplier(existing)
    if existing and existing.business_id != require_business_id(current_user):
        supplier_id = new_uuid()

    row = SupplierModel(
        id=supplier_id,
        business_id=require_business_id(current_user),
        name=payload.name,
        initial=payload.initial or payload.name[:1].upper(),
        accent=payload.accent,
        categories=json.dumps(payload.categories or []),
        products=payload.products,
        location=payload.location,
        rating=payload.rating,
        reviews=payload.reviews,
        response_time=payload.response_time,
        min_order=payload.min_order,
        verified=payload.verified,
        status=payload.status,
        match_score=payload.match_score,
        spend_this_month=payload.spend_this_month,
    )
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(error))
    _invalidate_partner_cache(current_user, "suppliers")
    return serialize_supplier(row)


@router.put("/suppliers/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: str,
    payload: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(SupplierModel)
        .filter(SupplierModel.id == supplier_id, SupplierModel.business_id == require_business_id(current_user))
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Supplier not found")
    data = payload.model_dump(exclude_unset=True)
    if "categories" in data:
        data["categories"] = json.dumps(data["categories"] or [])
    for field, value in data.items():
        setattr(row, field, value)
    try:
        db.commit()
        db.refresh(row)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(error))
    _invalidate_partner_cache(current_user, "suppliers")
    return serialize_supplier(row)


@router.delete("/suppliers/{supplier_id}")
def delete_supplier(
    supplier_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(SupplierModel)
        .filter(SupplierModel.id == supplier_id, SupplierModel.business_id == require_business_id(current_user))
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(row)
    db.commit()
    _invalidate_partner_cache(current_user, "suppliers")
    return {"message": "deleted", "id": supplier_id}


@router.get("/supplier-requests", response_model=List[SupplierRequestResponse])
def list_supplier_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (
        db.query(SupplierRequestModel)
        .filter(SupplierRequestModel.business_id == require_business_id(current_user))
        .order_by(SupplierRequestModel.updated_at.desc())
        .limit(50)
        .all()
    )
    return [
        SupplierRequestResponse(
            id=row.id,
            need=row.need,
            category=row.category,
            budget=row.budget,
            created_at=row.created_at,
            status=row.status,
        )
        for row in rows
    ]


@router.post("/supplier-requests", response_model=SupplierRequestResponse, status_code=status.HTTP_201_CREATED)
def create_supplier_request(
    payload: SupplierRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request_id = coerce_uuid(payload.id)
    row = SupplierRequestModel(
        id=request_id,
        business_id=require_business_id(current_user),
        need=payload.need,
        category=payload.category,
        budget=payload.budget,
        created_at=payload.created_at or datetime.utcnow().isoformat(),
        status=payload.status,
    )
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(error))
    return SupplierRequestResponse(
        id=row.id,
        need=row.need,
        category=row.category,
        budget=row.budget,
        created_at=row.created_at,
        status=row.status,
    )


class RiskScoreOut(BaseModel):
    partner_type: str
    partner_id: str
    score: float
    band: str
    explanation: str
    factors: dict
    updated_at: Optional[str] = None


@router.get("/risk-scores", response_model=List[RiskScoreOut])
def list_risk_scores(
    partner_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(MlRiskScoreModel).filter(MlRiskScoreModel.business_id == require_business_id(current_user))
    if partner_type:
        q = q.filter(MlRiskScoreModel.partner_type == partner_type)
    rows = q.order_by(MlRiskScoreModel.updated_at.desc()).limit(200).all()
    out: list[RiskScoreOut] = []
    for row in rows:
        try:
            factors = json.loads(row.factors_json or "{}")
        except json.JSONDecodeError:
            factors = {}
        out.append(
            RiskScoreOut(
                partner_type=row.partner_type,
                partner_id=row.partner_id,
                score=float(row.score or 0),
                band=row.band,
                explanation=row.explanation or "",
                factors=factors if isinstance(factors, dict) else {},
                updated_at=row.updated_at.isoformat() if row.updated_at else None,
            )
        )
    return out
