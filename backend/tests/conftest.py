"""Shared fixtures. Database and Redis tests run against the docker-compose services
(or CI's service containers) and are skipped when those aren't reachable."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db import get_engine, get_session
from app.jobs import queue as job_queue
from app.jobs.queue import get_redis
from app.main import create_app

_db_unavailable: str | None = None
_db_probed = False


def _probe_db() -> str | None:
    """Check once per run, so a missing database costs one connect timeout, not one per test."""
    global _db_probed, _db_unavailable
    if not _db_probed:
        _db_probed = True
        try:
            with get_engine().connect() as probe:
                probe.execute(text("select 1 from students limit 0"))
        except Exception as exc:  # pragma: no cover - environment dependent
            _db_unavailable = str(exc).splitlines()[0]
    return _db_unavailable


@pytest.fixture
def db() -> Iterator[Session]:
    """A session inside a transaction that is rolled back after the test."""
    if reason := _probe_db():
        pytest.skip(f"PostgreSQL with migrations applied is not available: {reason}")
    connection = get_engine().connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def redis():
    client = get_redis()
    try:
        client.ping()
    except Exception as exc:  # pragma: no cover - environment dependent
        pytest.skip(f"Redis is not available: {exc}")
    return client


@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    """An API client whose requests use the test's `db` session, so they see its rows and
    everything is rolled back afterwards. Log in with `tests.factories.login`."""
    app = create_app()
    app.dependency_overrides[get_session] = lambda: db
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def enqueued(monkeypatch) -> list[tuple]:
    """Jobs are never sent to Redis in tests; each `enqueue` call is recorded here instead.
    Run a recorded job's `do_<job>(db, ...)` core directly to test what it does."""
    calls: list[tuple] = []

    def fake_enqueue(func, *args, job_id=None):
        job_queue.validate_job_id(job_id)
        calls.append((func, args))

    monkeypatch.setattr(job_queue, "enqueue", fake_enqueue)
    return calls


@pytest.fixture(autouse=True)
def _reset_rate_limits() -> Iterator[None]:
    """Every TestClient request comes from the same IP, so counts would carry over between
    tests and trip the login limit. Clear them per test; the limiter itself is unit-tested
    with a fake Redis in test_ratelimit.py."""
    from app.core.ratelimit import get_ratelimit_redis

    def clear() -> None:
        try:
            client = get_ratelimit_redis()
            keys = list(client.scan_iter("ratelimit:*"))
            if keys:
                client.delete(*keys)
        except Exception:  # pragma: no cover - Redis not running; the limiter fails open
            pass

    clear()
    yield
