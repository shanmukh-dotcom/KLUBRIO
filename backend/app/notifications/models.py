"""Tables owned by notifications (P5): certificate_notifications."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import TimestampedBase


class CertificateNotificationStatus(enum.StrEnum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    BOUNCED = "bounced"


def _enum(kind: type[enum.StrEnum], name: str) -> Enum:
    return Enum(kind, name=name, values_callable=lambda members: [m.value for m in members])


class CertificateNotification(TimestampedBase):
    """The email telling a Student a Certificate is in their account (ADR 0002). One per
    Certificate (unique), which makes the send job idempotent."""

    __tablename__ = "certificate_notifications"

    certificate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("certificates.id", ondelete="RESTRICT"), unique=True
    )
    status: Mapped[CertificateNotificationStatus] = mapped_column(
        _enum(CertificateNotificationStatus, "certificate_notification_status"),
        server_default=CertificateNotificationStatus.PENDING.value,
    )
    # Indexed: delivery and bounce webhooks look the row up by it.
    provider_message_id: Mapped[str | None] = mapped_column(String(255), index=True)
    error: Mapped[str | None] = mapped_column(Text)
    attempts: Mapped[int] = mapped_column(server_default=text("0"))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
