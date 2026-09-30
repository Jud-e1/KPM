"""Send transactional mail through Resend or SMTP. Missing config logs and returns False."""

from __future__ import annotations

import json
import logging
import smtplib
import urllib.request
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def mail_configured() -> bool:
    return bool(settings.RESEND_API_KEY or settings.SMTP_HOST)


def send_email(to: str, subject: str, text: str) -> bool:
    if settings.RESEND_API_KEY:
        return _send_resend(to, subject, text)
    if settings.SMTP_HOST:
        return _send_smtp(to, subject, text)
    logger.warning("Email is not configured. Skipping message to %s (%s)", to, subject)
    return False


def _send_resend(to: str, subject: str, text: str) -> bool:
    payload = json.dumps(
        {
            "from": settings.EMAIL_FROM,
            "to": [to],
            "subject": subject,
            "text": text,
        }
    ).encode()
    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return 200 <= response.status < 300
    except Exception as exc:
        logger.warning("Resend send failed: %s", exc)
        return False


def _send_smtp(to: str, subject: str, text: str) -> bool:
    message = EmailMessage()
    message["From"] = settings.EMAIL_FROM
    message["To"] = to
    message["Subject"] = subject
    message.set_content(text)
    try:
        with smtplib.SMTP(settings.SMTP_HOST or "", settings.SMTP_PORT, timeout=20) as smtp:
            smtp.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return True
    except Exception as exc:
        logger.warning("SMTP send failed: %s", exc)
        return False
