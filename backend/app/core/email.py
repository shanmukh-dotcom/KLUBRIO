"""Outgoing email behind one small interface (docs/PROTOTYPE.md, docs/PROVIDERS.md).

Email is only a notification, never how a Certificate is delivered (ADR 0002), so messages
carry no attachments. While `email_provider` is empty, the outbox stand-in logs each email and
saves it as a `.eml` file in `email_outbox_dir`, so it can be opened in a mail client. The real
provider is added later behind the same `EmailSender` interface; feature code does not change.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from email.message import EmailMessage as MimeMessage
from email.utils import format_datetime
from functools import lru_cache
from pathlib import Path
from typing import Protocol
from uuid import uuid4

from app.core.settings import get_settings

logger = logging.getLogger(__name__)

MESSAGE_ID_DOMAIN = "orgniser.local"


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    text: str
    html: str | None = None


class EmailSender(Protocol):
    def send(self, message: EmailMessage) -> str:
        """Send one email and return its message id (the provider's id, for the bounce webhook)."""
        ...


class OutboxEmailSender:
    """Local stand-in: one log line plus one `.eml` file per email."""

    def __init__(self, outbox_dir: Path, sender: str) -> None:
        self.outbox_dir = outbox_dir
        self.sender = sender

    def send(self, message: EmailMessage) -> str:
        message_id = uuid4().hex
        now = datetime.now(UTC)

        mime = MimeMessage()
        mime["From"] = self.sender
        mime["To"] = message.to
        mime["Subject"] = message.subject
        mime["Date"] = format_datetime(now)
        mime["Message-ID"] = f"<{message_id}@{MESSAGE_ID_DOMAIN}>"
        mime.set_content(message.text)
        if message.html is not None:
            mime.add_alternative(message.html, subtype="html")

        # Timestamp first so files sort by time; no colons, so the name is valid on Windows.
        self.outbox_dir.mkdir(parents=True, exist_ok=True)
        path = self.outbox_dir / f"{now.strftime('%Y%m%dT%H%M%S%fZ')}_{message_id}.eml"
        path.write_bytes(mime.as_bytes())

        # Never log the body: password-reset links are secrets.
        logger.info(
            "Email to %s, subject %r, message id %s (saved to %s)",
            message.to,
            message.subject,
            message_id,
            path.name,
        )
        return message_id


@lru_cache
def get_email_sender() -> EmailSender:
    settings = get_settings()
    if not settings.email_provider:
        return OutboxEmailSender(settings.email_outbox_dir, settings.email_from)
    raise NotImplementedError(
        f"Email provider {settings.email_provider!r} is not built yet; it is added when the "
        "frontend team connects one (docs/PROVIDERS.md). Leave ORGNISER_EMAIL_PROVIDER empty "
        "to use the outbox stand-in."
    )
