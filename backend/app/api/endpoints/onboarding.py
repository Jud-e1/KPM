import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.secrets import encrypt_secret
from app.core.security import get_current_user
from app.core.tenancy import require_business_id
from app.core.types import new_uuid
from app.models.accounting import AccountingProfileModel
from app.models.onboarding import (
    OnboardingAutomationModel,
    OnboardingIntegrationModel,
    OnboardingProfileModel,
)
from app.models.user import User
from app.schemas.onboarding import (
    AUTOMATION_FUNCTIONS,
    AutomationsBulkUpdate,
    CompanyProfileOut,
    CompanyProfileUpdate,
    IntegrationConnect,
    IntegrationOut,
    IntegrationSkip,
    OnboardingStateOut,
    TourDismissRequest,
)

router = APIRouter()

DEFAULT_AUTOMATIONS = {
    "Retail": {
        "reconcile": "suggest",
        "flag_anomalies": "suggest",
        "reorder": "suggest",
        "customer_replies": "off",
        "forecast": "suggest",
    },
    "Wholesale": {
        "reconcile": "suggest",
        "flag_anomalies": "suggest",
        "reorder": "suggest",
        "customer_replies": "off",
        "forecast": "off",
    },
    "Manufacturing": {
        "reconcile": "off",
        "flag_anomalies": "suggest",
        "reorder": "suggest",
        "customer_replies": "off",
        "forecast": "suggest",
    },
}

SIGNUP_TYPE_MAP = {
    "e-commerce": "Retail",
    "online retail": "Retail",
    "retail": "Retail",
    "wholesale": "Wholesale",
    "distribution": "Wholesale",
    "manufacturing": "Manufacturing",
    "assembly": "Manufacturing",
}


def normalize_business_type(raw: str | None) -> str:
    if not raw:
        return "Retail"
    lowered = raw.lower()
    for key, value in SIGNUP_TYPE_MAP.items():
        if key in lowered:
            return value
    if raw in ("Retail", "Wholesale", "Manufacturing"):
        return raw
    return "Retail"


def serialize_profile(row: OnboardingProfileModel) -> CompanyProfileOut:
    return CompanyProfileOut(
        company_name=row.company_name or "",
        business_type=normalize_business_type(row.business_type),  # type: ignore[arg-type]
        team_size=row.team_size or "Just me",  # type: ignore[arg-type]
        country=row.country or "",
        currency=row.currency or "USD",
        tax_mode=row.tax_mode or "added_at_sale",  # type: ignore[arg-type]
        current_step=row.current_step or "company",  # type: ignore[arg-type]
        completed=bool(row.completed),
        completed_at=row.completed_at,
        tour_dismissed=bool(row.tour_dismissed),
    )


def serialize_integration(row: OnboardingIntegrationModel) -> IntegrationOut:
    return IntegrationOut(
        provider_id=row.provider_id,
        category=row.category,
        status=row.status if row.status in ("skipped", "saved") else "skipped",  # type: ignore[arg-type]
        key_last4=row.key_last4,
        updated_at=row.updated_at,
    )


def ensure_profile(db: Session, user: User) -> OnboardingProfileModel:
    row = db.query(OnboardingProfileModel).filter(OnboardingProfileModel.business_id == require_business_id(user)).first()
    if row:
        return row
    row = OnboardingProfileModel(
        id=new_uuid(),
        business_id=require_business_id(user),
        company_name=(user.organization or user.full_name or "").strip()[:120],
        business_type=normalize_business_type(user.business_type),
        team_size="Just me",
        country="",
        currency="USD",
        tax_mode="added_at_sale",
        current_step="company",
        completed=False,
        tour_dismissed=False,
    )
    db.add(row)
    db.flush()
    return row


def ensure_automations(db: Session, user: User, business_type: str) -> list[OnboardingAutomationModel]:
    defaults = DEFAULT_AUTOMATIONS.get(normalize_business_type(business_type), DEFAULT_AUTOMATIONS["Retail"])
    existing = {
        item.function_id: item
        for item in db.query(OnboardingAutomationModel).filter(OnboardingAutomationModel.business_id == require_business_id(user)).all()
    }
    rows: list[OnboardingAutomationModel] = []
    for function_id in AUTOMATION_FUNCTIONS:
        if function_id in existing:
            rows.append(existing[function_id])
            continue
        item = OnboardingAutomationModel(
            id=new_uuid(),
            business_id=require_business_id(user),
            function_id=function_id,
            mode=defaults.get(function_id, "off"),
        )
        db.add(item)
        rows.append(item)
    db.flush()
    return rows


def sync_user_and_accounting(db: Session, user: User, company_name: str, business_type: str, reconcile_mode: str) -> None:
    user.organization = company_name[:120]
    user.business_type = business_type[:120]
    profile = (
        db.query(AccountingProfileModel)
        .filter(AccountingProfileModel.business_id == require_business_id(user))
        .first()
    )
    if not profile:
        profile = AccountingProfileModel(id=user.id, business_id=require_business_id(user))
        db.add(profile)
    profile.business_id = require_business_id(user)
    profile.organization = company_name[:120]
    profile.full_name = user.full_name
    profile.role = user.role or "Admin"
    profile.auto_reconciliation = "true" if reconcile_mode == "automatic" else "false"


def build_state(db: Session, user: User) -> OnboardingStateOut:
    profile = ensure_profile(db, user)
    automations = ensure_automations(db, user, profile.business_type)
    integrations = (
        db.query(OnboardingIntegrationModel)
        .filter(OnboardingIntegrationModel.business_id == require_business_id(user))
        .order_by(OnboardingIntegrationModel.category, OnboardingIntegrationModel.provider_id)
        .all()
    )
    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error

    return OnboardingStateOut(
        profile=serialize_profile(profile),
        integrations=[serialize_integration(item) for item in integrations],
        automations=[{"function_id": item.function_id, "mode": item.mode} for item in automations],
    )


@router.get("/state", response_model=OnboardingStateOut)
def get_onboarding_state(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return build_state(db, user)


@router.put("/profile", response_model=OnboardingStateOut)
def update_company_profile(
    payload: CompanyProfileUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = ensure_profile(db, user)
    profile.company_name = payload.company_name.strip()[:120]
    profile.business_type = payload.business_type
    profile.team_size = payload.team_size
    profile.country = (payload.country or "").strip()[:80]
    profile.currency = (payload.currency or "USD").strip().upper()[:8]
    profile.tax_mode = payload.tax_mode
    if payload.current_step:
        profile.current_step = payload.current_step
    elif profile.current_step == "company":
        profile.current_step = "connections"

    # Refresh AI defaults only when rows were empty / first visit to AI step.
    existing = db.query(OnboardingAutomationModel).filter(OnboardingAutomationModel.business_id == require_business_id(user)).count()
    if existing == 0:
        ensure_automations(db, user, profile.business_type)
    else:
        # If user has never customized, re-seed from business type when still on early steps.
        if profile.current_step in ("company", "connections", "ai") and not profile.completed:
            defaults = DEFAULT_AUTOMATIONS.get(profile.business_type, DEFAULT_AUTOMATIONS["Retail"])
            for item in db.query(OnboardingAutomationModel).filter(OnboardingAutomationModel.business_id == require_business_id(user)).all():
                if item.function_id in defaults:
                    item.mode = defaults[item.function_id]

    reconcile = (
        db.query(OnboardingAutomationModel)
        .filter(
            OnboardingAutomationModel.business_id == require_business_id(user),
            OnboardingAutomationModel.function_id == "reconcile",
        )
        .first()
    )
    sync_user_and_accounting(
        db,
        user,
        profile.company_name,
        profile.business_type,
        reconcile.mode if reconcile else "suggest",
    )

    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error

    return build_state(db, user)


@router.post("/integrations/connect", response_model=IntegrationOut)
def connect_integration(
    payload: IntegrationConnect,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ensure_profile(db, user)
    key = payload.api_key.strip()
    if payload.provider_id != "kpm_books" and len(key) < 4:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter a valid API key")

    row = (
        db.query(OnboardingIntegrationModel)
        .filter(
            OnboardingIntegrationModel.business_id == require_business_id(user),
            OnboardingIntegrationModel.provider_id == payload.provider_id,
        )
        .first()
    )
    if not row:
        row = OnboardingIntegrationModel(
            id=new_uuid(),
            business_id=require_business_id(user),
            provider_id=payload.provider_id,
            category=payload.category,
        )
        db.add(row)

    row.category = payload.category
    row.status = "saved"
    if payload.provider_id == "kpm_books":
        row.key_last4 = None
        row.encrypted_secret = None
    else:
        row.key_last4 = key[-4:]
        row.encrypted_secret = encrypt_secret(key)
    row.updated_at = datetime.utcnow()

    profile = ensure_profile(db, user)
    if profile.current_step == "connections":
        pass

    try:
        db.commit()
        db.refresh(row)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error

    return serialize_integration(row)


@router.post("/integrations/skip", response_model=IntegrationOut)
def skip_integration(
    payload: IntegrationSkip,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ensure_profile(db, user)
    row = (
        db.query(OnboardingIntegrationModel)
        .filter(
            OnboardingIntegrationModel.business_id == require_business_id(user),
            OnboardingIntegrationModel.provider_id == payload.provider_id,
        )
        .first()
    )
    if not row:
        row = OnboardingIntegrationModel(
            id=new_uuid(),
            business_id=require_business_id(user),
            provider_id=payload.provider_id,
            category=payload.category,
        )
        db.add(row)

    row.category = payload.category
    row.status = "skipped"
    row.key_last4 = None
    row.encrypted_secret = None
    row.updated_at = datetime.utcnow()

    try:
        db.commit()
        db.refresh(row)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error

    return serialize_integration(row)


@router.delete("/integrations/{provider_id}", response_model=IntegrationOut)
def remove_integration(
    provider_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = (
        db.query(OnboardingIntegrationModel)
        .filter(
            OnboardingIntegrationModel.business_id == require_business_id(user),
            OnboardingIntegrationModel.provider_id == provider_id,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found")

    row.status = "skipped"
    row.key_last4 = None
    row.encrypted_secret = None
    row.updated_at = datetime.utcnow()

    try:
        db.commit()
        db.refresh(row)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error

    return serialize_integration(row)


@router.put("/automations", response_model=OnboardingStateOut)
def update_automations(
    payload: AutomationsBulkUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = ensure_profile(db, user)
    ensure_automations(db, user, profile.business_type)
    by_id = {
        item.function_id: item
        for item in db.query(OnboardingAutomationModel).filter(OnboardingAutomationModel.business_id == require_business_id(user)).all()
    }
    for entry in payload.items:
        if entry.function_id not in AUTOMATION_FUNCTIONS:
            continue
        row = by_id.get(entry.function_id)
        if not row:
            row = OnboardingAutomationModel(
                id=new_uuid(),
                business_id=require_business_id(user),
                function_id=entry.function_id,
                mode=entry.mode,
            )
            db.add(row)
            by_id[entry.function_id] = row
        else:
            row.mode = entry.mode

    if profile.current_step == "ai":
        profile.current_step = "review"

    reconcile = by_id.get("reconcile")
    sync_user_and_accounting(
        db,
        user,
        profile.company_name or (user.organization or user.full_name),
        profile.business_type,
        reconcile.mode if reconcile else "suggest",
    )

    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error

    return build_state(db, user)


@router.post("/complete", response_model=OnboardingStateOut)
def complete_onboarding(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = ensure_profile(db, user)
    if not profile.company_name.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company name is required")

    ensure_automations(db, user, profile.business_type)
    profile.completed = True
    profile.completed_at = datetime.utcnow()
    profile.current_step = "done"
    profile.tour_dismissed = False

    reconcile = (
        db.query(OnboardingAutomationModel)
        .filter(
            OnboardingAutomationModel.business_id == require_business_id(user),
            OnboardingAutomationModel.function_id == "reconcile",
        )
        .first()
    )
    sync_user_and_accounting(
        db,
        user,
        profile.company_name,
        profile.business_type,
        reconcile.mode if reconcile else "suggest",
    )

    # Ensure KPM books is recorded as the default accounting connection.
    books = (
        db.query(OnboardingIntegrationModel)
        .filter(
            OnboardingIntegrationModel.business_id == require_business_id(user),
            OnboardingIntegrationModel.provider_id == "kpm_books",
        )
        .first()
    )
    if not books:
        books = OnboardingIntegrationModel(
            id=new_uuid(),
            business_id=require_business_id(user),
            provider_id="kpm_books",
            category="accounting",
            status="saved",
            key_last4=None,
            encrypted_secret=None,
        )
        db.add(books)
    else:
        books.status = "saved"

    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error

    return build_state(db, user)


@router.post("/tour", response_model=OnboardingStateOut)
def dismiss_tour(
    payload: TourDismissRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    profile = ensure_profile(db, user)
    profile.tour_dismissed = bool(payload.dismissed)
    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error
    return build_state(db, user)


@router.put("/step/{step}", response_model=OnboardingStateOut)
def set_current_step(
    step: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if step not in ("company", "connections", "ai", "review", "done"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid step")
    profile = ensure_profile(db, user)
    profile.current_step = step
    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)) from error
    return build_state(db, user)
