"""FastAPI app: one modular monolith, one module per role (see docs/ARCHITECTURE.md)."""

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.accounts.router import router as accounts_router
from app.certificates.router import router as certificates_router
from app.core.bodylimit import BodySizeLimitMiddleware, max_body_bytes
from app.core.errors import register_error_handlers
from app.core.settings import get_settings
from app.events.router import router as events_router
from app.exports.router import router as exports_router
from app.notifications.router import router as notifications_router
from app.posters.router import router as posters_router
from app.registrations.router import router as registrations_router
from app.verification.router import router as verification_router

API_PREFIX = "/api/v1"


class HealthResponse(BaseModel):
    status: str
    environment: str


def create_app() -> FastAPI:
    settings = get_settings()
    # `debug` is never passed to FastAPI: Starlette's debug mode answers unhandled errors
    # with a traceback page (SQL, file paths), bypassing the catch-all in app/core/errors.py.
    # Tracebacks go to the log instead.
    if settings.cors_origins and "*" in settings.cors_origins:
        raise ValueError(
            "ORGNISER_CORS_ORIGINS must list explicit origins: the session cookie is sent "
            "with credentials, which browsers and the CORS rules forbid for '*'."
        )
    app = FastAPI(
        title="ORGniser API",
        version="0.1.0",
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=f"{API_PREFIX}/docs",
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_error_handlers(app)
    # Added last so it runs first: oversized bodies are refused before anything reads them.
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=max_body_bytes(settings.max_upload_mb))

    api = APIRouter(prefix=API_PREFIX)

    @api.get("/health", response_model=HealthResponse, tags=["health"])
    def health() -> HealthResponse:
        return HealthResponse(status="ok", environment=settings.environment)

    for module_router in (
        accounts_router,
        events_router,
        registrations_router,
        posters_router,
        exports_router,
        certificates_router,
        notifications_router,
        verification_router,
    ):
        api.include_router(module_router)

    app.include_router(api)
    return app


app = create_app()
