"""Certificate Template Tags (R30, R31; DESIGN.md §2).

Pure functions: read a template PDF's text layer with pdfplumber, find each `{{tag}}`,
and report its position, font and alignment so the caller can store it as a Placeholder.
No database, no storage, no FastAPI.

Coordinates in `DetectedTag` are PDF points with the origin at the **bottom-left** of the
page (reportlab's convention). pdfplumber measures from the top-left, so `y` is converted.
"""

import difflib
import io
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Literal

import pdfplumber

from app.core.settings import get_settings

Align = Literal["left", "center", "right"]

PROFILE_TAGS: tuple[str, ...] = ("name", "roll_no", "department", "year", "section")
EVENT_TAGS: tuple[str, ...] = ("event_name", "event_date", "club_name")
CERTIFICATE_TAGS: tuple[str, ...] = ("certificate_id",)
FORM_PREFIX = "form."

FIXED_TAGS: frozenset[str] = frozenset(PROFILE_TAGS + EVENT_TAGS + CERTIFICATE_TAGS)

# `{{ name }}`; spaces allowed inside the braces. The inner text has no braces.
TAG_PATTERN = re.compile(r"\{\{\s*([^{}]*?)\s*\}\}")

# A tag counts as centred when its centre is within this fraction of the page width from
# the page's horizontal centre.
_CENTER_TOLERANCE = 0.05
# A tag is right-aligned when it ends within this fraction of the page width from the
# right edge (and starts in the right half).
_RIGHT_MARGIN = 0.15
# Margin kept free when widening a Placeholder box to the room available on its line.
_PAGE_MARGIN = 0.05
# Two chars are on the same line when their vertical overlap is at least this fraction of
# the smaller char's height.
_LINE_OVERLAP = 0.5


class TemplateError(ValueError):
    """A Certificate Template that can't be accepted. `code` is machine-readable."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class DetectedTag:
    tag: str  # normalised, without braces or spaces: "name", "form.team_name"
    page: int  # 0-based
    x: float  # left edge of the literal `{{...}}` text, points from the left
    y: float  # bottom edge, points from the bottom
    w: float
    h: float
    font_name: str  # as embedded in the template, e.g. "ABCDEF+TimesNewRomanPSMT"
    font_size: float
    align: Align
    # Horizontal room the value may use on this line, up to neighbouring text or the page
    # margin, and laid out to suit `align`. Always contains the tag itself.
    room_x: float = 0.0
    room_w: float = 0.0

    def placeholder_box(self) -> tuple[float, float, float, float]:
        """(x, y, w, h) to store on the Placeholder: the tag's line, widened to its room."""
        return (self.room_x, self.y, self.room_w, self.h)


@dataclass
class TemplateScan:
    has_text_layer: bool
    page_count: int
    page_sizes: list[tuple[float, float]]  # (width, height) in points, per page
    tags: list[DetectedTag] = field(default_factory=list)
    unknown: list[tuple[str, str | None]] = field(default_factory=list)  # (bad tag, hint)


def _normalise(inner: str) -> str:
    return re.sub(r"\s+", "", inner)


def is_valid_tag(tag: str, form_keys: set[str]) -> bool:
    """True for a Supported Tag. `form.<key>` is valid only if `<key>` is a Form Field key."""
    if tag in FIXED_TAGS:
        return True
    if tag.startswith(FORM_PREFIX):
        return tag.removeprefix(FORM_PREFIX) in form_keys
    return False


def valid_tags(form_keys: set[str]) -> list[str]:
    return [*PROFILE_TAGS, *EVENT_TAGS, *CERTIFICATE_TAGS, *(FORM_PREFIX + k for k in form_keys)]


def suggest_tag(tag: str, form_keys: set[str]) -> str | None:
    """Closest Supported Tag for a bad one, or None if nothing is close."""
    candidates = valid_tags(form_keys)
    probe = tag.strip().lower()
    if probe in candidates:
        return probe
    matches = difflib.get_close_matches(probe, candidates, n=1, cutoff=0.6)
    if matches:
        return matches[0]
    # "form.temname" → compare the key part against the form keys alone.
    if probe.startswith(FORM_PREFIX) and form_keys:
        key = probe.removeprefix(FORM_PREFIX)
        matches = difflib.get_close_matches(key, sorted(form_keys), n=1, cutoff=0.6)
        if matches:
            return FORM_PREFIX + matches[0]
    return None


def _align_for(x0: float, x1: float, page_w: float) -> Align:
    center = (x0 + x1) / 2
    if abs(center - page_w / 2) <= _CENTER_TOLERANCE * page_w:
        return "center"
    if page_w - x1 <= _RIGHT_MARGIN * page_w and x0 > page_w / 2:
        return "right"
    return "left"


def _same_line(a_top: float, a_bottom: float, b_top: float, b_bottom: float) -> bool:
    overlap = min(a_bottom, b_bottom) - max(a_top, b_top)
    smaller = max(min(a_bottom - a_top, b_bottom - b_top), 0.01)
    return overlap >= _LINE_OVERLAP * smaller


def _group_lines(words: list[dict]) -> list[list[dict]]:
    """Group upright words into lines, each sorted left to right."""
    lines: list[list[dict]] = []
    for word in sorted(words, key=lambda w: (round(w["top"], 1), w["x0"])):
        for line in lines:
            ref = line[0]
            if _same_line(ref["top"], ref["bottom"], word["top"], word["bottom"]):
                line.append(word)
                break
        else:
            lines.append([word])
    for line in lines:
        line.sort(key=lambda w: w["x0"])
    return lines


def _room(
    x0: float,
    x1: float,
    top: float,
    bottom: float,
    size: float,
    others: list[dict],
    page_w: float,
    align: Align,
) -> tuple[float, float]:
    """Horizontal span the value may fill: up to neighbouring text or the page margin."""
    margin = _PAGE_MARGIN * page_w
    gap = size * 0.5
    left_limit, right_limit = margin, page_w - margin
    for ch in others:
        if not _same_line(top, bottom, ch["top"], ch["bottom"]):
            continue
        if ch["x1"] <= x0 + 0.01:
            left_limit = max(left_limit, ch["x1"] + gap)
        elif ch["x0"] >= x1 - 0.01:
            right_limit = min(right_limit, ch["x0"] - gap)
    left_limit = min(left_limit, x0)
    right_limit = max(right_limit, x1)
    if align == "center":
        cx = (x0 + x1) / 2
        half = max(min(cx - left_limit, right_limit - cx), (x1 - x0) / 2)
        return cx - half, 2 * half
    if align == "right":
        return left_limit, x1 - left_limit
    return x0, right_limit - x0


def _declared_page_count(pdf_bytes: bytes) -> int | None:
    """The page count the PDF declares in its page tree, read without parsing every page.
    None when it can't be read (pdfplumber then reports the real problem)."""
    try:
        from pypdf import PdfReader

        count = PdfReader(io.BytesIO(pdf_bytes)).trailer["/Root"]["/Pages"]["/Count"]
        return int(count)
    except Exception:  # malformed trees: let pdfplumber decide
        return None


def _open_pdf(pdf_bytes: bytes, max_pages: int | None = None) -> pdfplumber.PDF:
    if not pdf_bytes or b"%PDF" not in pdf_bytes[:1024]:
        raise TemplateError("not_a_pdf", "The Certificate Template must be a PDF file.")
    # Reject a huge page tree before pdfplumber builds an object for every page.
    declared = _declared_page_count(pdf_bytes)
    if max_pages is not None and declared is not None and declared > max_pages:
        raise TemplateError(
            "too_many_pages",
            f"A Certificate Template can have at most {max_pages} page(s); this one has "
            f"{declared}.",
        )
    try:
        pdf = pdfplumber.open(io.BytesIO(pdf_bytes))
        _ = pdf.pages  # forces the page tree to parse
    except Exception as exc:  # pdfminer raises a zoo of exception types
        raise TemplateError("not_a_pdf", "The file could not be read as a PDF.") from exc
    return pdf


@dataclass(frozen=True)
class _RawTag:
    """One `{{...}}` found on a page, valid or not."""

    tag: str
    page: int
    x0: float
    x1: float
    top: float  # pdfplumber: points from the top
    bottom: float
    font_name: str
    font_size: float
    room_x: float
    room_w: float
    align: Align
    # The pdfminer text matrix of each char in the literal tag, used by the renderer to
    # find and remove exactly these glyphs from the content stream.
    char_keys: tuple[tuple[float, ...], ...] = ()


def char_key(matrix: tuple[float, ...]) -> tuple[float, ...]:
    """Stable key for a glyph: its text matrix, rounded."""
    return tuple(round(float(v), 3) for v in matrix)


def _scan(pdf: pdfplumber.PDF) -> tuple[bool, list[tuple[float, float]], list[_RawTag]]:
    has_text = False
    sizes: list[tuple[float, float]] = []
    found: list[_RawTag] = []
    for page_no, page in enumerate(pdf.pages):
        page_w, page_h = float(page.width), float(page.height)
        sizes.append((page_w, page_h))
        if any(c["text"].strip() for c in page.chars):
            has_text = True
        words = page.extract_words(extra_attrs=["fontname", "size"], return_chars=True)
        words = [w for w in words if w.get("upright", True)]
        all_chars = [c for w in words for c in w["chars"]]
        page_chars = [c for c in page.chars if c.get("upright", True)]
        for line in _group_lines(words):
            # Join the line's words with single spaces, remembering which char each
            # position of the joined text came from (None for the inserted spaces), so a
            # tag split across words ("{{ name }}") is still found.
            text_parts: list[str] = []
            owners: list[dict | None] = []
            for i, word in enumerate(line):
                if i:
                    text_parts.append(" ")
                    owners.append(None)
                for ch in word["chars"]:
                    text_parts.append(ch["text"])
                    owners.append(ch)
            text = "".join(text_parts)
            for match in TAG_PATTERN.finditer(text):
                chars = [c for c in owners[match.start() : match.end()] if c is not None]
                if not chars:
                    continue
                x0 = min(c["x0"] for c in chars)
                x1 = max(c["x1"] for c in chars)
                top = min(c["top"] for c in chars)
                bottom = max(c["bottom"] for c in chars)
                # Include the spaces inside the braces, which word extraction drops.
                chars = [
                    c
                    for c in page_chars
                    if c["x0"] >= x0 - 0.01
                    and c["x1"] <= x1 + 0.01
                    and _same_line(top, bottom, c["top"], c["bottom"])
                ] or chars
                inner = [c for c in chars if c["text"] not in "{} "] or chars
                font_name = Counter(c["fontname"] for c in inner).most_common(1)[0][0]
                font_size = round(max(c["size"] for c in inner), 2)
                align = _align_for(x0, x1, page_w)
                chosen = {id(c) for c in chars}
                others = [c for c in all_chars if id(c) not in chosen]
                room_x, room_w = _room(x0, x1, top, bottom, font_size, others, page_w, align)
                found.append(
                    _RawTag(
                        tag=_normalise(match.group(1)),
                        page=page_no,
                        x0=x0,
                        x1=x1,
                        top=top,
                        bottom=bottom,
                        font_name=font_name,
                        font_size=font_size,
                        room_x=room_x,
                        room_w=room_w,
                        align=align,
                        char_keys=tuple(char_key(c["matrix"]) for c in chars),
                    )
                )
    return has_text, sizes, found


def _check_pages(pdf: pdfplumber.PDF, limit: int) -> int:
    page_count = len(pdf.pages)
    if page_count == 0:
        raise TemplateError("not_a_pdf", "The PDF has no pages.")
    if page_count > limit:
        raise TemplateError(
            "too_many_pages",
            f"A Certificate Template can have at most {limit} page(s); this one has {page_count}.",
        )
    return page_count


def detect_tags(
    pdf_bytes: bytes, form_keys: set[str], *, max_pages: int | None = None
) -> TemplateScan:
    """Find every `{{tag}}` in a template's text layer.

    Raises TemplateError `not_a_pdf` or `too_many_pages`. Unknown tags are reported in
    `TemplateScan.unknown` (with a suggestion), not raised; `validate_template` rejects them.
    An image-only PDF gives `has_text_layer=False` and no tags (R32: draw by hand).
    """
    limit = max_pages if max_pages is not None else get_settings().max_template_pages
    with _open_pdf(pdf_bytes, limit) as pdf:
        page_count = _check_pages(pdf, limit)
        has_text, sizes, raw = _scan(pdf)

    scan = TemplateScan(has_text_layer=has_text, page_count=page_count, page_sizes=sizes)
    unknown: dict[str, str | None] = {}
    for r in raw:
        if not is_valid_tag(r.tag, form_keys):
            unknown.setdefault(r.tag, suggest_tag(r.tag, form_keys))
            continue
        page_h = sizes[r.page][1]
        scan.tags.append(
            DetectedTag(
                tag=r.tag,
                page=r.page,
                x=round(r.x0, 2),
                y=round(page_h - r.bottom, 2),
                w=round(r.x1 - r.x0, 2),
                h=round(r.bottom - r.top, 2),
                font_name=r.font_name,
                font_size=r.font_size,
                align=r.align,
                room_x=round(r.room_x, 2),
                room_w=round(r.room_w, 2),
            )
        )
    scan.unknown = list(unknown.items())
    return scan


@dataclass(frozen=True)
class LiteralTag:
    """A literal `{{...}}` on a page (valid or not), for the renderer to remove."""

    tag: str
    page: int
    x: float  # bottom-left origin, points
    y: float
    w: float
    h: float
    char_keys: tuple[tuple[float, ...], ...]


def literal_tags(pdf_bytes: bytes) -> list[LiteralTag]:
    """Every literal `{{...}}` in the text layer. No page limit or tag validation."""
    with _open_pdf(pdf_bytes) as pdf:
        _, sizes, raw = _scan(pdf)
    return [
        LiteralTag(
            tag=r.tag,
            page=r.page,
            x=r.x0,
            y=sizes[r.page][1] - r.bottom,
            w=r.x1 - r.x0,
            h=r.bottom - r.top,
            char_keys=r.char_keys,
        )
        for r in raw
    ]


def validate_template(
    pdf_bytes: bytes, form_keys: set[str], *, max_pages: int | None = None
) -> TemplateScan:
    """`detect_tags`, then reject the template if it has any unknown Tag (R31)."""
    scan = detect_tags(pdf_bytes, form_keys, max_pages=max_pages)
    if scan.unknown:
        parts = [
            f"{{{{{bad}}}}} (did you mean {{{{{hint}}}}}?)"
            if hint
            else f"{{{{{bad}}}}} (no close match)"
            for bad, hint in scan.unknown
        ]
        raise TemplateError("unknown_tags", "Unknown Tags in the template: " + "; ".join(parts))
    return scan
