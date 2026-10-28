"""Request body size cap (decision 30), enforced before the body is read.

Starlette parses a multipart upload into a temporary file before the endpoint runs, so the
per-file check in the poster and template services (`read_upload`) only fires after the
whole request has arrived. This middleware stops a request as soon as it is known to be
too big: at once when `Content-Length` says so, otherwise when the streamed bytes pass the
cap. The cap is `max_upload_mb` plus 1 MB for multipart headers and boundaries, so a file
at the limit still reaches `read_upload` and gets its friendlier `file_too_large` message.
"""

from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import ErrorBody, ErrorResponse

MULTIPART_OVERHEAD_BYTES = 1024 * 1024
_CODE = "request_too_large"


def max_body_bytes(max_upload_mb: int) -> int:
    return max_upload_mb * 1024 * 1024 + MULTIPART_OVERHEAD_BYTES


def _message(limit: int) -> str:
    return (
        f"The request is larger than {limit // (1024 * 1024)} MB. "
        "Upload a smaller file and try again."
    )


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        declared = _content_length(scope)
        if declared is not None and declared > self.max_bytes:
            await _reject(send, self.max_bytes)
            return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    # Raised inside the endpoint's body parsing, so FastAPI re-raises it and
                    # the HTTP error handler answers 413 in the project's error shape.
                    raise HTTPException(413, _message(self.max_bytes))
            return message

        await self.app(scope, limited_receive, send)


def _content_length(scope: Scope) -> int | None:
    for name, value in scope.get("headers", ()):
        if name == b"content-length":
            try:
                return int(value)
            except ValueError:
                return None
    return None


async def _reject(send: Send, limit: int) -> None:
    body = (
        ErrorResponse(error=ErrorBody(code=_CODE, message=_message(limit)))
        .model_dump_json()
        .encode()
    )
    await send(
        {
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
                (b"connection", b"close"),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})
