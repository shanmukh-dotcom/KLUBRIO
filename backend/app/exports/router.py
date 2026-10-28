"""HTTP routes for Exports (P6): live CSV/XLSX of an Event's Registrations (R23-R26)."""

import uuid
from typing import Literal

from fastapi import APIRouter, status
from fastapi.responses import Response

from app.core.auth import CurrentStudent, DbSession
from app.core.errors import ErrorResponse
from app.core.permissions import require_event_club_member
from app.exports import service
from app.exports.models import ExportFilter, ExportFormat

router = APIRouter(tags=["exports"])

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get(
    "/events/{event_id}/export",
    response_class=Response,
    responses={
        200: {"content": {"text/csv": {}, XLSX: {}}},
        status.HTTP_401_UNAUTHORIZED: {"model": ErrorResponse, "description": "Not logged in."},
        status.HTTP_403_FORBIDDEN: {
            "model": ErrorResponse,
            "description": "Not the President or a Coordinator of the Event's Club.",
        },
        status.HTTP_404_NOT_FOUND: {"model": ErrorResponse, "description": "No such Event."},
    },
)
def export_registrations(
    event_id: uuid.UUID,
    db: DbSession,
    student: CurrentStudent,
    format: Literal["csv", "xlsx"] = "csv",
    filter: Literal["all", "confirmed", "attendees"] = "confirmed",
) -> Response:
    """Download the Event's Registrations, built from current data, and log the Export."""
    require_event_club_member(db, student, event_id)
    file = service.build_export(
        db, event_id, student.id, ExportFormat(format), ExportFilter(filter)
    )
    db.commit()
    return Response(
        content=file.content,
        media_type=file.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{file.filename}"',
            "Cache-Control": "no-store",
        },
    )
