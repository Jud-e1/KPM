import time
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.accounting import (
    AccountingActivityModel,
    AccountingProfileModel,
    AccountingTransactionModel,
)
from app.schemas.accounting import (
    AccountingActivityCreate,
    AccountingActivityResponse,
    AccountingProfileResponse,
    AccountingProfileUpdate,
    AccountingSummaryResponse,
    AccountingTransactionCreate,
    AccountingTransactionResponse,
    AccountingTransactionUpdate,
)

router = APIRouter()


def get_or_create_profile(db: Session) -> AccountingProfileModel:
    profile = db.query(AccountingProfileModel).filter(AccountingProfileModel.id == "default").first()
    if profile:
        return profile
    profile = AccountingProfileModel(id="default")
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def serialize_profile(profile: AccountingProfileModel) -> AccountingProfileResponse:
    return AccountingProfileResponse(
        id=profile.id,
        full_name=profile.full_name,
        role=profile.role,
        organization=profile.organization,
        auto_reconciliation=profile.auto_reconciliation == "true",
        notifications_enabled=profile.notifications_enabled == "true",
        updated_at=profile.updated_at,
    )


@router.get("/profile", response_model=AccountingProfileResponse, summary="Get accounting profile settings")
def get_profile(db: Session = Depends(get_db)):
    return serialize_profile(get_or_create_profile(db))


@router.put("/profile", response_model=AccountingProfileResponse, summary="Update accounting profile settings")
def update_profile(updates: AccountingProfileUpdate, db: Session = Depends(get_db)):
    profile = get_or_create_profile(db)
    for field, value in updates.model_dump(exclude_unset=True).items():
        if field in {"auto_reconciliation", "notifications_enabled"}:
            setattr(profile, field, "true" if value else "false")
        else:
            setattr(profile, field, value)
    try:
        db.commit()
        db.refresh(profile)
        return serialize_profile(profile)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error))


@router.get("/summary", response_model=AccountingSummaryResponse, summary="Get accounting change token and totals")
def get_accounting_summary(db: Session = Depends(get_db)):
    row = db.query(
        func.count(AccountingTransactionModel.id),
        func.coalesce(
            func.sum(case((AccountingTransactionModel.transaction_type == "Income", AccountingTransactionModel.amount), else_=0.0)),
            0.0,
        ),
        func.coalesce(
            func.sum(case((AccountingTransactionModel.transaction_type == "Expense", AccountingTransactionModel.amount), else_=0.0)),
            0.0,
        ),
        func.coalesce(
            func.sum(case((AccountingTransactionModel.status == "Pending", AccountingTransactionModel.amount), else_=0.0)),
            0.0,
        ),
        func.max(AccountingTransactionModel.updated_at),
    ).one()
    total, income, expenses, pending, updated_at = row
    profile = get_or_create_profile(db)
    activity_updated_at = db.query(func.max(AccountingActivityModel.created_at)).scalar()
    transaction_revision = "empty" if updated_at is None else updated_at.isoformat()
    profile_revision = profile.updated_at.isoformat() if profile.updated_at else "empty"
    activities_revision = "empty" if activity_updated_at is None else activity_updated_at.isoformat()
    revision = f"{transaction_revision}:{profile_revision}:{activities_revision}:{total}:{income}:{expenses}:{pending}"
    return AccountingSummaryResponse(
        revision=revision,
        transactions_revision=transaction_revision,
        profile_revision=profile_revision,
        activities_revision=activities_revision,
        total_transactions=total or 0,
        income=float(income or 0),
        expenses=float(expenses or 0),
        pending_amount=float(pending or 0),
    )


@router.get("/activities", response_model=List[AccountingActivityResponse], summary="List recent accounting activity")
def list_activities(
    limit: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    return (
        db.query(AccountingActivityModel)
        .order_by(AccountingActivityModel.timestamp.desc())
        .limit(limit)
        .all()
    )


@router.post("/activities", response_model=AccountingActivityResponse, status_code=status.HTTP_201_CREATED, summary="Record accounting activity")
def create_activity(activity_in: AccountingActivityCreate, db: Session = Depends(get_db)):
    activity_id = activity_in.id or f"activity-{uuid.uuid4().hex[:10]}"
    existing = db.query(AccountingActivityModel).filter(AccountingActivityModel.id == activity_id).first()
    if existing:
        return existing

    activity = AccountingActivityModel(
        id=activity_id,
        title=activity_in.title,
        subtitle=activity_in.subtitle,
        time=activity_in.time or "Just now",
        timestamp=activity_in.timestamp if activity_in.timestamp is not None else time.time() * 1000,
        tone=activity_in.tone or "info",
    )
    try:
        db.add(activity)
        db.commit()
        db.refresh(activity)
        return activity
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error))


@router.get("/", response_model=List[AccountingTransactionResponse], summary="List accounting transactions")
def list_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    transaction_type: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(AccountingTransactionModel)
    if transaction_type and transaction_type.lower() != "all":
        query = query.filter(AccountingTransactionModel.transaction_type == transaction_type)
    if category and category.lower() != "all":
        query = query.filter(AccountingTransactionModel.category == category)
    if search:
        value = f"%{search}%"
        query = query.filter(
            or_(
                AccountingTransactionModel.description.ilike(value),
                AccountingTransactionModel.reference.ilike(value),
                AccountingTransactionModel.account.ilike(value),
            )
        )
    return query.order_by(AccountingTransactionModel.transaction_date.desc()).offset(skip).limit(limit).all()


@router.post("/", response_model=AccountingTransactionResponse, status_code=status.HTTP_201_CREATED, summary="Create accounting transaction")
def create_transaction(transaction_in: AccountingTransactionCreate, db: Session = Depends(get_db)):
    transaction_id = transaction_in.id or f"txn-{uuid.uuid4().hex[:10]}"
    if db.query(AccountingTransactionModel).filter(AccountingTransactionModel.id == transaction_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Transaction '{transaction_id}' already exists.")

    transaction = AccountingTransactionModel(
        id=transaction_id,
        transaction_date=transaction_in.transaction_date,
        description=transaction_in.description,
        reference=transaction_in.reference,
        counterparty=transaction_in.counterparty,
        category=transaction_in.category,
        account=transaction_in.account,
        transaction_type=transaction_in.transaction_type,
        amount=transaction_in.amount,
        status=transaction_in.status,
    )
    try:
        db.add(transaction)
        db.commit()
        db.refresh(transaction)
        return transaction
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error))


@router.put("/{transaction_id}", response_model=AccountingTransactionResponse, summary="Update accounting transaction")
def update_transaction(transaction_id: str, updates: AccountingTransactionUpdate, db: Session = Depends(get_db)):
    transaction = db.query(AccountingTransactionModel).filter(AccountingTransactionModel.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(transaction, field, value)
    try:
        db.commit()
        db.refresh(transaction)
        return transaction
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error))


@router.delete("/{transaction_id}", summary="Delete accounting transaction")
def delete_transaction(transaction_id: str, db: Session = Depends(get_db)):
    transaction = db.query(AccountingTransactionModel).filter(AccountingTransactionModel.id == transaction_id).first()
    if not transaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    try:
        db.delete(transaction)
        db.commit()
        return {"message": f"Transaction {transaction_id} deleted successfully", "id": transaction_id}
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error))
