import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token, get_current_user, hash_password, verify_password
from app.core.tenancy import require_business_id, resolve_business_for_user
from app.core.types import new_uuid
from app.models.accounting import AccountingProfileModel
from app.models.business import Business, ensure_default_business
from app.models.user import User
from app.schemas.auth import (
    GoogleAuthRequest,
    TokenResponse,
    UserLogin,
    UserResponse,
    UserSignup,
    UserUpdate,
)

router = APIRouter()


def serialize_user(user: User, business: Business | None = None) -> UserResponse:
    org = None
    btype = user.business_type
    bid = None
    if business is not None:
        org = business.name
        btype = business.business_type or btype
        bid = str(business.id)
    else:
        org = user.organization
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        organization=org,
        business_type=btype,
        business_id=bid,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
    )


def sync_accounting_profile(db: Session, user: User, business: Business) -> None:
    """Keep the accounting profile in sync with the active business."""
    profile = (
        db.query(AccountingProfileModel)
        .filter(AccountingProfileModel.business_id == business.id)
        .first()
    )
    if not profile:
        profile = AccountingProfileModel(id=new_uuid(), business_id=business.id)
        db.add(profile)
    profile.full_name = user.full_name
    profile.role = user.role or "Admin"
    profile.organization = business.name or user.full_name
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()


def _issue_token(db: Session, user: User) -> TokenResponse:
    business = resolve_business_for_user(db, user)
    sync_accounting_profile(db, user, business)
    token = create_access_token(
        str(user.id),
        {"email": user.email, "business_id": str(business.id)},
    )
    return TokenResponse(access_token=token, user=serialize_user(user, business))


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: UserSignup, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")

    user_id = new_uuid()
    org_name = (payload.organization or payload.full_name).strip()[:120]
    business_type = (payload.business_type or "").strip()[:80] or None
    user = User(
        id=user_id,
        email=email,
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
        organization=org_name,
        business_type=business_type,
        role="Admin",
        is_active=True,
    )
    business, membership = ensure_default_business(
        user_id=user_id,
        name=org_name,
        business_type=business_type,
    )
    db.add(user)
    db.flush()
    db.add(business)
    db.add(membership)
    try:
        db.commit()
        db.refresh(user)
        db.refresh(business)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error))

    sync_accounting_profile(db, user, business)
    token = create_access_token(
        str(user.id),
        {"email": user.email, "business_id": str(business.id)},
    )
    return TokenResponse(access_token=token, user=serialize_user(user, business))


@router.post("/signin", response_model=TokenResponse)
def signin(payload: UserLogin, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
    return _issue_token(db, user)


@router.post("/google", response_model=TokenResponse)
def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    from app.core.config import settings

    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured on this server",
        )

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token

        idinfo = google_id_token.verify_oauth2_token(
            payload.id_token,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID,
        )
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {error}",
        ) from error

    if idinfo.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token issuer")

    email = (idinfo.get("email") or "").lower().strip()
    if not email or not idinfo.get("email_verified", False):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google account email is not verified")

    full_name = (idinfo.get("name") or email.split("@")[0]).strip()[:120]
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user_id = new_uuid()
        user = User(
            id=user_id,
            email=email,
            full_name=full_name,
            hashed_password=hash_password(uuid.uuid4().hex + uuid.uuid4().hex),
            organization=full_name[:120],
            business_type=None,
            role="Admin",
            is_active=True,
        )
        business, membership = ensure_default_business(user_id=user_id, name=full_name[:120])
        db.add(user)
        db.flush()
        db.add(business)
        db.add(membership)
        try:
            db.commit()
            db.refresh(user)
        except SQLAlchemyError as error:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error))
    elif not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    return _issue_token(db, user)


@router.get("/me", response_model=UserResponse)
def me(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    business = resolve_business_for_user(db, current_user, require_business_id(current_user))
    return serialize_user(current_user, business)


@router.put("/me", response_model=UserResponse)
def update_me(
    updates: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = updates.model_dump(exclude_unset=True)
    org = data.pop("organization", None)
    btype = data.pop("business_type", None)
    for field, value in data.items():
        setattr(current_user, field, value)
    business = resolve_business_for_user(db, current_user, require_business_id(current_user))
    if org is not None:
        business.name = org[:120]
        current_user.organization = org[:120]
    if btype is not None:
        business.business_type = btype[:80] if btype else None
        current_user.business_type = business.business_type
    try:
        db.commit()
        db.refresh(current_user)
        db.refresh(business)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error))
    sync_accounting_profile(db, current_user, business)
    return serialize_user(current_user, business)
