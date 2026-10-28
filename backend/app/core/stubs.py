"""Helpers for endpoints that are published in the OpenAPI spec but not built yet.

A stub has its real request and response models, so P1 can build against the contract,
and returns 501 in the project's error shape until its owner implements it.
"""

from typing import NoReturn

from fastapi import status

from app.core.errors import AppError, ErrorResponse

STUB_RESPONSES: dict[int | str, dict] = {
    status.HTTP_501_NOT_IMPLEMENTED: {"model": ErrorResponse, "description": "Not built yet."}
}


def not_implemented() -> NoReturn:
    raise AppError(
        "not_implemented",
        "This endpoint is in the API contract but not built yet. See docs/TASKS.md for its phase.",
        status.HTTP_501_NOT_IMPLEMENTED,
    )
