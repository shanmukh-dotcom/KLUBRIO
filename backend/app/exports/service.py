"""Exports (P6): build a live CSV/XLSX of an Event's Registrations and log the Export.

R23: generated from current data on every request (nothing is cached or stored).
R24: columns from `app.exports.format.build_columns` (hidden Form Fields included).
R25: filters all / confirmed / attendees. R26: every Export is logged in `exports`.
Read only, except for the one `exports` row (one writer per table).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import ColumnElement, or_, select, true
from sqlalchemy.orm import Session

from app.accounts.models import Student
from app.certificates.models import Attendance, Certificate, CertificateStatus
from app.events.models import Event, FormField, RegistrationForm
from app.exports.format import build_columns, build_rows, export_filename, to_csv, to_xlsx
from app.exports.models import Export, ExportFilter, ExportFormat
from app.registrations.models import Registration, RegistrationStatus

CONTENT_TYPES: dict[ExportFormat, str] = {
    ExportFormat.CSV: "text/csv; charset=utf-8",
    ExportFormat.XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


@dataclass(frozen=True, slots=True)
class ExportFile:
    content: bytes
    content_type: str
    filename: str


def filter_conditions(export_filter: ExportFilter) -> list[ColumnElement[bool]]:
    """WHERE conditions for an Export filter (R25), over `registrations` LEFT JOIN
    `attendance`. `attendees` means Confirmed and present; a Registration with no attendance
    row counts as present, because everyone is ticked by default (R27)."""
    if export_filter == ExportFilter.ALL:
        return []
    confirmed = Registration.status == RegistrationStatus.CONFIRMED
    if export_filter == ExportFilter.CONFIRMED:
        return [confirmed]
    if export_filter == ExportFilter.ATTENDEES:
        return [confirmed, or_(Attendance.id.is_(None), Attendance.present.is_(True))]
    raise ValueError(f"Unknown export filter: {export_filter!r}")


def _value(v: Any) -> Any:
    # Enums become their plain string value so CSV and openpyxl both write them cleanly.
    return v.value if isinstance(v, CertificateStatus | RegistrationStatus) else v


def _attended(row: Any) -> bool | None:
    """Attendance as shown in the Export: only Confirmed Registrations attend, and with no
    attendance row they count as present (R27)."""
    if row.status != RegistrationStatus.CONFIRMED:
        return None
    return True if row.attendance_id is None else bool(row.present)


def export_rows(
    db: Session, event_id: uuid.UUID, export_filter: ExportFilter
) -> list[dict[str, Any]]:
    """One mapping per Registration in the shape `build_rows` expects, in one query.

    For the Certificate columns, the Registration's latest valid Certificate is used, or
    else its latest Certificate of any status (superseded or revoked).
    """
    cert = (
        select(Certificate.public_id, Certificate.status)
        .where(Certificate.registration_id == Registration.id)
        .order_by(
            (Certificate.status == CertificateStatus.VALID).desc(),
            Certificate.issued_at.desc(),
            Certificate.created_at.desc(),
        )
        .limit(1)
        .correlate(Registration)
        .lateral("cert")
    )
    stmt = (
        select(
            Registration.profile_snapshot,
            Registration.answers,
            Registration.status,
            Registration.submitted_at,
            Student.email,
            Attendance.id.label("attendance_id"),
            Attendance.present,
            cert.c.public_id,
            cert.c.status.label("certificate_status"),
        )
        .join(Student, Student.id == Registration.student_id)
        .outerjoin(Attendance, Attendance.registration_id == Registration.id)
        .outerjoin(cert, true())
        .where(Registration.event_id == event_id, *filter_conditions(export_filter))
        .order_by(Registration.submitted_at, Registration.id)
    )
    return [
        {
            "profile_snapshot": row.profile_snapshot,
            "answers": row.answers,
            "status": _value(row.status),
            "submitted_at": row.submitted_at,
            "email": row.email,
            "attended": _attended(row),
            "certificate_id": row.public_id,
            "certificate_status": _value(row.certificate_status),
        }
        for row in db.execute(stmt)
    ]


def _form_fields(db: Session, event_id: uuid.UUID) -> list[FormField]:
    return list(
        db.scalars(
            select(FormField)
            .join(RegistrationForm, RegistrationForm.id == FormField.form_id)
            .where(RegistrationForm.event_id == event_id)
            .order_by(FormField.position, FormField.created_at)
        )
    )


def build_export(
    db: Session,
    event_id: uuid.UUID,
    requested_by: uuid.UUID,
    fmt: ExportFormat,
    export_filter: ExportFilter,
) -> ExportFile:
    """Build the Export file from current data and log it. The caller has checked access
    (R26) and commits."""
    event_name = db.scalar(select(Event.name).where(Event.id == event_id)) or ""
    columns = build_columns(
        {
            "key": f.key,
            "label": f.label,
            "type": f.type.value,
            "position": f.position,
            "hidden": f.hidden,
        }
        for f in _form_fields(db, event_id)
    )
    rows = build_rows(export_rows(db, event_id, export_filter), columns)
    content = to_csv(columns, rows) if fmt == ExportFormat.CSV else to_xlsx(columns, rows)

    db.add(Export(event_id=event_id, requested_by=requested_by, format=fmt, filter=export_filter))
    db.flush()
    return ExportFile(content, CONTENT_TYPES[fmt], export_filename(event_name, fmt.value))
