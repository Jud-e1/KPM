"""Stripe Checkout for the existing Growth plan. Free and Enterprise stay as signup links."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import urllib.parse
import urllib.request

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.core.tenancy import require_business_id
from app.models.business import Business
from app.models.user import User

router = APIRouter()


class CheckoutRequest(BaseModel):
    interval: str = "month"


class CheckoutResponse(BaseModel):
    url: str


def _form(payload: dict[str, str]) -> bytes:
    return urllib.parse.urlencode(payload).encode()


def _stripe(path: str, payload: dict[str, str]) -> dict:
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Billing is not configured")
    request = urllib.request.Request(
        f"https://api.stripe.com/v1/{path}",
        data=_form(payload),
        headers={
            "Authorization": f"Bearer {settings.STRIPE_SECRET_KEY}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode())
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Stripe request failed") from exc


def _price_for(interval: str) -> str:
    if interval == "year":
        price = settings.STRIPE_PRICE_GROWTH_YEARLY
    else:
        price = settings.STRIPE_PRICE_GROWTH_MONTHLY
    if not price:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Billing is not configured")
    return price


@router.post("/checkout", response_model=CheckoutResponse)
def checkout(
    payload: CheckoutRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    business_id = require_business_id(user)
    business = db.query(Business).filter(Business.id == business_id).first()
    if business is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    interval = "year" if payload.interval == "year" else "month"
    app = settings.PUBLIC_APP_URL.rstrip("/")
    session = _stripe(
        "checkout/sessions",
        {
            "mode": "subscription",
            "customer_email": user.email,
            "client_reference_id": str(business.id),
            "success_url": f"{app}/settings?billing=success",
            "cancel_url": f"{app}/#pricing",
            "line_items[0][price]": _price_for(interval),
            "line_items[0][quantity]": "1",
            "metadata[business_id]": str(business.id),
            "subscription_data[metadata][business_id]": str(business.id),
        },
    )
    url = session.get("url")
    if not url:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Stripe did not return a checkout URL")
    return CheckoutResponse(url=url)


@router.post("/portal", response_model=CheckoutResponse)
def portal(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    business = db.query(Business).filter(Business.id == require_business_id(user)).first()
    if business is None or not business.stripe_customer_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No billing account yet")
    session = _stripe(
        "billing_portal/sessions",
        {
            "customer": business.stripe_customer_id,
            "return_url": f"{settings.PUBLIC_APP_URL.rstrip('/')}/settings",
        },
    )
    url = session.get("url")
    if not url:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Stripe did not return a billing URL")
    return CheckoutResponse(url=url)


def _signature_ok(body: bytes, header: str) -> bool:
    secret = settings.STRIPE_WEBHOOK_SECRET
    if not secret or not header:
        return False
    parts = dict(item.split("=", 1) for item in header.split(",") if "=" in item)
    timestamp = parts.get("t")
    signature = parts.get("v1")
    if not timestamp or not signature:
        return False
    if abs(time.time() - int(timestamp)) > 300:
        return False
    signed = f"{timestamp}.{body.decode()}".encode()
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    if not _signature_ok(body, request.headers.get("stripe-signature", "")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe signature")
    event = json.loads(body.decode())
    kind = event.get("type")
    data = (event.get("data") or {}).get("object") or {}
    business_id = (data.get("metadata") or {}).get("business_id") or data.get("client_reference_id")
    customer = data.get("customer")
    subscription = data.get("subscription") or data.get("id")
    business = None
    if business_id:
        business = db.query(Business).filter(Business.id == business_id).first()
    if business is None and customer:
        business = db.query(Business).filter(Business.stripe_customer_id == customer).first()
    if business is None:
        return {"received": True}
    if kind in ("checkout.session.completed", "customer.subscription.updated", "customer.subscription.created"):
        business.plan = "growth"
        if customer:
            business.stripe_customer_id = customer
        if subscription and kind != "checkout.session.completed":
            business.stripe_subscription_id = subscription
        if kind == "checkout.session.completed" and data.get("subscription"):
            business.stripe_subscription_id = data.get("subscription")
    elif kind == "customer.subscription.deleted":
        business.plan = "free"
        business.stripe_subscription_id = None
    db.commit()
    return {"received": True}
