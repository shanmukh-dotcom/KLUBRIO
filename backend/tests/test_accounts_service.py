"""Pure tests for accounts logic (no database)."""

from datetime import UTC, datetime, timedelta

from app.accounts import service


def test_normalise_email_lowercases_and_strips():
    assert service.normalise_email("  Asha.K@Uni.EDU ") == "asha.k@uni.edu"
    assert service.normalise_email("asha@uni.edu") == "asha@uni.edu"


def test_token_expires_at_adds_ttl():
    now = datetime(2026, 10, 25, 12, 0, tzinfo=UTC)
    assert service.token_expires_at(now, timedelta(minutes=60)) == datetime(
        2026, 10, 25, 13, 0, tzinfo=UTC
    )
    assert service.token_expires_at(now, service.SET_PASSWORD_TTL) == datetime(
        2026, 11, 1, 12, 0, tzinfo=UTC
    )


def test_token_is_usable_only_before_expiry_and_once():
    now = datetime(2026, 10, 25, 12, 0, tzinfo=UTC)
    later = now + timedelta(minutes=1)
    assert service.token_is_usable(later, None, now)
    assert not service.token_is_usable(now, None, now)  # expiry instant is already too late
    assert not service.token_is_usable(now - timedelta(seconds=1), None, now)
    assert not service.token_is_usable(later, now, now)  # already used


def test_reset_link_points_at_frontend(monkeypatch):
    class FakeSettings:
        frontend_base_url = "https://orgniser.example/"

    monkeypatch.setattr(service, "get_settings", lambda: FakeSettings())
    assert service.reset_link("abc") == "https://orgniser.example/reset-password?token=abc"
