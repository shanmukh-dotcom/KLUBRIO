"""HTTP routes for Event QR and Posters (P3): R19–R22. Logic lives in `service.py`."""

import uuid
from typing import Literal

from fastapi import APIRouter, File, UploadFile, status
from fastapi.responses import Response

from app.core.auth import CurrentStudent, DbSession
from app.core.errors import ErrorResponse
from app.posters import service
from app.posters.schemas import PosterOut, QrArea

router = APIRouter(tags=["posters"])

_err = {"model": ErrorResponse}
_AUTH = {
    401: {**_err, "description": "Not logged in."},
    403: {**_err, "description": "Not a Club member."},
}
_POSTER_404 = {404: {**_err, "description": "No such Poster (`poster_not_found`)."}}


@router.get(
    "/events/{event_id}/qr",
    response_class=Response,
    responses={
        200: {"content": {"image/png": {}, "image/svg+xml": {}}},
        **_AUTH,
        404: {**_err, "description": "No such Event (`event_not_found`)."},
    },
)
def get_event_qr(
    event_id: uuid.UUID,
    db: DbSession,
    student: CurrentStudent,
    format: Literal["png", "svg"] = "png",
) -> Response:
    """The Event QR. It encodes the Event's public page, never the Registration Form (R19)."""
    data, content_type = service.event_qr(db, student, event_id, format)
    return Response(content=data, media_type=content_type)


@router.post(
    "/events/{event_id}/posters",
    response_model=PosterOut,
    status_code=status.HTTP_201_CREATED,
    responses={
        400: {**_err, "description": "`unsupported_file_type`, `corrupt_file`, `image_too_large`."},
        **_AUTH,
        404: {**_err, "description": "No such Event (`event_not_found`)."},
        413: {**_err, "description": "Larger than `max_upload_mb` (`file_too_large`)."},
    },
)
def upload_poster(
    event_id: uuid.UUID, db: DbSession, student: CurrentStudent, file: UploadFile = File(...)
) -> PosterOut:
    """Upload a Poster as PNG, JPG or PDF (page 1, rasterised at 300 DPI)."""
    poster = service.upload_poster(
        db, student, event_id, file.file, file.content_type, file.filename
    )
    return service.poster_out(db, poster)


@router.put(
    "/posters/{poster_id}/qr-area",
    response_model=PosterOut,
    responses={
        400: {
            **_err,
            "description": "`qr_area_outside`, `qr_area_too_small`, `qr_area_not_square_enough`.",
        },
        **_AUTH,
        **_POSTER_404,
    },
)
def set_qr_area(
    poster_id: uuid.UUID, body: QrArea, db: DbSession, student: CurrentStudent
) -> PosterOut:
    """Set the QR Area in original-poster pixels. Changing it resets a done render to none."""
    poster = service.set_qr_area(db, student, poster_id, body)
    return service.poster_out(db, poster)


@router.post(
    "/posters/{poster_id}/render",
    response_model=PosterOut,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        **_AUTH,
        **_POSTER_404,
        409: {**_err, "description": "No QR Area marked yet (`qr_area_missing`)."},
        503: {**_err, "description": "Job queue unavailable (`queue_unavailable`)."},
    },
)
def render_poster(poster_id: uuid.UUID, db: DbSession, student: CurrentStudent) -> PosterOut:
    """Queue the Final Poster render; poll the Poster's `render_status` until `done`."""
    poster = service.request_render(db, student, poster_id)
    return service.poster_out(db, poster)


@router.get(
    "/posters/{poster_id}/preview",
    response_class=Response,
    responses={
        200: {
            "content": {"image/png": {}},
            "headers": {
                "X-Preview-Scale": {
                    "description": "Preview px per original px (<= 1). "
                    "original = round(preview / scale).",
                    "schema": {"type": "number"},
                },
                "X-Original-Width": {"schema": {"type": "integer"}},
                "X-Original-Height": {"schema": {"type": "integer"}},
            },
        },
        **_AUTH,
        **_POSTER_404,
    },
)
def get_poster_preview(poster_id: uuid.UUID, db: DbSession, student: CurrentStudent) -> Response:
    """PNG of the original poster for marking the QR Area, at most 1600 px on its longest side.
    PDF posters are rasterised with pypdfium2 (decision 28). Convert a box drawn on the preview
    to original pixels with `X-Preview-Scale` before calling `PUT /posters/{id}/qr-area`."""
    png, poster = service.poster_preview(db, student, poster_id)
    scale = service.preview_scale(poster.width_px, poster.height_px)
    return Response(
        content=png,
        media_type="image/png",
        headers={
            "X-Preview-Scale": f"{scale:.6f}",
            "X-Original-Width": str(poster.width_px),
            "X-Original-Height": str(poster.height_px),
        },
    )


@router.get(
    "/posters/{poster_id}/final",
    response_class=Response,
    responses={
        200: {"content": {"image/png": {}, "application/pdf": {}}},
        **_AUTH,
        **_POSTER_404,
        409: {**_err, "description": "Not rendered yet (`not_rendered`)."},
    },
)
def get_final_poster(
    poster_id: uuid.UUID,
    db: DbSession,
    student: CurrentStudent,
    format: Literal["png", "pdf"] = "png",
) -> Response:
    """The Final Poster with the Event QR composited in, once `render_status` is `done`."""
    data, content_type = service.final_poster(db, student, poster_id, format)
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="poster-{poster_id}.{format}"'},
    )
