"""Application settings, read from environment variables (and `.env` in local dev).

Secrets live in the environment, never in the repository (RULES.md, engineering rule 9).
File storage and email use local stand-ins while their provider settings are empty
(docs/PROTOTYPE.md); filling a provider setting in switches to the real one (docs/PROVIDERS.md).
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="ORGNISER_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["local", "test", "production"] = "local"
    debug: bool = False

    # Per process. Keep workers x (pool_size + max_overflow) well under Postgres'
    # max_connections (100 by default); see the Phase 7a load test in MEMORY.md.
    db_pool_size: int = Field(default=10, ge=1)
    db_max_overflow: int = Field(default=5, ge=0)
    db_pool_timeout_seconds: int = Field(default=10, ge=1)

    database_url: str = Field(
        default="postgresql+psycopg://orgniser:orgniser@localhost:5433/orgniser",
        description="SQLAlchemy URL for PostgreSQL (docker-compose maps it to host port 5433).",
    )
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        description="Redis URL for the job queue.",
    )

    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"],
        description="Origins allowed to call the API (the Next.js frontend).",
    )

    frontend_base_url: str = Field(
        default="http://localhost:3000",
        description=(
            "Public URL of the Next.js frontend. The Event QR, Certificate verification QR "
            "and email links point here."
        ),
    )

    # Auth: password login with an HTTP-only session cookie (decisions 24, 25).
    session_cookie_name: str = "orgniser_session"
    session_ttl_days: int = Field(default=30, ge=1)
    password_reset_ttl_minutes: int = Field(default=60, ge=5)

    # Upload limits (decision 30).
    max_upload_mb: int = Field(default=20, ge=1)
    max_template_pages: int = Field(default=2, ge=1)

    # Abuse limits on public and auth endpoints (decision 31).
    rate_limit_public_per_minute: int = Field(default=60, ge=1)
    # The public Event page gets its own, much higher limit: phones scanning a poster on
    # campus Wi-Fi often share one public IP (Phase 7a load test). Counted per Event + IP.
    rate_limit_event_page_per_minute: int = Field(default=3000, ge=1)
    rate_limit_login_per_minute: int = Field(default=10, ge=1)

    # Providers (docs/PROTOTYPE.md). Empty = use the local stand-in.
    storage_provider: str = Field(
        default="",
        description="File storage provider. Empty uses the local folder in storage_local_dir.",
    )
    storage_local_dir: Path = Field(
        default=BACKEND_DIR / "storage",
        description="Folder the local storage stand-in writes to (git-ignored).",
    )
    email_provider: str = Field(
        default="",
        description="Email provider. Empty writes each email to the log and to email_outbox_dir.",
    )
    email_outbox_dir: Path = Field(
        default=BACKEND_DIR / "outbox",
        description="Folder the outbox email stand-in writes to (git-ignored).",
    )
    email_from: str = Field(
        default="ORGniser <no-reply@orgniser.local>",
        description="From address on every email.",
    )
    email_webhook_secret: str = Field(
        default="",
        description=(
            "Shared secret the email provider sends in X-Webhook-Secret on POST /webhooks/email. "
            "Empty accepts every call locally; in production an empty value makes the webhook "
            "answer 503 `webhook_not_configured`."
        ),
    )

    @property
    def cookie_secure(self) -> bool:
        """Send the session cookie over HTTPS only, except in local development."""
        return self.environment != "local"


@lru_cache
def get_settings() -> Settings:
    return Settings()
