"""HTTP routes for Attendance and Certificates (P4): R27–R35, R40–R42. Logic lives in
`service.py`; batch generation runs in `jobs.py`.

Certificates have no update or delete routes: corrections are Reissue or Revoke (ADR 0001).
"""

import uuid

from fastapi import APIRouter, File, UploadFile, status
from fastapi.responses import Response

from app.certificates import service
from app.certificates.schemas import (
    AttendanceEntry,
    AttendanceUpdate,
    CertificateBatchCreate,
    CertificateBatchOut,
    CertificateOut,
    CertificateTemplateOut,
    LateAttendeesIn,
    PlaceholdersIn,
    ReissueRequest,
    RevokeRequest,
)
from app.core.auth import CurrentStudent, DbSession
from app.core.errors import ErrorResponse

router = APIRouter(tags=["certificates"])

_err = {"model": ErrorResponse}
_AUTH = {
    401: {**_err, "description": "Not logged in."},
    403: {**_err, "description": "Not the President or a Coordinator of the Event's Club."},
}
_EVENT_404 = {404: {**_err, "description": "No such Event (`event_not_found`)."}}
_TEMPLATE_404 = {404: {**_err, "description": "No such template (`template_not_found`)."}}
_BATCH_404 = {404: {**_err, "description": "No such batch (`batch_not_found`)."}}
_CERT_404 = {404: {**_err, "description": "No such Certificate (`certificate_not_found`)."}}
_QUEUE_503 = {503: {**_err, "description": "Job queue unavailable (`queue_unavailable`)."}}
_TRANSITION_409 = {
    409: {**_err, "description": "The Certificate is not `valid` (`invalid_transition`)."}
}


@router.get(
    "/events/{event_id}/attendance",
    response_model=list[AttendanceEntry],
    responses={**_AUTH, **_EVENT_404},
)
def get_attendance(
    event_id: uuid.UUID, db: DbSession, student: CurrentStudent
) -> list[AttendanceEntry]:
    """The Event's Confirmed Registrations. Everyone is present until unticked (R27)."""
    return service.attendance_list(db, student, event_id)


@router.put(
    "/events/{event_id}/attendance",
    response_model=list[AttendanceEntry],
    responses={
        400: {
            **_err,
            "description": "An id is not a Confirmed Registration (`unknown_registration`).",
        },
        **_AUTH,
        **_EVENT_404,
    },
)
def update_attendance(
    event_id: uuid.UUID, body: AttendanceUpdate, db: DbSession, student: CurrentStudent
) -> list[AttendanceEntry]:
    """Mark the listed Registrations absent and everyone else present. Returns the list."""
    return service.update_attendance(db, student, event_id, body.absent_registration_ids)


@router.post(
    "/events/{event_id}/certificate-templates",
    response_model=CertificateTemplateOut,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {
            **_err,
            "description": "`not_a_pdf`, `too_many_pages`, or `unknown_tags` (the message "
            "lists each unknown Tag with a suggestion).",
        },
        **_AUTH,
        **_EVENT_404,
        413: {**_err, "description": "Larger than `max_upload_mb` (`file_too_large`)."},
    },
)
def upload_template(
    event_id: uuid.UUID, db: DbSession, student: CurrentStudent, file: UploadFile = File(...)
) -> CertificateTemplateOut:
    """Upload a PDF Certificate Template. Tags in its text layer become Placeholders (R31);
    with no text layer there are none, and the Club draws them with PUT placeholders (R32)."""
    return service.upload_template(db, student, event_id, file.file)


@router.put(
    "/certificate-templates/{template_id}/placeholders",
    response_model=CertificateTemplateOut,
    responses={
        400: {**_err, "description": "`unknown_tags` or `bad_page` (no such template page)."},
        **_AUTH,
        **_TEMPLATE_404,
    },
)
def replace_placeholders(
    template_id: uuid.UUID, body: PlaceholdersIn, db: DbSession, student: CurrentStudent
) -> CertificateTemplateOut:
    """Replace all of the template's Placeholders. Coordinates are PDF points, origin
    bottom-left; `page` is 0-based."""
    return service.replace_placeholders(db, student, template_id, body.placeholders)


@router.get(
    "/certificate-templates/{template_id}/preview",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}, **_AUTH, **_TEMPLATE_404},
)
def preview_template(template_id: uuid.UUID, db: DbSession, student: CurrentStudent) -> Response:
    """A PDF previewing the template with up to three real Attendees: the longest name, the
    shortest name and one at random (R33). Sample values when there are no Attendees yet."""
    data = service.preview(db, student, template_id)
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="preview-{template_id}.pdf"'},
    )


@router.post(
    "/events/{event_id}/certificate-batches",
    response_model=CertificateBatchOut,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        **_AUTH,
        404: {**_err, "description": "`event_not_found` or `template_not_found`."},
        409: {
            **_err,
            "description": "`no_attendees`, or `already_issued` when every Attendee already "
            "holds a valid Certificate.",
        },
        **_QUEUE_503,
    },
)
def create_batch(
    event_id: uuid.UUID, body: CertificateBatchCreate, db: DbSession, student: CurrentStudent
) -> CertificateBatchOut:
    """Start a Certificate Batch for every Attendee without a valid Certificate (R35).
    Poll GET /certificate-batches/{id} for progress."""
    return service.create_batch(
        db, student, event_id, body.template_id, body.message_subject, body.message_body
    )


@router.get(
    "/certificate-batches/{batch_id}",
    response_model=CertificateBatchOut,
    responses={**_AUTH, **_BATCH_404},
)
def get_batch(batch_id: uuid.UUID, db: DbSession, student: CurrentStudent) -> CertificateBatchOut:
    """Live progress: total, generated, failed and pending."""
    return service.get_batch(db, student, batch_id)


@router.post(
    "/certificate-batches/{batch_id}/retry",
    response_model=CertificateBatchOut,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        **_AUTH,
        **_BATCH_404,
        409: {**_err, "description": "No failed items (`nothing_to_retry`)."},
        **_QUEUE_503,
    },
)
def retry_batch(batch_id: uuid.UUID, db: DbSession, student: CurrentStudent) -> CertificateBatchOut:
    """Retry only the failed Certificates of the batch; generated ones are untouched."""
    return service.retry_batch(db, student, batch_id)


@router.post(
    "/certificates/{certificate_id}/reissue",
    response_model=CertificateOut,
    responses={**_AUTH, **_CERT_404, **_TRANSITION_409, **_QUEUE_503},
)
def reissue(
    certificate_id: uuid.UUID, body: ReissueRequest, db: DbSession, student: CurrentStudent
) -> CertificateOut:
    """Issue a corrected Certificate under a new Certificate ID from the current Profile
    Snapshot. The old one becomes `superseded` and points to the new one (R40). Returns the
    new Certificate."""
    return service.reissue(db, student, certificate_id, body.reason)


@router.post(
    "/certificates/{certificate_id}/revoke",
    response_model=CertificateOut,
    responses={**_AUTH, **_CERT_404, **_TRANSITION_409},
)
def revoke(
    certificate_id: uuid.UUID, body: RevokeRequest, db: DbSession, student: CurrentStudent
) -> CertificateOut:
    """Withdraw a valid Certificate with a recorded reason. No replacement (R41)."""
    return service.revoke(db, student, certificate_id, body.reason)


@router.post(
    "/certificate-batches/{batch_id}/attendees",
    response_model=CertificateBatchOut,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        400: {**_err, "description": "An id is not a current Attendee (`not_an_attendee`)."},
        **_AUTH,
        **_BATCH_404,
        **_QUEUE_503,
    },
)
def add_late_attendees(
    batch_id: uuid.UUID, body: LateAttendeesIn, db: DbSession, student: CurrentStudent
) -> CertificateBatchOut:
    """R29: issue Certificates to Attendees added after the batch ran. Adds one batch item
    per new Attendee and generates only those; existing Certificates are untouched."""
    return service.add_late_attendees(db, student, batch_id, body.registration_ids)
