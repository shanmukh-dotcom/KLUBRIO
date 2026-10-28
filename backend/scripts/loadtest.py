"""Load test for the poster-QR peak (PRD N1: 2,000 QR scans in one minute).

Seeds its own University, Club, President, an Event (Seat Limit 150, no Approval, deadline
tomorrow) with a small Registration Form, and 300 Students (half with login sessions).
Then it runs these scenarios against a running server:

- steady:        2,000 GET /events/{id}/public spread evenly over 60 s (~33/s), half with a
                 session cookie (so eligibility and registration status are looked up).
- burst:         2,000 GET /events/{id}/public as fast as possible at concurrency 100.
- register-rush: 300 distinct logged-in Students POST a Registration at concurrency 100 for
                 150 seats. Afterwards exactly 150 must be Confirmed, the rest 409
                 `registration_closed`.
- ratelimit:     (informational, not in the default set) 200 GET public-page requests,
                 counting 429s. Run it against a server with the default public limit.

Every request carries a 10 s timeout. Any 5xx or timeout fails the run (exit code 1).
Seed rows are tagged with a run id and deleted at the end (FK order) unless --keep.

Usage (from backend/, server already running on the port):

    ORGNISER_REDIS_URL=redis://localhost:6379/1 \\
    ORGNISER_RATE_LIMIT_PUBLIC_PER_MINUTE=1000000 \\
    ORGNISER_RATE_LIMIT_LOGIN_PER_MINUTE=1000000 \\
        uv run uvicorn app.main:app --port 8001 --workers 4 &
    uv run python scripts/loadtest.py --base-url http://localhost:8001

    # Default rate limit check (server started without the raised public limit):
    uv run python scripts/loadtest.py --scenarios ratelimit

Flags: --base-url, --scenarios (comma list), --steady-requests, --steady-seconds,
--burst-requests, --concurrency, --students, --seats, --timeout, --redis-url, --keep.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import statistics
import sys
import time
import uuid
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import delete, func, select, text  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.accounts.models import (  # noqa: E402
    Club,
    ClubRole,
    ClubRoleKind,
    LoginSession,
    Student,
    University,
)
from app.core.auth import create_session  # noqa: E402
from app.core.db import get_engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.core.settings import get_settings  # noqa: E402
from app.events.models import (  # noqa: E402
    EligibilityRule,
    Event,
    FormField,
    FormFieldType,
    RegistrationForm,
)
from app.registrations.models import Registration, RegistrationStatus  # noqa: E402

API = "/api/v1"
ALL_SCENARIOS = ("steady", "burst", "register-rush")


# --------------------------------------------------------------------------- seed


@dataclass
class Seed:
    run_id: str
    university_id: uuid.UUID
    club_id: uuid.UUID
    president_id: uuid.UUID
    event_id: uuid.UUID
    student_ids: list[uuid.UUID]
    # Raw session tokens, index-aligned with student_ids; None = no session yet.
    tokens: list[str | None]


def seed(students: int, seats: int) -> Seed:
    run_id = uuid.uuid4().hex[:10]
    # One Argon2 hash reused for every seeded Student: hashing 300 passwords would take
    # seconds and nobody logs in with a password here.
    pw_hash = hash_password(f"loadtest-{run_id}")
    now = datetime.now(UTC)
    with Session(get_engine()) as db:
        uni = University(name=f"Loadtest University {run_id}")
        db.add(uni)
        db.flush()
        club = Club(university_id=uni.id, name=f"Loadtest Club {run_id}", slug=f"lt-{run_id}")
        db.add(club)
        db.flush()

        def student(i: int | str) -> Student:
            return Student(
                email=f"lt-{run_id}-{i}@loadtest.invalid",
                password_hash=pw_hash,
                name=f"Loadtest {run_id} {i}",
                roll_no=f"LT{run_id}{i}",
                department="CSE",
                year=3,
                section="A",
            )

        president = student("president")
        db.add(president)
        db.flush()
        db.add(ClubRole(club_id=club.id, student_id=president.id, role=ClubRoleKind.PRESIDENT))
        event = Event(
            club_id=club.id,
            name=f"Loadtest Event {run_id}",
            description="Load test",
            starts_at=now + timedelta(days=7),
            ends_at=now + timedelta(days=7, hours=3),
            venue="Main Hall",
            approval_required=False,
            seat_limit=seats,
            registration_deadline=now + timedelta(days=1),
            created_by=president.id,
        )
        db.add(event)
        db.flush()
        form = RegistrationForm(event_id=event.id)
        db.add(form)
        db.flush()
        db.add_all(
            [
                FormField(
                    form_id=form.id,
                    key="team",
                    label="Team name",
                    type=FormFieldType.SHORT_TEXT,
                    required=True,
                    position=0,
                ),
                FormField(
                    form_id=form.id,
                    key="tshirt",
                    label="T-shirt size",
                    type=FormFieldType.SINGLE_CHOICE,
                    options=["S", "M", "L"],
                    required=False,
                    position=1,
                ),
            ]
        )
        # An Eligibility Rule everyone passes, so the eligibility check does real work.
        db.add(
            EligibilityRule(event_id=event.id, field="department", operator="in", values=["CSE"])
        )
        rows = [student(i) for i in range(students)]
        db.add_all(rows)
        db.flush()
        tokens: list[str | None] = [
            create_session(db, s) if i % 2 == 0 else None for i, s in enumerate(rows)
        ]
        db.commit()
        return Seed(
            run_id=run_id,
            university_id=uni.id,
            club_id=club.id,
            president_id=president.id,
            event_id=event.id,
            student_ids=[s.id for s in rows],
            tokens=tokens,
        )


def log_in_everyone(s: Seed) -> None:
    """Give the Students without a session one, so all of them can register."""
    with Session(get_engine()) as db:
        for i, sid in enumerate(s.student_ids):
            if s.tokens[i] is None:
                s.tokens[i] = create_session(db, db.get(Student, sid))
        db.commit()


def cleanup(s: Seed) -> dict[str, int]:
    """Delete every seeded row, children first."""
    everyone = [*s.student_ids, s.president_id]
    counts: dict[str, int] = {}
    with Session(get_engine()) as db:
        steps = [
            ("registrations", delete(Registration).where(Registration.event_id == s.event_id)),
            ("sessions", delete(LoginSession).where(LoginSession.student_id.in_(everyone))),
            (
                "eligibility_rules",
                delete(EligibilityRule).where(EligibilityRule.event_id == s.event_id),
            ),
            (
                "form_fields",
                delete(FormField).where(
                    FormField.form_id.in_(
                        select(RegistrationForm.id).where(RegistrationForm.event_id == s.event_id)
                    )
                ),
            ),
            (
                "registration_forms",
                delete(RegistrationForm).where(RegistrationForm.event_id == s.event_id),
            ),
            ("events", delete(Event).where(Event.id == s.event_id)),
            ("club_roles", delete(ClubRole).where(ClubRole.club_id == s.club_id)),
            ("students", delete(Student).where(Student.id.in_(everyone))),
            ("clubs", delete(Club).where(Club.id == s.club_id)),
            ("universities", delete(University).where(University.id == s.university_id)),
        ]
        for name, stmt in steps:
            counts[name] = db.execute(stmt).rowcount
        db.commit()
        leftover = db.scalar(
            select(func.count()).select_from(Student).where(Student.email.like(f"lt-{s.run_id}-%"))
        )
        counts["leftover_students"] = leftover
    return counts


def confirmed_count(event_id: uuid.UUID) -> tuple[int, int]:
    with Session(get_engine()) as db:
        confirmed = db.scalar(
            select(func.count())
            .select_from(Registration)
            .where(
                Registration.event_id == event_id,
                Registration.status == RegistrationStatus.CONFIRMED,
            )
        )
        total = db.scalar(
            select(func.count()).select_from(Registration).where(Registration.event_id == event_id)
        )
    return confirmed, total


# --------------------------------------------------------------------------- measuring


@dataclass
class Result:
    name: str
    latencies: list[float] = field(default_factory=list)
    statuses: Counter = field(default_factory=Counter)
    error_codes: Counter = field(default_factory=Counter)
    timeouts: int = 0
    errors: Counter = field(default_factory=Counter)
    wall: float = 0.0
    notes: list[str] = field(default_factory=list)

    @property
    def count(self) -> int:
        return sum(self.statuses.values()) + self.timeouts + sum(self.errors.values())

    @property
    def server_errors(self) -> int:
        return sum(n for code, n in self.statuses.items() if code >= 500)

    @property
    def successes(self) -> int:
        return sum(n for code, n in self.statuses.items() if 200 <= code < 300)


def pct(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    ordered = sorted(values)
    k = max(0, min(len(ordered) - 1, round(p / 100 * len(ordered) + 0.5) - 1))
    return ordered[k]


async def timed(client: httpx.AsyncClient, res: Result, method: str, url: str, **kw) -> None:
    start = time.perf_counter()
    try:
        resp = await client.request(method, url, **kw)
    except httpx.TimeoutException:
        res.timeouts += 1
        return
    except httpx.HTTPError as exc:
        res.errors[type(exc).__name__] += 1
        return
    res.latencies.append((time.perf_counter() - start) * 1000)
    res.statuses[resp.status_code] += 1
    if resp.status_code >= 400:
        try:
            res.error_codes[resp.json()["error"]["code"]] += 1
        except Exception:
            res.error_codes["(unparsed)"] += 1


def cookie_header(token: str | None) -> dict[str, str]:
    if token is None:
        return {}
    return {"Cookie": f"{get_settings().session_cookie_name}={token}"}


def new_client(base_url: str, timeout: float, concurrency: int) -> httpx.AsyncClient:
    limits = httpx.Limits(max_connections=concurrency, max_keepalive_connections=concurrency)
    return httpx.AsyncClient(base_url=base_url, timeout=timeout, limits=limits)


class PgSampler:
    """Polls pg_stat_activity in the background (one extra connection)."""

    def __init__(self) -> None:
        self.samples: list[int] = []
        self._stop = asyncio.Event()

    def _sample(self) -> int:
        with get_engine().connect() as conn:
            return conn.execute(
                text("select count(*) from pg_stat_activity where datname = current_database()")
            ).scalar_one()

    async def run(self) -> None:
        while not self._stop.is_set():
            with contextlib.suppress(Exception):
                self.samples.append(await asyncio.to_thread(self._sample))
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._stop.wait(), 0.25)

    def stop(self) -> None:
        self._stop.set()


async def with_sampler(res: Result, coro) -> None:
    sampler = PgSampler()
    task = asyncio.create_task(sampler.run())
    try:
        await coro
    finally:
        sampler.stop()
        await task
    if sampler.samples:
        res.notes.append(
            f"pg_stat_activity connections: min {min(sampler.samples)}, "
            f"max {max(sampler.samples)}, samples {len(sampler.samples)}"
        )


# --------------------------------------------------------------------------- scenarios


def page_url(s: Seed) -> str:
    return f"{API}/events/{s.event_id}/public"


async def steady(args, s: Seed) -> Result:
    res = Result("steady")
    sessions = [t for t in s.tokens if t is not None]
    interval = args.steady_seconds / args.steady_requests
    async with new_client(args.base_url, args.timeout, 500) as client:

        async def go() -> None:
            tasks = []
            t0 = time.perf_counter()
            for i in range(args.steady_requests):
                delay = t0 + i * interval - time.perf_counter()
                if delay > 0:
                    await asyncio.sleep(delay)
                token = sessions[i // 2 % len(sessions)] if i % 2 else None
                tasks.append(
                    asyncio.create_task(
                        timed(client, res, "GET", page_url(s), headers=cookie_header(token))
                    )
                )
            await asyncio.gather(*tasks)
            res.wall = time.perf_counter() - t0

        await with_sampler(res, go())
    return res


async def pooled(args, s: Seed, res: Result, jobs: list[tuple[str, str, dict]]) -> None:
    queue: asyncio.Queue = asyncio.Queue()
    for job in jobs:
        queue.put_nowait(job)
    async with new_client(args.base_url, args.timeout, args.concurrency) as client:

        async def worker() -> None:
            while True:
                try:
                    method, url, kw = queue.get_nowait()
                except asyncio.QueueEmpty:
                    return
                await timed(client, res, method, url, **kw)

        t0 = time.perf_counter()
        await asyncio.gather(*(worker() for _ in range(args.concurrency)))
        res.wall = time.perf_counter() - t0


async def burst(args, s: Seed) -> Result:
    res = Result("burst")
    sessions = [t for t in s.tokens if t is not None]
    jobs = [
        (
            "GET",
            page_url(s),
            {"headers": cookie_header(sessions[i // 2 % len(sessions)] if i % 2 else None)},
        )
        for i in range(args.burst_requests)
    ]
    await with_sampler(res, pooled(args, s, res, jobs))
    return res


async def register_rush(args, s: Seed) -> Result:
    res = Result("register-rush")
    log_in_everyone(s)
    url = f"{API}/events/{s.event_id}/registrations"
    jobs = [
        ("POST", url, {"headers": cookie_header(t), "json": {"answers": {"team": f"T{i}"}}})
        for i, t in enumerate(s.tokens)
    ]
    await with_sampler(res, pooled(args, s, res, jobs))
    confirmed, total = confirmed_count(s.event_id)
    res.notes.append(f"DB after rush: {confirmed} confirmed, {total} registration rows")
    expected_closed = len(s.tokens) - args.seats
    ok = (
        confirmed == args.seats
        and total == args.seats
        and res.statuses.get(201, 0) == args.seats
        and res.error_codes.get("registration_closed", 0) == expected_closed
    )
    res.notes.append(
        f"seat check: expected {args.seats} confirmed + {expected_closed} registration_closed"
        f" -> {'OK' if ok else 'MISMATCH'}"
    )
    res.rush_ok = ok  # type: ignore[attr-defined]
    return res


async def ratelimit(args, s: Seed) -> Result:
    res = Result("ratelimit")
    # Start from an empty counter for this IP in our Redis DB, so earlier scenarios in the
    # same minute don't skew the count.
    try:
        from redis import Redis

        r = Redis.from_url(args.redis_url, socket_connect_timeout=1)
        for key in r.scan_iter("ratelimit:public:*"):
            r.delete(key)
    except Exception as exc:
        res.notes.append(f"could not reset rate-limit keys: {exc}")
    jobs = [("GET", page_url(s), {}) for _ in range(200)]
    await pooled(args, s, res, jobs)
    res.notes.append(f"429 responses: {res.statuses.get(429, 0)} of {res.count}")
    return res


SCENARIOS = {
    "steady": steady,
    "burst": burst,
    "register-rush": register_rush,
    "ratelimit": ratelimit,
}


# --------------------------------------------------------------------------- report


def report(res: Result) -> None:
    lat = res.latencies
    tput = res.count / res.wall if res.wall else 0.0
    print(f"\n=== {res.name} ===")
    print(f"  requests       {res.count}")
    print(f"  successes      {res.successes}")
    print(f"  status codes   {dict(sorted(res.statuses.items()))}")
    if res.error_codes:
        print(f"  error codes    {dict(res.error_codes)}")
    print(f"  timeouts       {res.timeouts}")
    print(f"  other errors   {dict(res.errors) or 0}")
    print(f"  server errors  {res.server_errors}")
    print(f"  wall time      {res.wall:.2f} s")
    print(f"  throughput     {tput:.1f} req/s")
    if lat:
        print(
            f"  latency ms     p50 {pct(lat, 50):.1f}  p95 {pct(lat, 95):.1f}  "
            f"p99 {pct(lat, 99):.1f}  max {max(lat):.1f}  mean {statistics.fmean(lat):.1f}"
        )
    for note in res.notes:
        print(f"  {note}")


def judge(res: Result, args) -> list[str]:
    failures = []
    if res.name == "ratelimit":
        return failures
    if res.server_errors:
        failures.append(f"{res.name}: {res.server_errors} server errors")
    if res.timeouts:
        failures.append(f"{res.name}: {res.timeouts} timeouts")
    if res.errors:
        failures.append(f"{res.name}: transport errors {dict(res.errors)}")
    if res.name == "steady":
        if pct(res.latencies, 95) >= 500:
            failures.append(f"steady: p95 {pct(res.latencies, 95):.0f} ms >= 500 ms")
        if res.wall > args.steady_seconds + 1.5:
            failures.append(f"steady: took {res.wall:.1f} s (> {args.steady_seconds + 1.5} s)")
        if res.successes != res.count:
            failures.append(f"steady: only {res.successes}/{res.count} succeeded")
    if res.name == "burst" and res.successes != res.count:
        failures.append(f"burst: only {res.successes}/{res.count} succeeded")
    if res.name == "register-rush" and not getattr(res, "rush_ok", False):
        failures.append("register-rush: seat count check failed")
    return failures


# --------------------------------------------------------------------------- main


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--base-url", default="http://localhost:8001")
    p.add_argument("--scenarios", default=",".join(ALL_SCENARIOS))
    p.add_argument("--steady-requests", type=int, default=2000)
    p.add_argument("--steady-seconds", type=float, default=60.0)
    p.add_argument("--burst-requests", type=int, default=2000)
    p.add_argument("--concurrency", type=int, default=100)
    p.add_argument("--students", type=int, default=300)
    p.add_argument("--seats", type=int, default=150)
    p.add_argument("--timeout", type=float, default=10.0)
    p.add_argument("--redis-url", default="redis://localhost:6379/1")
    p.add_argument("--keep", action="store_true", help="don't delete the seed data")
    return p.parse_args()


async def amain(args) -> int:
    names = [n.strip() for n in args.scenarios.split(",") if n.strip()]
    unknown = [n for n in names if n not in SCENARIOS]
    if unknown:
        print(f"Unknown scenarios: {unknown}. Choose from {list(SCENARIOS)}")
        return 2

    async with httpx.AsyncClient(base_url=args.base_url, timeout=5) as c:
        health = await c.get(f"{API}/health")
        health.raise_for_status()

    s = seed(args.students, args.seats)
    print(f"run id {s.run_id}; event {s.event_id}; {len(s.student_ids)} students")
    failures: list[str] = []
    try:
        for name in names:
            res = await SCENARIOS[name](args, s)
            report(res)
            failures += judge(res, args)
    finally:
        if args.keep:
            print(f"\n--keep: seed data left in place (run id {s.run_id})")
        else:
            print(f"\ncleanup: {cleanup(s)}")

    print("\nRESULT:", "PASS" if not failures else "FAIL")
    for f in failures:
        print(f"  - {f}")
    return 1 if failures else 0


def main() -> None:
    sys.exit(asyncio.run(amain(parse_args())))


if __name__ == "__main__":
    main()
