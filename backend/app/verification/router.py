"""HTTP routes for verification and My Certificates (P5)."""

import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.certificates.models import CertificateStatus
from app.core.auth import CurrentStudent, DbSession
from app.core.errors import ErrorResponse
from app.core.ratelimit import public_rate_limit
from app.verification import service
from app.verification.schemas import MyCertificateOut, VerificationOut

router = APIRouter(tags=["verification"])

_NOT_FOUND = {404: {"model": ErrorResponse, "description": "No such Certificate."}}
_AUTH = {401: {"model": ErrorResponse, "description": "Not logged in."}}


@router.get("/me/certificates", response_model=list[MyCertificateOut], responses={**_AUTH})
def list_my_certificates(db: DbSession, student: CurrentStudent) -> list[MyCertificateOut]:
    """The logged-in Student's Certificates, newest first, every status (R36)."""
    return service.list_my_certificates(db, student)


@router.get(
    "/me/certificates/{certificate_id}/download",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}, **_AUTH, **_NOT_FOUND},
)
def download_my_certificate(
    certificate_id: uuid.UUID, db: DbSession, student: CurrentStudent
) -> Response:
    """Owner-only PDF download (R38). Never expires. A revoked Certificate still downloads
    for its owner, flagged with `X-Certificate-Status: revoked`."""
    certificate, data = service.load_my_certificate_pdf(db, student, certificate_id)
    headers = {"Content-Disposition": f'attachment; filename="{certificate.public_id}.pdf"'}
    if certificate.status == CertificateStatus.REVOKED:
        headers["X-Certificate-Status"] = CertificateStatus.REVOKED.value
    return Response(content=data, media_type="application/pdf", headers=headers)


@router.get(
    "/verify/{public_id}",
    response_model=VerificationOut,
    dependencies=[Depends(public_rate_limit)],
    responses={**_NOT_FOUND, 429: {"model": ErrorResponse, "description": "Rate limited."}},
)
def verify(public_id: str, db: DbSession) -> VerificationOut:
    """Public, no auth, rate-limited. The ID is cleaned with `normalise_certificate_id`
    first, so lower case, spaces and O/0 or I/1 mix-ups still find the Certificate.
    Shows only name, Event, Club, date and status (R39, domain rule 8)."""
    return service.verify_certificate(db, public_id)
