"""The outbox email stand-in (docs/PROTOTYPE.md). Tests write to tmp_path, never backend/outbox/."""

import logging
from email import policy
from email.parser import BytesParser
from pathlib import Path

from app.core.email import EmailMessage, OutboxEmailSender, get_email_sender
from app.core.settings import get_settings

SENDER = "ORGniser <no-reply@orgniser.local>"


def _read(path: Path):
    return BytesParser(policy=policy.default).parsebytes(path.read_bytes())


def test_send_writes_one_parseable_eml(tmp_path: Path) -> None:
    outbox = tmp_path / "outbox"  # missing on purpose: the sender creates it
    sender = OutboxEmailSender(outbox, SENDER)

    sender.send(EmailMessage(to="student@uni.edu", subject="Reset your password", text="Hello"))

    files = list(outbox.glob("*.eml"))
    assert len(files) == 1
    mail = _read(files[0])
    assert mail["From"] == SENDER
    assert mail["To"] == "student@uni.edu"
    assert mail["Subject"] == "Reset your password"
    assert mail["Date"] is not None
    assert mail.get_content_type() == "text/plain"
    assert mail.get_content().strip() == "Hello"


def test_html_makes_multipart_alternative(tmp_path: Path) -> None:
    sender = OutboxEmailSender(tmp_path, SENDER)

    sender.send(EmailMessage(to="a@uni.edu", subject="S", text="Plain", html="<p>Rich</p>"))

    mail = _read(next(tmp_path.glob("*.eml")))
    assert mail.get_content_type() == "multipart/alternative"
    assert mail.get_body(preferencelist=("plain",)).get_content().strip() == "Plain"
    assert mail.get_body(preferencelist=("html",)).get_content().strip() == "<p>Rich</p>"


def test_returned_id_matches_message_id_and_file_name(tmp_path: Path) -> None:
    sender = OutboxEmailSender(tmp_path, SENDER)

    message_id = sender.send(EmailMessage(to="a@uni.edu", subject="S", text="T"))

    path = next(tmp_path.glob("*.eml"))
    assert path.stem.endswith(f"_{message_id}")
    assert _read(path)["Message-ID"].strip("<>").split("@")[0] == message_id


def test_log_has_to_and_subject_but_not_body(tmp_path: Path, caplog) -> None:
    sender = OutboxEmailSender(tmp_path, SENDER)
    secret = "https://orgniser.local/reset?token=very-secret-token"

    with caplog.at_level(logging.INFO, logger="app.core.email"):
        message_id = sender.send(EmailMessage(to="a@uni.edu", subject="Reset", text=secret))

    records = [r for r in caplog.records if r.name == "app.core.email"]
    assert len(records) == 1
    line = records[0].getMessage()
    assert "a@uni.edu" in line
    assert "Reset" in line
    assert message_id in line
    assert secret not in caplog.text
    assert "very-secret-token" not in caplog.text


def test_two_sends_make_two_files(tmp_path: Path) -> None:
    sender = OutboxEmailSender(tmp_path, SENDER)

    first = sender.send(EmailMessage(to="a@uni.edu", subject="One", text="1"))
    second = sender.send(EmailMessage(to="b@uni.edu", subject="Two", text="2"))

    assert first != second
    files = sorted(tmp_path.glob("*.eml"))
    assert len(files) == 2
    # Names start with a UTC timestamp, so sorting by name sorts by send time.
    assert [_read(f)["Subject"] for f in files] == ["One", "Two"]


def test_get_email_sender_defaults_to_outbox(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setenv("ORGNISER_EMAIL_PROVIDER", "")
    monkeypatch.setenv("ORGNISER_EMAIL_OUTBOX_DIR", str(tmp_path))
    get_settings.cache_clear()
    get_email_sender.cache_clear()
    try:
        sender = get_email_sender()
        assert isinstance(sender, OutboxEmailSender)
        assert sender.outbox_dir == tmp_path
        assert get_email_sender() is sender  # cached
    finally:
        get_settings.cache_clear()
        get_email_sender.cache_clear()
