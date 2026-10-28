"""Rate limiting with a fake Redis: no real Redis needed."""

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from redis import ConnectionError as RedisConnectionError

from app.core import ratelimit
from app.core.errors import register_error_handlers
from app.core.settings import get_settings


class FakeRedis:
    def __init__(self) -> None:
        self.counts: dict[str, int] = {}
        self.expiries: dict[str, int] = {}

    def incr(self, key: str) -> int:
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    def expire(self, key: str, seconds: int) -> None:
        self.expiries[key] = seconds


class DownRedis:
    def incr(self, key: str) -> int:
        raise RedisConnectionError("Redis is down")

    def expire(self, key: str, seconds: int) -> None:  # pragma: no cover - never reached
        raise RedisConnectionError("Redis is down")


def _client() -> TestClient:
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/login", dependencies=[Depends(ratelimit.login_rate_limit)])
    def login() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/public", dependencies=[Depends(ratelimit.public_rate_limit)])
    def public() -> dict[str, bool]:
        return {"ok": True}

    return TestClient(app)


def test_allows_requests_under_the_limit(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(ratelimit, "get_ratelimit_redis", lambda: fake)
    client = _client()
    limit = get_settings().rate_limit_login_per_minute
    for _ in range(limit):
        assert client.get("/login").status_code == 200
    (key,) = fake.counts
    assert key.startswith("ratelimit:login:")
    assert fake.expiries[key] == 60


def test_rejects_with_429_over_the_limit(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(ratelimit, "get_ratelimit_redis", lambda: fake)
    client = _client()
    limit = get_settings().rate_limit_login_per_minute
    for _ in range(limit):
        client.get("/login")
    response = client.get("/login")
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"


def test_buckets_are_counted_separately(monkeypatch):
    fake = FakeRedis()
    monkeypatch.setattr(ratelimit, "get_ratelimit_redis", lambda: fake)
    client = _client()
    for _ in range(get_settings().rate_limit_login_per_minute):
        client.get("/login")
    assert client.get("/login").status_code == 429
    assert client.get("/public").status_code == 200


def test_fails_open_when_redis_is_unreachable(monkeypatch, caplog):
    monkeypatch.setattr(ratelimit, "get_ratelimit_redis", lambda: DownRedis())
    client = _client()
    for _ in range(get_settings().rate_limit_login_per_minute + 5):
        assert client.get("/login").status_code == 200
    assert "Redis unavailable" in caplog.text


def test_unknown_setting_is_rejected_at_definition():
    with pytest.raises(ValueError):
        ratelimit.rate_limit("x", "no_such_setting")
