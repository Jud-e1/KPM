"""OAuth start URLs for connectors. Paste-a-key remains when a provider has no app credentials."""

from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.secrets import encrypt_secret
from app.core.security import get_current_user
from app.core.tenancy import require_business_id
from app.core.types import new_uuid
from app.models.onboarding import OnboardingIntegrationModel
from app.models.user import User

router = APIRouter()

_CATEGORIES = {
    "shopify": "sales",
    "amazon": "sales",
    "quickbooks": "accounting",
    "xero": "accounting",
    "whatsapp": "messages",
    "meta_shop": "messages",
}

_PROVIDERS = {
    "quickbooks": {
        "auth": "https://appcenter.intuit.com/connect/oauth2",
        "token": "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
        "scope": "com.intuit.quickbooks.accounting",
    },
    "xero": {
        "auth": "https://login.xero.com/identity/connect/authorize",
        "token": "https://identity.xero.com/connect/token",
        "scope": "openid profile email accounting.transactions offline_access",
    },
    "amazon": {
        "auth": "https://sellercentral.amazon.com/apps/authorize/consent",
        "token": "https://api.amazon.com/auth/o2/token",
        "scope": "sellingpartnerapi::migration",
    },
    "whatsapp": {
        "auth": "https://www.facebook.com/v19.0/dialog/oauth",
        "token": "https://graph.facebook.com/v19.0/oauth/access_token",
        "scope": "whatsapp_business_management,whatsapp_business_messaging",
    },
    "meta_shop": {
        "auth": "https://www.facebook.com/v19.0/dialog/oauth",
        "token": "https://graph.facebook.com/v19.0/oauth/access_token",
        "scope": "pages_show_list,catalog_management,business_management",
    },
}


def _creds(provider: str) -> tuple[str, str] | None:
    prefix = f"OAUTH_{provider.upper()}"
    client_id = os.environ.get(f"{prefix}_CLIENT_ID", "").strip()
    secret = os.environ.get(f"{prefix}_CLIENT_SECRET", "").strip()
    if not client_id or not secret:
        return None
    return client_id, secret


def _redirect_uri() -> str:
    return f"{settings.API_PUBLIC_URL.rstrip('/')}/api/v1/onboarding/oauth/callback"


def _sign_state(payload: dict) -> str:
    body = {
        **payload,
        "purpose": "oauth",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    return jwt.encode(body, settings.SECRET_KEY, algorithm="HS256")


def _read_state(token: str) -> dict:
    try:
        data = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth session expired") from exc
    if data.get("purpose") != "oauth":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OAuth session")
    return data


@router.get("/oauth/{provider}/start")
def oauth_start(
    provider: str,
    shop: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    del db
    if provider not in _CATEGORIES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown connector")
    creds = _creds(provider)
    if creds is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="OAuth is not configured for this connector",
        )
    client_id, _secret = creds
    if provider == "shopify" and not (shop or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter your Shopify store name")
    state = _sign_state(
        {
            "provider": provider,
            "user_id": str(user.id),
            "business_id": str(require_business_id(user)),
            "shop": (shop or "").strip().removesuffix(".myshopify.com"),
        }
    )
    params = {
        "client_id": client_id,
        "redirect_uri": _redirect_uri(),
        "state": state,
        "response_type": "code",
    }
    if provider == "shopify":
        store = (shop or "").strip().removesuffix(".myshopify.com")
        params["scope"] = "read_products,read_orders"
        url = f"https://{store}.myshopify.com/admin/oauth/authorize?{urllib.parse.urlencode(params)}"
        return {"url": url}
    spec = _PROVIDERS[provider]
    params["scope"] = spec["scope"]
    if provider == "amazon":
        params = {"application_id": client_id, "state": state, "redirect_uri": _redirect_uri()}
    url = f"{spec['auth']}?{urllib.parse.urlencode(params)}"
    return {"url": url}


@router.get("/oauth/callback")
def oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    data = _read_state(state)
    provider = str(data.get("provider") or "")
    creds = _creds(provider)
    if creds is None or provider not in _CATEGORIES:
        return RedirectResponse(f"{settings.PUBLIC_APP_URL}/onboarding?connect_error=unavailable")
    client_id, secret = creds
    token = _exchange(provider, client_id, secret, code, str(data.get("shop") or ""))
    if not token:
        return RedirectResponse(f"{settings.PUBLIC_APP_URL}/onboarding?connect_error=token")
    business_id = data["business_id"]
    row = (
        db.query(OnboardingIntegrationModel)
        .filter(
            OnboardingIntegrationModel.business_id == business_id,
            OnboardingIntegrationModel.provider_id == provider,
        )
        .first()
    )
    if row is None:
        row = OnboardingIntegrationModel(
            id=new_uuid(),
            business_id=business_id,
            provider_id=provider,
            category=_CATEGORIES[provider],
        )
        db.add(row)
    row.status = "saved"
    row.category = _CATEGORIES[provider]
    row.key_last4 = token[-4:]
    row.encrypted_secret = encrypt_secret(token)
    db.commit()
    return RedirectResponse(f"{settings.PUBLIC_APP_URL}/onboarding?connected={provider}")


def _exchange(provider: str, client_id: str, secret: str, code: str, shop: str) -> str | None:
    if provider == "shopify":
        url = f"https://{shop}.myshopify.com/admin/oauth/access_token"
        payload = json.dumps({"client_id": client_id, "client_secret": secret, "code": code}).encode()
        headers = {"Content-Type": "application/json"}
        request = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    elif provider in ("whatsapp", "meta_shop"):
        query = urllib.parse.urlencode(
            {
                "client_id": client_id,
                "client_secret": secret,
                "redirect_uri": _redirect_uri(),
                "code": code,
            }
        )
        request = urllib.request.Request(f"{_PROVIDERS[provider]['token']}?{query}", method="GET")
    else:
        form = urllib.parse.urlencode(
            {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": _redirect_uri(),
                "client_id": client_id,
                "client_secret": secret,
            }
        ).encode()
        request = urllib.request.Request(
            _PROVIDERS[provider]["token"],
            data=form,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = json.loads(response.read().decode())
    except Exception:
        return None
    token = body.get("access_token") or body.get("refresh_token")
    return str(token) if token else None
