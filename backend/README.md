# Klubrio backend

The API behind the Klubrio frontend: accounts and Club Roles, Events and Registration Forms, Registrations with Seat Limits, Event QR and Posters, Exports, Attendance, Certificates, notifications and the public Verification Page.

Python 3.12, FastAPI, PostgreSQL, Redis (RQ job queue). The code still uses the project's working name, ORGniser, for settings (`ORGNISER_*`) and the database.

## Connecting the frontend

- Every route is under `/api/v1`. The full contract is [`docs/api/openapi.json`](docs/api/openapi.json); with the server running, browse it at <http://localhost:8000/api/v1/docs>.
- Login uses an HTTP-only session cookie, so the frontend must send requests with credentials (`fetch(url, { credentials: "include" })`).
- Allowed frontend origins: `ORGNISER_CORS_ORIGINS` (default `["http://localhost:3000"]`, the Next.js dev server).
- Links in QR codes and emails point at `ORGNISER_FRONTEND_BASE_URL` (default `http://localhost:3000`). The frontend serves these pages: `/events/{id}`, `/verify/{certificate_id}`, `/me/certificates` and `/reset-password?token=...`.
- Errors always look like `{"error": {"code": "...", "message": "..."}}`.
- File storage and email use local stand-ins for now: files go to `backend/storage/` and emails are saved as `.eml` files in `backend/outbox/`. Real providers are added behind the same interfaces later.

## Run locally

In `backend/`, start PostgreSQL (host port **5433**) and Redis:

```bash
docker compose up -d
```

Then:

```bash
uv sync
cp .env.example .env
uv run alembic upgrade head
uv run python scripts/create_admin.py --email admin@example.com --name "Admin" --password "change-me-please"
uv run uvicorn app.main:app --reload
```

- Health: <http://localhost:8000/api/v1/health>
- API docs: <http://localhost:8000/api/v1/docs>

## Worker

```bash
uv run python -m app.jobs.worker
```

This uses RQ's non-forking worker, so it also runs on Windows.

## Run the whole product end to end

`scripts/e2e.py` drives every feature over HTTP, the way the frontend does. Each run uses new accounts, so you can run it again and again.

1. Create the first Platform Admin. There is no API for this. Running it again is safe.

   ```bash
   uv run python scripts/create_admin.py --email admin@uni.edu --name "Admin" --password "change-me-please"
   ```

   The e2e script makes its own admin this way, so you don't need this step for it.

2. Start the server and the worker with the same settings, each in its own terminal. Use a temp folder for files and emails. The rate limits are raised because every request comes from 127.0.0.1.

   ```bash
   export ORGNISER_REDIS_URL=redis://localhost:6379/2
   export ORGNISER_STORAGE_LOCAL_DIR=/tmp/orgniser-e2e/storage
   export ORGNISER_EMAIL_OUTBOX_DIR=/tmp/orgniser-e2e/outbox
   export ORGNISER_RATE_LIMIT_LOGIN_PER_MINUTE=100000
   export ORGNISER_RATE_LIMIT_PUBLIC_PER_MINUTE=100000

   uv run uvicorn app.main:app --port 8002     # terminal 1
   uv run python -m app.jobs.worker            # terminal 2
   ```

3. Run the script. Give it the same outbox folder, because it reads the emails from there.

   ```bash
   uv run python scripts/e2e.py --base-url http://localhost:8002 --outbox /tmp/orgniser-e2e/outbox
   ```

It prints one numbered PASS or FAIL line per check, then a summary. It exits with a non-zero code if any check failed. A full run takes about five minutes.

## Test and lint

```bash
uv run ruff format .
uv run ruff check .
uv run pytest
```

Database and Redis tests are skipped if those services aren't running. CI runs everything on every push.

## Migrations

```bash
uv run alembic revision --autogenerate -m "short description"
uv run alembic upgrade head
```

Read every generated migration before committing. Autogenerate doesn't drop Postgres enum types on downgrade, so add that by hand. P6 reviews every migration.

## After changing an endpoint

```bash
uv run python scripts/export_openapi.py
```

Commit the updated `docs/api/openapi.json`. CI fails if it's out of date.

## Settings

All settings come from environment variables prefixed `ORGNISER_` (see [`app/core/settings.py`](app/core/settings.py) and [`.env.example`](.env.example)).
