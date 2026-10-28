"""Job queue (RQ on Redis). Heavy work never runs inside a request (RULES.md, engineering rule 2.1).

Run a worker locally with:  uv run rq worker --url redis://localhost:6379/0 default
On Windows, RQ's forking worker is unavailable; use:  uv run python -m app.jobs.worker

Job convention: each job module has `do_<job>(db, ...)`, the testable core that works inside a
given session, and `<job>(...)`, the RQ entry point that opens its own session via
`job_session()` and commits. Endpoints call `enqueue(<job>, ...)`; tests replace `enqueue`.
"""

import re
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from functools import lru_cache
from typing import Any

from redis import Redis
from redis.exceptions import RedisError
from rq import Queue
from sqlalchemy.orm import Session, sessionmaker

# Every model must be registered before a job opens a session: a worker process only imports
# the job it runs, and a foreign key to a table whose model wasn't imported can't be resolved.
import app.core.models  # noqa: F401, E402
from app.core.db import get_engine
from app.core.errors import AppError
from app.core.settings import get_settings

DEFAULT_QUEUE = "default"

# RQ rejects any other character in a job id, so check it before Redis is touched.
JOB_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")


def validate_job_id(job_id: str | None) -> None:
    """Raise ValueError for a job id RQ would refuse. Called by `enqueue` and by the test
    stand-in, so a bad id fails in tests too, not only against a real queue."""
    if job_id is not None and not JOB_ID_PATTERN.fullmatch(job_id):
        raise ValueError(
            f"Job id {job_id!r} is invalid: use only letters, digits, underscores and dashes."
        )


@lru_cache
def get_redis() -> Redis:
    return Redis.from_url(get_settings().redis_url, socket_connect_timeout=2)


def get_queue(name: str = DEFAULT_QUEUE) -> Queue:
    return Queue(name, connection=get_redis())


def enqueue(func: Callable[..., Any], *args: Any, job_id: str | None = None) -> None:
    """Queue `func(*args)` for a worker. A fixed `job_id` stops the same job being queued twice."""
    validate_job_id(job_id)
    try:
        get_queue().enqueue(func, *args, job_id=job_id)
    except RedisError as exc:
        raise AppError(
            "queue_unavailable",
            "The job queue (Redis) is not reachable. Start it with `docker compose up -d`.",
            503,
        ) from exc


@contextmanager
def job_session() -> Iterator[Session]:
    """A session for one job run: committed on success, rolled back on error."""
    session = sessionmaker(bind=get_engine(), expire_on_commit=False)()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
