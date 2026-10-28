"""HTTP routes for notifications (P5). Only the email provider's webhook lives here;
sending happens in jobs (`app.notifications.jobs`)."""

import hmac
import os
from typing import Annotated, Literal

from fastapi import APIRouter, Header, status
from pydantic import BaseModel

from app.core.auth import DbSession
from app.core.errors import AppError, ErrorResponse
from app.core.settings import get_settings
from app.notifications.service import apply_email_event

router = APIRouter(tags=["notifications"])

WEBHOOK_SECRET_ENV = "ORGNISER_EMAIL_WEBHOOK_SECRET"


class EmailWebhookEvent(BaseModel):
    """Generic prototype payload. Replaced by the chosen provider's own format (and its
    signature check) once one is picked in docs/PROVIDERS.md (decision 34)."""

    message_id: str
    event: Literal["delivered", "bounced", "failed"]


def _check_secret(given: str | None) -> None:
    """Check `X-Webhook-Secret` against `email_webhook_secret` (ORGNISER_EMAIL_WEBHOOK_SECRET)."""
    settings = get_settings()
    # Settings are cached for the process; the environment is re-read so a secret set
    # after start-up (or by a test) still applies.
    expected = settings.email_webhook_secret or os.environ.get(WEBHOOK_SECRET_ENV, "")
    if not expected:
        if settings.environment == "production":
            # Never accept unauthenticated status changes in production.
            raise AppError(
                "webhook_not_configured",
                "The email webhook is not configured. Set ORGNISER_EMAIL_WEBHOOK_SECRET.",
                status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        # Local and test: no secret configured means every call is accepted.
        return
    if given is None or not hmac.compare_digest(given.encode(), expected.encode()):
        raise AppError(
            "invalid_webhook_secret",
            "The webhook secret is missing or wrong. Send the configured value in the "
            "X-Webhook-Secret header.",
            status.HTTP_401_UNAUTHORIZED,
        )


@router.post(
    "/webhooks/email",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse},
        status.HTTP_503_SERVICE_UNAVAILABLE: {
            "model": ErrorResponse,
            "description": "`webhook_not_configured`: no secret set in production.",
        },
    },
)
def email_provider_webhook(
    payload: EmailWebhookEvent,
    db: DbSession,
    x_webhook_secret: Annotated[str | None, Header()] = None,
) -> None:
    """Delivery and bounce events from the email provider (R37, decision 34).

    Checks `X-Webhook-Secret`, then updates the matching `certificate_notifications` row:
    `bounced` -> bounced, `failed` -> failed, `delivered` leaves it `sent`. Unknown message
    ids still get 204 so the provider doesn't retry. Never touches the Certificate.

    The payload parser here is a placeholder: it is replaced by the chosen provider's
    format and signature verification when the provider is picked (docs/PROVIDERS.md).
    """
    _check_secret(x_webhook_secret)
    if apply_email_event(db, payload.message_id, payload.event):
        db.commit()
