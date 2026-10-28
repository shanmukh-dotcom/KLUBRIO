"""Data exposure, error bodies, auth hardening, upload limits and abuse settings
(security review, docs/security-review.md). Access control per route is in
test_security_endpoints.py."""

import io
import uuid

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject, TextStringObject

from app.accounts import service as accounts_service
from app.certificates import render as cert_render
from app.certificates.models import Certificate, CertificateStatus
from app.certificates.tags import TemplateError, detect_tags
from app.core import ratelimit
from app.core.bodylimit import max_body_bytes
from app.core.settings import get_settings
from app.main import API_PREFIX, create_app
from app.posters import render as poster_render
from app.registrations.models import Registration, RegistrationStatus
from tests.factories import PASSWORD, login, make_club, make_event, make_student

PRIVATE_KEYS = {"roll_no", "email", "answers", "student_id", "registration_id", "created_by"}


def _all_keys(value) -> set[str]:
    if isinstance(value, dict):
        keys = set(value)
        for v in value.values():
            keys |= _all_keys(v)
        return keys
    if isinstance(value, list):
        return set().union(*(_all_keys(v) for v in value)) if value else set()
    return set()


# --- /verify and the public Event page (rule 8, N6, decision 29) --------------------------


@pytest.fixture
def certificates(db):
    president = make_student(db)
    club = make_club(db, president=president)
    event = make_event(db, club, president, name="Hackfest")
    holder = make_student(db, roll_no="SECRET-ROLL", email="holder-secret@example.com")
    reg = Registration(
        event_id=event.id,
        student_id=holder.id,
        profile_snapshot={"name": holder.name, "roll_no": "SECRET-ROLL"},
        answers={"team_name": "SECRET-ANSWER"},
        status=RegistrationStatus.CONFIRMED,
    )
    db.add(reg)
    db.flush()

    def cert(public_id, status, **extra):
        c = Certificate(
            public_id=public_id,
            event_id=event.id,
            student_id=holder.id,
            registration_id=reg.id,
            pdf_file_key=f"certificates/{event.id}/{public_id}.pdf",
            display={"name": holder.name, "event": "Hackfest", "club": "C", "date": "2030-01-01"},
            status=status,
            **extra,
        )
        db.add(c)
        db.flush()
        return c

    new = cert("ORG-BBBB-BBBB", CertificateStatus.VALID)
    cert("ORG-CCCC-CCCC", CertificateStatus.SUPERSEDED, superseded_by=new.id)
    cert("ORG-DDDD-DDDD", CertificateStatus.REVOKED, revoked_reason="Did not attend")
    return {"valid": "ORG-BBBB-BBBB", "superseded": "ORG-CCCC-CCCC", "revoked": "ORG-DDDD-DDDD"}


@pytest.mark.parametrize("kind", ["valid", "superseded", "revoked"])
def test_verify_json_never_has_private_fields(client, certificates, kind):
    response = client.get(f"{API_PREFIX}/verify/{certificates[kind]}")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == kind
    assert not _all_keys(body) & PRIVATE_KEYS
    text = response.text
    assert "SECRET-ROLL" not in text
    assert "SECRET-ANSWER" not in text
    assert "holder-secret@example.com" not in text


def test_public_event_page_never_shows_other_students_or_creator(db, client):
    president = make_student(db)
    club = make_club(db, president=president)
    event = make_event(db, club, president)
    other = make_student(db, roll_no="OTHER-ROLL")
    db.add(
        Registration(
            event_id=event.id,
            student_id=other.id,
            profile_snapshot={"name": other.name, "roll_no": "OTHER-ROLL"},
            answers={"x": "OTHER-ANSWER"},
            status=RegistrationStatus.CONFIRMED,
        )
    )
    db.flush()
    for viewer in (None, make_student(db)):
        client.cookies.clear()
        if viewer is not None:
            login(client, db, viewer)
        response = client.get(f"{API_PREFIX}/events/{event.id}/public")
        assert response.status_code == 200
        assert not _all_keys(response.json()) & PRIVATE_KEYS
        for secret in ("OTHER-ROLL", "OTHER-ANSWER", other.email, str(president.id)):
            assert secret not in response.text


# --- error bodies -------------------------------------------------------------------------


@pytest.mark.parametrize("debug", [False, True])
def test_unhandled_error_is_generic_500_even_in_debug(monkeypatch, caplog, debug):
    settings = get_settings().model_copy(update={"debug": debug})
    monkeypatch.setattr("app.main.get_settings", lambda: settings)
    app = create_app()

    def boom() -> None:
        raise RuntimeError("SELECT password_hash FROM students -- C:\\secret\\path.py")

    app.add_api_route(f"{API_PREFIX}/__boom", boom)
    response = TestClient(app, raise_server_exceptions=False).get(f"{API_PREFIX}/__boom")
    assert response.status_code == 500
    body = response.json()
    assert body["error"]["code"] == "internal_error"
    for leak in ("SELECT", "password_hash", "secret", "Traceback", ".py"):
        assert leak not in response.text
    # The details are logged instead.
    assert "RuntimeError" in caplog.text


def test_malformed_json_uses_error_shape_without_echoing_input(client):
    response = client.post(
        f"{API_PREFIX}/auth/login",
        content=b'{"email": "<script>',
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
    assert "<script>" not in response.text


def test_wildcard_cors_origin_is_refused(monkeypatch):
    settings = get_settings().model_copy(update={"cors_origins": ["*"]})
    monkeypatch.setattr("app.main.get_settings", lambda: settings)
    with pytest.raises(ValueError, match="explicit origins"):
        create_app()


def test_cors_answers_only_the_configured_origin():
    app_client = TestClient(create_app())
    allowed = get_settings().cors_origins[0]
    ok = app_client.get(f"{API_PREFIX}/health", headers={"Origin": allowed})
    assert ok.headers.get("access-control-allow-origin") == allowed
    assert ok.headers.get("access-control-allow-credentials") == "true"
    evil = app_client.get(f"{API_PREFIX}/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in evil.headers


# --- auth ---------------------------------------------------------------------------------


def _cookie_header(response) -> str:
    return next(v for k, v in response.headers.items() if k.lower() == "set-cookie")


def test_login_issues_a_fresh_token_and_ignores_a_planted_one(db, client):
    student = make_student(db)
    name = get_settings().session_cookie_name
    client.cookies.set(name, "attacker-chosen-token")
    first = client.post(
        f"{API_PREFIX}/auth/login", json={"email": student.email, "password": PASSWORD}
    )
    second = client.post(
        f"{API_PREFIX}/auth/login", json={"email": student.email, "password": PASSWORD}
    )
    t1, t2 = first.cookies.get(name), second.cookies.get(name)
    assert t1 and t2 and t1 != t2 and "attacker-chosen-token" not in (t1, t2)
    header = _cookie_header(first).lower()
    assert "httponly" in header and "samesite=lax" in header


def test_session_cookie_is_secure_outside_local():
    for env, secure in (("local", False), ("test", True), ("production", True)):
        assert get_settings().model_copy(update={"environment": env}).cookie_secure is secure


def test_passwordless_account_login_still_runs_a_hash(db, client, monkeypatch):
    """Admin-added accounts have no password yet; their 401 must cost the same as any other."""
    student = make_student(db, password_hash=None)
    calls: list[str | None] = []
    real = accounts_service.verify_password

    def counting(password_hash, plain):
        calls.append(password_hash)
        return real(password_hash, plain)

    monkeypatch.setattr(accounts_service, "verify_password", counting)
    response = client.post(
        f"{API_PREFIX}/auth/login", json={"email": student.email, "password": "whatever-123"}
    )
    assert response.status_code == 401
    assert calls and calls[0] is not None  # a real Argon2 hash was checked


def test_password_reset_email_is_sent_after_the_response(db, client, monkeypatch):
    sent: list = []
    monkeypatch.setattr(accounts_service, "send_email", lambda m: sent.append(m))
    student = make_student(db)
    response = client.post(f"{API_PREFIX}/auth/password-reset", json={"email": student.email})
    assert response.status_code == 202
    assert len(sent) == 1  # TestClient runs background tasks before returning


def test_removed_president_loses_club_access_at_once(db, client):
    admin = make_student(db, is_platform_admin=True)
    president = make_student(db)
    club = make_club(db, president=president)
    event = make_event(db, club, president)
    login(client, db, president)
    president_cookie = dict(client.cookies)
    assert client.get(f"{API_PREFIX}/events/{event.id}").status_code == 200

    client.cookies.clear()
    login(client, db, admin)
    assert client.delete(f"{API_PREFIX}/admin/students/{president.id}").status_code == 204

    client.cookies.clear()
    for k, v in president_cookie.items():
        client.cookies.set(k, v)
    assert client.get(f"{API_PREFIX}/events/{event.id}").status_code == 401
    assert client.get(f"{API_PREFIX}/me/certificates").status_code == 401


def test_login_and_reset_and_public_routes_are_rate_limited():
    app = create_app()
    from fastapi.routing import iter_route_contexts

    deps: dict[str, set] = {}
    for route in iter_route_contexts(app.routes):
        dependant = getattr(route.route, "dependant", None)
        if dependant is None:
            continue
        deps[route.path] = {d.call for d in dependant.dependencies}
    assert ratelimit.login_rate_limit in deps[f"{API_PREFIX}/auth/login"]
    assert ratelimit.login_rate_limit in deps[f"{API_PREFIX}/auth/password-reset"]
    assert ratelimit.public_rate_limit in deps[f"{API_PREFIX}/verify/{{public_id}}"]
    # The Event page has its own, higher limit per Event + IP (Phase 7a load test).
    assert ratelimit.event_page_rate_limit in deps[f"{API_PREFIX}/events/{{event_id}}/public"]


# --- webhook --------------------------------------------------------------------------------


def _with_settings(monkeypatch, **update):
    settings = get_settings().model_copy(update=update)
    monkeypatch.setattr("app.notifications.router.get_settings", lambda: settings)
    monkeypatch.delenv("ORGNISER_EMAIL_WEBHOOK_SECRET", raising=False)


def test_webhook_without_secret_is_refused_in_production(db, client, monkeypatch):
    _with_settings(monkeypatch, environment="production", email_webhook_secret="")
    body = {"message_id": "x", "event": "bounced"}
    response = client.post(f"{API_PREFIX}/webhooks/email", json=body)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "webhook_not_configured"


def test_webhook_without_secret_is_accepted_locally(db, client, monkeypatch):
    _with_settings(monkeypatch, environment="local", email_webhook_secret="")
    body = {"message_id": "x", "event": "bounced"}
    assert client.post(f"{API_PREFIX}/webhooks/email", json=body).status_code == 204


def test_webhook_secret_from_settings_is_enforced(db, client, monkeypatch):
    _with_settings(monkeypatch, environment="production", email_webhook_secret="s3cret")
    body = {"message_id": "x", "event": "bounced"}
    url = f"{API_PREFIX}/webhooks/email"
    assert client.post(url, json=body).status_code == 401
    assert client.post(url, json=body, headers={"X-Webhook-Secret": "s3cret"}).status_code == 204


# --- uploads --------------------------------------------------------------------------------


def test_oversized_request_is_refused_before_it_is_read(db, client):
    president = make_student(db)
    event = make_event(db, make_club(db, president=president), president)
    login(client, db, president)
    too_big = b"\x89PNG" + b"0" * (max_body_bytes(get_settings().max_upload_mb) + 10)
    response = client.post(
        f"{API_PREFIX}/events/{event.id}/posters",
        files={"file": ("p.png", too_big, "image/png")},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "request_too_large"


def test_body_limit_also_stops_a_streamed_body_without_content_length():
    from app.core.bodylimit import BodySizeLimitMiddleware

    seen: list[int] = []

    async def app(scope, receive, send):
        try:
            while True:
                message = await receive()
                seen.append(len(message.get("body", b"")))
                if not message.get("more_body"):
                    break
        except Exception as exc:
            seen.append(-1)
            assert getattr(exc, "status_code", None) == 413
            return

    chunks = [b"x" * 600, b"x" * 600]

    async def receive():
        body = chunks.pop(0)
        return {"type": "http.request", "body": body, "more_body": bool(chunks)}

    import asyncio

    asyncio.run(
        BodySizeLimitMiddleware(app, max_bytes=1000)(
            {"type": "http", "headers": []}, receive, lambda m: None
        )
    )
    assert seen == [600, -1]


def _png_header_only(width: int, height: int) -> bytes:
    """A tiny PNG whose header claims a huge size (a decompression bomb)."""
    image = Image.new("1", (width, height))
    out = io.BytesIO()
    image.save(out, format="PNG", optimize=True)
    return out.getvalue()


def test_png_bomb_is_rejected_before_decoding(monkeypatch):
    monkeypatch.setattr(poster_render, "MAX_POSTER_PIXELS", 1_000_000)
    data = _png_header_only(2000, 2000)  # 4 M px, under Pillow's own limit
    with pytest.raises(poster_render.PosterError) as info:
        poster_render.load_poster(data, "image/png")
    assert info.value.code == "image_too_large"


def test_pdf_poster_with_a_huge_page_is_rejected_before_rendering():
    writer = PdfWriter()
    writer.add_blank_page(14400, 14400)  # 200 x 200 inches -> 3.6 billion px at 300 DPI
    out = io.BytesIO()
    writer.write(out)
    with pytest.raises(poster_render.PosterError) as info:
        poster_render.load_poster(out.getvalue(), "application/pdf")
    assert info.value.code == "image_too_large"


def test_template_page_limit_is_checked_before_parsing_every_page(monkeypatch):
    writer = PdfWriter()
    for _ in range(50):
        writer.add_blank_page(100, 100)
    out = io.BytesIO()
    writer.write(out)
    opened: list = []
    import pdfplumber

    real_open = pdfplumber.open
    monkeypatch.setattr(pdfplumber, "open", lambda *a, **k: opened.append(1) or real_open(*a, **k))
    with pytest.raises(TemplateError) as info:
        detect_tags(out.getvalue(), set(), max_pages=2)
    assert info.value.code == "too_many_pages"
    assert opened == []  # rejected from the declared page count


def test_certificate_drops_template_javascript_and_links():
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=(600, 400))
    c.drawString(100, 200, "{{name}}")
    c.linkURL("https://evil.example", (0, 0, 600, 400))
    c.showPage()
    c.save()
    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(buffer.getvalue())))
    writer.root_object[NameObject("/OpenAction")] = DictionaryObject(
        {
            NameObject("/S"): NameObject("/JavaScript"),
            NameObject("/JS"): TextStringObject("app.alert('x')"),
        }
    )
    template = io.BytesIO()
    writer.write(template)

    spec = cert_render.PlaceholderSpec(
        tag="name", page=0, x=90, y=190, w=300, h=20, font_name="Helvetica", font_size=14
    )
    pdf = cert_render.render_certificate(
        template.getvalue(), [spec], {"name": "Asha"}, "ORG-1234-5678", "https://v/ORG"
    )
    reader = PdfReader(io.BytesIO(pdf))
    assert "/OpenAction" not in reader.trailer["/Root"]
    assert "/Annots" not in reader.pages[0]
    assert b"app.alert" not in pdf


# --- storage keys and filenames -------------------------------------------------------------


def test_storage_keys_are_built_from_ids_only():
    from app.certificates.service import certificate_key, template_key
    from app.posters.service import original_key

    event, item = uuid.uuid4(), uuid.uuid4()
    for key in (
        template_key(event, item),
        certificate_key(event, "ORG-1234-5678"),
        original_key(event, item, "png"),
    ):
        assert ".." not in key and not key.startswith("/") and "\\" not in key


def test_export_filename_is_safe_for_any_event_name():
    from app.exports.format import export_filename

    name = export_filename('"; rm -rf / \r\nX-Evil: 1 ../../etc', "csv")
    assert all(ch.isalnum() or ch in "-_." for ch in name)


def test_export_escapes_formula_in_form_field_labels():
    from app.exports.format import build_columns, to_csv

    columns = build_columns([{"key": "k", "label": '=HYPERLINK("x")', "type": "short_text"}])
    assert "'=HYPERLINK" in to_csv(columns, []).decode("utf-8-sig")
