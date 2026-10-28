"""Tag detection and validation for Certificate Templates (R30, R31, R32)."""

import io

import pytest
from PIL import Image
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from app.certificates.tags import (
    CERTIFICATE_TAGS,
    EVENT_TAGS,
    PROFILE_TAGS,
    TemplateError,
    detect_tags,
    is_valid_tag,
    suggest_tag,
    validate_template,
)

PAGE = (842.0, 595.0)  # A4 landscape
FORM_KEYS = {"team_name"}


def _pdf(draw, pages: int = 1, size=PAGE) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=size)
    for page_no in range(pages):
        draw(c, page_no)
        c.showPage()
    c.save()
    return buf.getvalue()


def _template(c: canvas.Canvas, page_no: int) -> None:
    if page_no:
        return
    c.setFont("Times-Roman", 32)
    c.drawCentredString(PAGE[0] / 2, 340, "{{name}}")
    c.setFont("Helvetica", 14)
    c.drawString(80, 250, "Team: {{ form.team_name }}")
    c.drawRightString(780, 120, "{{event_date}}")


def _by_tag(scan):
    return {t.tag: t for t in scan.tags}


def test_tag_constants_follow_design():
    assert PROFILE_TAGS == ("name", "roll_no", "department", "year", "section")
    assert EVENT_TAGS == ("event_name", "event_date", "club_name")
    assert CERTIFICATE_TAGS == ("certificate_id",)


def test_form_tags_are_validated_against_form_keys():
    assert is_valid_tag("name", set())
    assert is_valid_tag("certificate_id", set())
    assert is_valid_tag("form.team_name", FORM_KEYS)
    assert not is_valid_tag("form.team_name", set())
    assert not is_valid_tag("form.other", FORM_KEYS)
    assert not is_valid_tag("nmae", FORM_KEYS)


def test_suggestions():
    assert suggest_tag("nmae", set()) == "name"
    assert suggest_tag("evnt_date", set()) == "event_date"
    assert suggest_tag("form.team_nme", FORM_KEYS) == "form.team_name"
    assert suggest_tag("zzzzzzzz", set()) is None


def test_detection_positions_fonts_and_alignment():
    scan = detect_tags(_pdf(_template), FORM_KEYS)
    assert scan.has_text_layer
    assert scan.page_count == 1
    assert scan.page_sizes == [PAGE]
    assert scan.unknown == []
    tags = _by_tag(scan)
    assert set(tags) == {"name", "form.team_name", "event_date"}

    name = tags["name"]
    assert name.page == 0
    assert name.align == "center"
    assert name.font_size == pytest.approx(32)
    assert name.font_name == "Times-Roman"
    assert name.x + name.w / 2 == pytest.approx(PAGE[0] / 2, abs=2)
    # Bottom-left origin: the box bottom is the descender line, just below the baseline.
    assert name.y == pytest.approx(340, abs=10)
    assert name.y <= 340 <= name.y + name.h

    team = tags["form.team_name"]
    assert team.align == "left"
    assert team.font_name == "Helvetica"
    assert team.font_size == pytest.approx(14)
    assert 120 < team.x < 130  # just after "Team: "
    assert team.y <= 250 <= team.y + team.h

    date = tags["event_date"]
    assert date.align == "right"
    assert date.x + date.w == pytest.approx(780, abs=2)
    assert date.y <= 120 <= date.y + date.h

    # The Placeholder box always contains the tag itself.
    for tag in scan.tags:
        rx, _, rw, _ = tag.placeholder_box()
        assert rx <= tag.x + 0.01 and rx + rw >= tag.x + tag.w - 0.01


def test_tag_split_across_words_and_spaces_inside_braces():
    def draw(c, _):
        c.setFont("Helvetica", 20)
        c.drawString(100, 400, "{{   club_name   }}")
        # Drawn in two pieces, as some editors emit it.
        c.drawString(100, 300, "{{ event_")
        c.drawString(100 + c.stringWidth("{{ event_", "Helvetica", 20), 300, "name }}")

    tags = _by_tag(detect_tags(_pdf(draw), set()))
    assert set(tags) == {"club_name", "event_name"}
    assert tags["event_name"].x == pytest.approx(100, abs=1)


def test_unknown_tag_gets_a_suggestion():
    def draw(c, _):
        c.setFont("Helvetica", 24)
        c.drawCentredString(PAGE[0] / 2, 300, "{{nmae}}")
        c.drawString(80, 200, "{{form.missing}}")

    scan = detect_tags(_pdf(draw), FORM_KEYS)
    assert scan.tags == []
    assert dict(scan.unknown) == {"nmae": "name", "form.missing": None}

    with pytest.raises(TemplateError) as err:
        validate_template(_pdf(draw), FORM_KEYS)
    assert err.value.code == "unknown_tags"
    assert "{{nmae}}" in str(err.value) and "{{name}}" in str(err.value)
    assert "{{form.missing}}" in str(err.value)


def test_form_tag_rejected_when_key_not_on_form():
    pdf = _pdf(_template)
    with pytest.raises(TemplateError) as err:
        validate_template(pdf, set())
    assert err.value.code == "unknown_tags"
    assert "{{form.team_name}}" in str(err.value)
    assert validate_template(pdf, FORM_KEYS).tags


def test_too_many_pages():
    pdf = _pdf(_template, pages=3)
    with pytest.raises(TemplateError) as err:
        detect_tags(pdf, FORM_KEYS)  # settings default: 2 pages
    assert err.value.code == "too_many_pages"
    assert detect_tags(pdf, FORM_KEYS, max_pages=3).page_count == 3


def test_not_a_pdf():
    for junk in (b"", b"hello", b"%PDF-1.7 truncated garbage"):
        with pytest.raises(TemplateError) as err:
            detect_tags(junk, set())
        assert err.value.code == "not_a_pdf"


def test_image_only_pdf_has_no_text_layer():
    img = Image.new("RGB", (400, 280), (240, 230, 200))
    png = io.BytesIO()
    img.save(png, format="PNG")

    def draw(c, _):
        c.drawImage(ImageReader(io.BytesIO(png.getvalue())), 0, 0, *PAGE)

    scan = detect_tags(_pdf(draw), FORM_KEYS)
    assert scan.has_text_layer is False
    assert scan.tags == [] and scan.unknown == []
