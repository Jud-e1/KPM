import csv
import io
import time
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import case, func, or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.ml_events import emit_ml_event
from app.core.security import get_current_user
from app.core.tenancy import require_business_id
from app.core.types import coerce_uuid, new_uuid
from app.models.accounting import (
    AccountingActivityModel,
    AccountingProfileModel,
    AccountingTransactionModel,
)
from app.models.user import User
from app.schemas.accounting import (
    AccountingActivityCreate,
    AccountingActivityResponse,
    AccountingCsvImportResponse,
    AccountingProfileResponse,
    AccountingProfileUpdate,
    AccountingSummaryResponse,
    AccountingTransactionCreate,
    AccountingTransactionResponse,
    AccountingTransactionUpdate,
)

router = APIRouter()


def get_or_create_profile(db: Session, user: User) -> AccountingProfileModel:
    profile = (
        db.query(AccountingProfileModel)
        .filter(
            (AccountingProfileModel.id == user.id) | (AccountingProfileModel.business_id == user.id)
        )
        .first()
    )
    if profile:
        if not profile.business_id:
            profile.business_id = user.id
            db.commit()
            db.refresh(profile)
        return profile
    profile = AccountingProfileModel(
        id=user.id,
        business_id=user.id,
        full_name=user.full_name,
        role=user.role or "Admin",
        organization=user.organization or user.full_name,
    )
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


@router.get("/profile", response_model=AccountingProfileResponse)
def get_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return serialize_profile(get_or_create_profile(db, current_user))


@router.put("/profile", response_model=AccountingProfileResponse)
def update_profile(
    updates: AccountingProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = get_or_create_profile(db, current_user)
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
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/summary", response_model=AccountingSummaryResponse)
def get_accounting_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = (
        db.query(
            func.count(AccountingTransactionModel.id),
            func.coalesce(
                func.sum(
                    case(
                        (AccountingTransactionModel.transaction_type == "Income", AccountingTransactionModel.amount),
                        else_=0.0,
                    )
                ),
                0.0,
            ),
            func.coalesce(
                func.sum(
                    case(
                        (AccountingTransactionModel.transaction_type == "Expense", AccountingTransactionModel.amount),
                        else_=0.0,
                    )
                ),
                0.0,
            ),
            func.coalesce(
                func.sum(
                    case(
                        (AccountingTransactionModel.status == "Pending", AccountingTransactionModel.amount),
                        else_=0.0,
                    )
                ),
                0.0,
            ),
            func.max(AccountingTransactionModel.updated_at),
        )
        .filter(AccountingTransactionModel.business_id == require_business_id(current_user))
        .one()
    )
    total, income, expenses, pending, updated_at = row
    profile = get_or_create_profile(db, current_user)
    activity_updated_at = (
        db.query(func.max(AccountingActivityModel.created_at))
        .filter(AccountingActivityModel.business_id == require_business_id(current_user))
        .scalar()
    )
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


@router.get("/activities", response_model=List[AccountingActivityResponse])
def list_activities(
    limit: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(AccountingActivityModel)
        .filter(AccountingActivityModel.business_id == require_business_id(current_user))
        .order_by(AccountingActivityModel.timestamp.desc())
        .limit(limit)
        .all()
    )


@router.post("/activities", response_model=AccountingActivityResponse, status_code=status.HTTP_201_CREATED)
def create_activity(
    activity_in: AccountingActivityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    activity_id = coerce_uuid(activity_in.id)
    existing = db.query(AccountingActivityModel).filter(AccountingActivityModel.id == activity_id).first()
    if existing and existing.business_id == require_business_id(current_user):
        return existing
    if existing and existing.business_id != require_business_id(current_user):
        activity_id = new_uuid()

    activity = AccountingActivityModel(
        id=activity_id,
        business_id=require_business_id(current_user),
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
        raise HTTPException(status_code=500, detail=str(error))


@router.get("/", response_model=List[AccountingTransactionResponse])
def list_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    transaction_type: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(AccountingTransactionModel).filter(AccountingTransactionModel.business_id == require_business_id(current_user))
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


@router.post("/", response_model=AccountingTransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    transaction_in: AccountingTransactionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transaction_id = coerce_uuid(transaction_in.id)
    existing = db.query(AccountingTransactionModel).filter(AccountingTransactionModel.id == transaction_id).first()
    if existing and existing.business_id == require_business_id(current_user):
        return existing
    if existing and existing.business_id != require_business_id(current_user):
        transaction_id = new_uuid()

    transaction = AccountingTransactionModel(
        id=transaction_id,
        business_id=require_business_id(current_user),
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
        db.flush()
        event_type = (
            "payment.received"
            if (transaction.transaction_type or "").lower() in ("credit", "income", "payment", "inflow")
            or (transaction.amount or 0) > 0
            else "transaction.created"
        )
        emit_ml_event(
            db,
            business_id=require_business_id(current_user),
            event_type=event_type,
            payload={
                "transaction_id": transaction.id,
                "transaction_date": transaction.transaction_date,
                "description": transaction.description,
                "reference": transaction.reference,
                "counterparty": transaction.counterparty,
                "category": transaction.category,
                "account": transaction.account,
                "transaction_type": transaction.transaction_type,
                "amount": transaction.amount,
                "status": transaction.status,
            },
        )
        db.commit()
        db.refresh(transaction)
        return transaction
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(error))


@router.put("/{transaction_id}", response_model=AccountingTransactionResponse)
def update_transaction(
    transaction_id: str,
    updates: AccountingTransactionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transaction = (
        db.query(AccountingTransactionModel)
        .filter(
            AccountingTransactionModel.id == transaction_id,
            AccountingTransactionModel.business_id == require_business_id(current_user),
        )
        .first()
    )
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(transaction, field, value)
    try:
        db.commit()
        db.refresh(transaction)
        return transaction
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(error))


@router.post("/import-csv", response_model=AccountingCsvImportResponse)
async def import_transactions_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Import bank/ledger CSV with columns: date, description, reference, amount, type."""
    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV has no header row")

    def pick(row: dict, *names: str) -> str:
        lower = {str(k).strip().lower(): v for k, v in row.items() if k is not None}
        for name in names:
            if name in lower and lower[name] not in (None, ""):
                return str(lower[name]).strip()
        return ""

    imported = 0
    skipped = 0
    try:
        for row in reader:
            description = pick(row, "description", "desc", "memo", "narration") or "Imported transaction"
            reference = pick(row, "reference", "ref", "check", "cheque") or None
            amount_raw = pick(row, "amount", "value", "amt")
            type_raw = pick(row, "type", "transaction_type", "credit_debit", "cr_dr")
            date_raw = pick(row, "date", "transaction_date", "posted", "value_date")
            counterparty = pick(row, "counterparty", "payee", "payer", "name") or None
            try:
                amount = abs(float(str(amount_raw).replace(",", "").replace("$", "")))
            except ValueError:
                skipped += 1
                continue
            if amount <= 0:
                skipped += 1
                continue

            tx_type = "Expense"
            lowered = type_raw.lower()
            if lowered in ("income", "credit", "cr", "inflow", "payment", "deposit"):
                tx_type = "Income"
            elif lowered in ("transfer", "xfer"):
                tx_type = "Transfer"
            elif amount_raw.startswith("-") or str(amount_raw).strip().startswith("("):
                tx_type = "Expense"
            elif not type_raw and float(str(amount_raw).replace(",", "").replace("$", "") or 0) > 0 and "credit" in text.lower():
                tx_type = "Income"

            tx_date = datetime.utcnow()
            if date_raw:
                for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d", "%d-%m-%Y"):
                    try:
                        tx_date = datetime.strptime(date_raw[:10], fmt)
                        break
                    except ValueError:
                        continue

            txn = AccountingTransactionModel(
                id=new_uuid(),
                business_id=require_business_id(current_user),
                transaction_date=tx_date,
                description=description[:255],
                reference=(reference[:80] if reference else None),
                counterparty=(counterparty[:255] if counterparty else None),
                category="Sales Revenue" if tx_type == "Income" else "Other",
                account="Cash & Bank",
                transaction_type=tx_type,
                amount=amount,
                status="Cleared",
            )
            db.add(txn)
            db.flush()
            event_type = "payment.received" if tx_type == "Income" else "transaction.created"
            emit_ml_event(
                db,
                business_id=require_business_id(current_user),
                event_type=event_type,
                payload={
                    "transaction_id": txn.id,
                    "transaction_date": txn.transaction_date,
                    "description": txn.description,
                    "reference": txn.reference,
                    "counterparty": txn.counterparty,
                    "category": txn.category,
                    "account": txn.account,
                    "transaction_type": txn.transaction_type,
                    "amount": txn.amount,
                    "status": txn.status,
                },
            )
            imported += 1

        if imported:
            db.add(
                AccountingActivityModel(
                    id=new_uuid(),
                    business_id=require_business_id(current_user),
                    title=f"Imported {imported} transactions from CSV",
                    subtitle=file.filename or "bank.csv",
                    time="Just now",
                    timestamp=time.time(),
                    tone="info",
                )
            )
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(error))

    return AccountingCsvImportResponse(
        imported=imported,
        skipped=skipped,
        message=f"Imported {imported} row(s), skipped {skipped}.",
    )


@router.delete("/{transaction_id}")
def delete_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transaction = (
        db.query(AccountingTransactionModel)
        .filter(
            AccountingTransactionModel.id == transaction_id,
            AccountingTransactionModel.business_id == require_business_id(current_user),
        )
        .first()
    )
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    try:
        db.delete(transaction)
        db.commit()
        return {"message": f"Transaction {transaction_id} deleted successfully", "id": transaction_id}
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(error))
