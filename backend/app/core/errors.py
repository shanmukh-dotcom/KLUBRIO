"""Error responses in the project's shape: {"error": {"code": "...", "message": "..."}}.

Unexpected exceptions are logged with their traceback and answered with a generic 500
`internal_error`, so SQL, stack traces and file paths never reach the client.
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

INTERNAL_ERROR_MESSAGE = (
    "Something went wrong on our side. Try again in a moment; if it keeps happening, "
    "tell the ORGniser team what you were doing."
)

# Codes for HTTP errors raised by the framework (not by our own AppError).
_HTTP_CODES = {404: "not_found", 413: "request_too_large"}


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody


class AppError(Exception):
    """Raise for expected failures. The message says what went wrong and how to fix it."""

    def __init__(self, code: str, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.code = code
        self.message = message
        self.status_code = status_code


def _error(status_code: int, code: str, message: str) -> JSONResponse:
    body = ErrorResponse(error=ErrorBody(code=code, message=message))
    return JSONResponse(status_code=status_code, content=body.model_dump())


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return _error(exc.status_code, exc.code, exc.message)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _HTTP_CODES.get(exc.status_code, f"http_{exc.status_code}")
        return _error(exc.status_code, code, str(exc.detail))

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        # Starlette calls this from ServerErrorMiddleware. The app is built with debug off
        # (app/main.py), so this runs even when ORGNISER_DEBUG is true.
        logger.error(
            "Unhandled %s on %s %s",
            type(exc).__name__,
            request.method,
            request.url.path,
            exc_info=exc,
        )
        return _error(
            status.HTTP_500_INTERNAL_SERVER_ERROR, "internal_error", INTERNAL_ERROR_MESSAGE
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        where = ".".join(str(part) for part in first.get("loc", ()))
        message = f"{where}: {first.get('msg', 'invalid request')}" if where else "Invalid request."
        return _error(status.HTTP_422_UNPROCESSABLE_CONTENT, "validation_error", message)
