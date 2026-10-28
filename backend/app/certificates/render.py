"""Render Certificates from a Certificate Template (R33, R34).

Pure functions: template bytes + Placeholders + values in, PDF bytes out. No database,
no storage, no FastAPI.

How a Certificate is made:
1. **Clean the template once** (cached by content hash): every literal `{{...}}` glyph is
   removed from the page's content stream and replaced by an equal kerning gap, so the
   Tag disappears from both the picture and the text layer while the rest of the line
   stays exactly where it was.
2. **Overlay per Certificate**: a reportlab page the same size as the template page draws
   each value (aligned, shrunk to fit), the Certificate ID and a verification QR.
   A white box is painted under a value only where step 1 couldn't remove the Tag (Tags in
   Form XObjects, outlined text, or image-only templates with hand-drawn Placeholders).
3. **Merge** with pypdf `page.merge_page(overlay_page)`.

Fonts (decision 35): template fonts are subset-embedded and can't render real names, so
every value is drawn in Noto Sans, or Noto Serif when the template font name suggests a
serif. If the TTFs are missing, reportlab's built-in Helvetica / Times-Roman are used.
"""

import hashlib
import io
import logging
import threading
from collections import OrderedDict
from collections.abc import Iterable
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

import qrcode
import qrcode.constants
from pdfminer.pdfdevice import PDFTextDevice
from pdfminer.pdfinterp import PDFPageInterpreter, PDFResourceManager
from pdfminer.pdfpage import PDFPage
from pdfminer.utils import translate_matrix
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    ByteStringObject,
    ContentStream,
    FloatObject,
    TextStringObject,
)
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from app.certificates.tags import LiteralTag, char_key, literal_tags

log = logging.getLogger(__name__)

Align = Literal["left", "center", "right"]

FONTS_DIR = Path(__file__).resolve().parent / "fonts"
SANS = "NotoSans"
SERIF = "NotoSerif"
_FALLBACK = {SANS: "Helvetica", SERIF: "Times-Roman"}
_SERIF_HINTS = ("serif", "times", "roman")

PREVIEW_PUBLIC_ID = "ORG-PREV-IEW0"

STAMP_MARGIN = 18 * mm
QR_SIZE = 22 * mm
STAMP_FONT_SIZE = 8.0
MASK_PADDING = 2.0  # points around a Tag's box when painting it out
_ID_TAG = "certificate_id"
_CACHE_SIZE = 8


@dataclass(frozen=True)
class PlaceholderSpec:
    tag: str  # "name", "form.team_name", ...
    page: int  # 0-based
    x: float  # points, bottom-left origin
    y: float
    w: float
    h: float
    font_name: str  # the template's font name; mapped to Noto Sans / Noto Serif
    font_size: float  # maximum size; shrunk to fit `w`
    align: Align = "center"


# --------------------------------------------------------------------------- fonts


@lru_cache
def _registered_fonts() -> dict[str, str]:
    """Map our logical font ("NotoSans"/"NotoSerif") to a reportlab font name."""
    resolved: dict[str, str] = {}
    for logical in (SANS, SERIF):
        path = FONTS_DIR / f"{logical}-Regular.ttf"
        try:
            pdfmetrics.registerFont(TTFont(logical, str(path)))
            resolved[logical] = logical
        except Exception:  # missing file or unreadable TTF
            log.warning("Font %s not found at %s; using %s", logical, path, _FALLBACK[logical])
            resolved[logical] = _FALLBACK[logical]
    return resolved


def font_for(template_font_name: str) -> str:
    """reportlab font to draw a value in, for a template font name (decision 35)."""
    lowered = template_font_name.lower()
    logical = SERIF if any(h in lowered for h in _SERIF_HINTS) else SANS
    return _registered_fonts()[logical]


def fonts_available() -> bool:
    """True when the Noto TTFs are installed (not the built-in fallbacks)."""
    return all(_registered_fonts()[k] == k for k in (SANS, SERIF))


def fit_font_size(
    text: str, font_name: str, max_size: float, box_w: float, min_size: float = 6
) -> float:
    """Largest size ≤ max_size at which `text` fits in `box_w` points (R34), never < min_size.

    `font_name` is a reportlab font name (see `font_for`).
    """
    if not text or box_w <= 0:
        return max(min_size, max_size)
    width_at_one = pdfmetrics.stringWidth(text, font_name, 1.0)
    if width_at_one <= 0:
        return max_size
    fitted = box_w / width_at_one
    size = min(max_size, fitted)
    # Round down to 0.1pt so rounding never pushes it over the box.
    size = int(size * 10) / 10
    return max(min_size, size)


# ------------------------------------------------------------- template cleaning


@dataclass(frozen=True)
class _Glyph:
    show_index: int  # n-th text-showing operator on the page's own content stream
    item_index: int  # index in the TJ array (Tj = [string])
    cid_index: int  # n-th glyph in that string
    key: tuple[float, ...]
    adv: float  # advance in text space × fontsize × scaling (same as pdfminer)
    dxscale: float  # 0.001 × fontsize × scaling: TJ number → advance
    wordspace: float
    is_space: bool
    n_cids: int  # glyphs in that string
    n_bytes: int  # bytes in that string


class _GlyphDevice(PDFTextDevice):
    """Records each glyph of the page's own content stream (not Form XObjects)."""

    def __init__(self, rsrcmgr: PDFResourceManager) -> None:
        super().__init__(rsrcmgr)
        self.glyphs: list[_Glyph] = []
        self.show_index = -1
        self.top_level = True

    def render_string(self, textstate, seq, ncs, graphicstate) -> None:  # type: ignore[override]
        if not self.top_level:
            return
        self.show_index += 1
        font = textstate.font
        if font is None or font.is_vertical():
            return
        matrix = _mult(textstate.matrix, self.ctm)
        fontsize = textstate.fontsize
        scaling = textstate.scaling * 0.01
        charspace = textstate.charspace * scaling
        wordspace = 0.0 if font.is_multibyte() else textstate.wordspace * scaling
        dxscale = 0.001 * fontsize * scaling
        x, y = textstate.linematrix
        need_charspace = False
        for item_index, obj in enumerate(seq):
            if isinstance(obj, int | float):
                x -= obj * dxscale
                need_charspace = True
            elif isinstance(obj, bytes):
                cids = list(font.decode(obj))
                for cid_index, cid in enumerate(cids):
                    if need_charspace:
                        x += charspace
                    glyph_matrix = translate_matrix(matrix, (x, y))
                    adv = font.char_width(cid) * fontsize * scaling
                    self.glyphs.append(
                        _Glyph(
                            show_index=self.show_index,
                            item_index=item_index,
                            cid_index=cid_index,
                            key=char_key(glyph_matrix),
                            adv=adv,
                            dxscale=dxscale,
                            wordspace=wordspace if cid == 32 else 0.0,
                            is_space=cid == 32,
                            n_cids=len(cids),
                            n_bytes=len(obj),
                        )
                    )
                    x += adv
                    if cid == 32 and wordspace:
                        x += wordspace
                    need_charspace = True
        textstate.linematrix = (x, y)


def _mult(m1: tuple, m0: tuple) -> tuple:
    (a1, b1, c1, d1, e1, f1) = m1
    (a0, b0, c0, d0, e0, f0) = m0
    return (
        a0 * a1 + c0 * b1,
        b0 * a1 + d0 * b1,
        a0 * c1 + c0 * d1,
        b0 * c1 + d0 * d1,
        a0 * e1 + c0 * f1 + e0,
        b0 * e1 + d0 * f1 + f0,
    )


class _TopLevelInterpreter(PDFPageInterpreter):
    """Tells the device when it's inside a Form XObject, which we don't rewrite."""

    def do_Do(self, xobjid_arg) -> None:  # type: ignore[override]
        device = self.device
        assert isinstance(device, _GlyphDevice)
        was = device.top_level
        device.top_level = False
        try:
            super().do_Do(xobjid_arg)
        finally:
            device.top_level = was


_SHOW_OPS = (b"Tj", b"TJ", b"'", b'"')


def _as_bytes(obj: object) -> bytes | None:
    if isinstance(obj, ByteStringObject):
        return bytes(obj)
    if isinstance(obj, TextStringObject):
        return obj.get_original_bytes()
    return None


def _rewrite_items(items: list, drops: dict[int, list[_Glyph]]) -> list | None:
    """New TJ array with the dropped glyphs replaced by an equal kerning gap."""
    out: list = []
    for item_index, item in enumerate(items):
        dropped = drops.get(item_index)
        if not dropped:
            out.append(item)
            continue
        data = _as_bytes(item)
        if data is None:
            return None
        n_cids, n_bytes = dropped[0].n_cids, dropped[0].n_bytes
        if n_bytes != len(data) or n_bytes % n_cids:
            return None  # variable-width CMap: can't split safely
        width = n_bytes // n_cids
        drop_at = {g.cid_index: g for g in dropped}
        run = b""
        for cid_index in range(n_cids):
            chunk = data[cid_index * width : (cid_index + 1) * width]
            glyph = drop_at.get(cid_index)
            if glyph is None:
                run += chunk
                continue
            if run:
                out.append(ByteStringObject(run))
                run = b""
            gap = glyph.adv + glyph.wordspace
            out.append(FloatObject(round(-gap / glyph.dxscale, 4)))
        if run:
            out.append(ByteStringObject(run))
    return out


def _clean_page(page, pdf_page: PDFPage, rsrcmgr: PDFResourceManager, keys: set) -> set:
    """Remove the glyphs whose keys are in `keys` from `page`. Returns the keys removed."""
    device = _GlyphDevice(rsrcmgr)
    _TopLevelInterpreter(rsrcmgr, device).process_page(pdf_page)
    targets = [g for g in device.glyphs if g.key in keys]
    if not targets:
        return set()
    contents = page.get_contents()
    if contents is None:
        return set()
    stream = (
        ContentStream(contents, page.pdf) if not isinstance(contents, ContentStream) else contents
    )
    by_show: dict[int, dict[int, list[_Glyph]]] = {}
    for g in targets:
        by_show.setdefault(g.show_index, {}).setdefault(g.item_index, []).append(g)

    new_ops: list = []
    show_index = -1
    removed: set = set()
    for operands, operator in stream.operations:
        if operator not in _SHOW_OPS:
            new_ops.append((operands, operator))
            continue
        show_index += 1
        drops = by_show.get(show_index)
        if not drops:
            new_ops.append((operands, operator))
            continue
        items = list(operands[0]) if operator == b"TJ" else [operands[-1]]
        rewritten = _rewrite_items(items, drops)
        if rewritten is None:
            new_ops.append((operands, operator))
            continue
        if operator == b"'":
            new_ops.append(([], b"T*"))
        elif operator == b'"':
            new_ops.append(([operands[0]], b"Tw"))
            new_ops.append(([operands[1]], b"Tc"))
            new_ops.append(([], b"T*"))
        new_ops.append(([ArrayObject(rewritten)], b"TJ"))
        removed.update(g.key for d in drops.values() for g in d)
    if show_index != device.show_index:
        # pypdf and pdfminer disagree on the operators; don't trust the rewrite.
        return set()
    stream.operations = new_ops
    page.replace_contents(stream)
    return removed


@dataclass(frozen=True)
class _Prepared:
    pdf: bytes  # template with literal Tag glyphs removed
    page_sizes: tuple[tuple[float, float, float, float], ...]  # mediabox per page
    unmasked: tuple[LiteralTag, ...]  # literal Tags whose glyphs couldn't be removed
    stripped: tuple[LiteralTag, ...]  # literal Tags removed from the content stream


_cache: OrderedDict[str, _Prepared] = OrderedDict()
_cache_lock = threading.Lock()


def _prepare(template_pdf: bytes) -> _Prepared:
    digest = hashlib.sha256(template_pdf).hexdigest()
    with _cache_lock:
        hit = _cache.get(digest)
        if hit is not None:
            _cache.move_to_end(digest)
            return hit
    prepared = _prepare_uncached(template_pdf)
    with _cache_lock:
        _cache[digest] = prepared
        while len(_cache) > _CACHE_SIZE:
            _cache.popitem(last=False)
    return prepared


_ACTIVE_ROOT_KEYS = ("/OpenAction", "/AA", "/Names", "/AcroForm", "/JavaScript")


def _strip_active_content(writer: PdfWriter) -> None:
    """Drop what a viewer could run or open from a Club-uploaded template: document and
    page actions, JavaScript, embedded files, forms and annotations (links included).
    Every Certificate is a copy of the template, so this keeps them plain documents."""
    root = writer.root_object
    for key in _ACTIVE_ROOT_KEYS:
        if key in root:
            del root[key]
    for page in writer.pages:
        for key in ("/AA", "/Annots"):
            if key in page:
                del page[key]


def _prepare_uncached(template_pdf: bytes) -> _Prepared:
    found = literal_tags(template_pdf)
    reader = PdfReader(io.BytesIO(template_pdf))
    writer = PdfWriter(clone_from=reader)
    _strip_active_content(writer)
    sizes = tuple(
        (
            float(p.mediabox.left),
            float(p.mediabox.bottom),
            float(p.mediabox.width),
            float(p.mediabox.height),
        )
        for p in writer.pages
    )
    removed: set = set()
    if found:
        rsrcmgr = PDFResourceManager(caching=True)
        pdf_pages = list(PDFPage.get_pages(io.BytesIO(template_pdf)))
        for page_no, page in enumerate(writer.pages):
            keys = {k for t in found if t.page == page_no for k in t.char_keys}
            if not keys or page_no >= len(pdf_pages):
                continue
            try:
                removed |= _clean_page(page, pdf_pages[page_no], rsrcmgr, keys)
            except Exception:  # odd content streams: fall back to masking
                log.warning("Could not remove Tag text on page %d", page_no, exc_info=True)
    unmasked = tuple(t for t in found if not set(t.char_keys) <= removed)
    stripped = tuple(t for t in found if set(t.char_keys) <= removed)
    buf = io.BytesIO()
    writer.write(buf)
    return _Prepared(pdf=buf.getvalue(), page_sizes=sizes, unmasked=unmasked, stripped=stripped)


# ------------------------------------------------------------------ rendering


@lru_cache(maxsize=64)
def _qr_png(url: str) -> bytes:
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, border=1, box_size=8)
    qr.add_data(url)
    qr.make(fit=True)
    buf = io.BytesIO()
    qr.make_image(fill_color="black", back_color="white").save(buf, format="PNG")
    return buf.getvalue()


def _overlaps(a: tuple[float, float, float, float], b: tuple[float, float, float, float]) -> bool:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah


# Baseline of a Tag above the bottom of its box, as a fraction of the font size
# (the box bottom is the descender line; Latin descenders are about 0.2-0.25 em).
_BASELINE_LIFT = 0.22


def _draw_value(c: canvas.Canvas, ph: PlaceholderSpec, text: str) -> None:
    font = font_for(ph.font_name)
    size = fit_font_size(text, font, ph.font_size, ph.w)
    c.setFont(font, size)
    c.setFillColorRGB(0, 0, 0)
    # Keep the text vertically centred in the box when it had to shrink.
    baseline = ph.y + max(ph.h - size, 0.0) / 2 + _BASELINE_LIFT * size
    if ph.align == "center":
        c.drawCentredString(ph.x + ph.w / 2, baseline, text)
    elif ph.align == "right":
        c.drawRightString(ph.x + ph.w, baseline, text)
    else:
        c.drawString(ph.x, baseline, text)


def _mask_boxes(prepared: _Prepared, page_no: int, phs: list[PlaceholderSpec]) -> list[tuple]:
    """White boxes to paint, in page coordinates relative to the mediabox origin.

    - literal Tags whose glyphs couldn't be removed from the content stream;
    - Placeholders that don't sit on a removed Tag (hand-drawn boxes, e.g. over an
      image-only template), so whatever is printed under them never shows.
    A Tag whose glyphs were removed needs no box, so coloured backgrounds stay intact.
    """
    stripped = [(t.x, t.y, t.w, t.h) for t in prepared.stripped if t.page == page_no]
    boxes = [(t.x, t.y, t.w, t.h) for t in prepared.unmasked if t.page == page_no]
    for ph in phs:
        box = (ph.x, ph.y, ph.w, ph.h)
        if not any(_overlaps(box, s) for s in stripped):
            boxes.append(box)
    return boxes


def _build_overlay(
    prepared: _Prepared,
    placeholders: Iterable[PlaceholderSpec],
    values: dict[str, str],
    public_id: str,
    verify_url: str,
    preview: bool,
) -> bytes:
    by_page: dict[int, list[PlaceholderSpec]] = {}
    for ph in placeholders:
        by_page.setdefault(ph.page, []).append(ph)
    has_id_placeholder = any(ph.tag == _ID_TAG for ph in by_page.get(0, []))
    all_values = {**values, _ID_TAG: public_id}

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pageCompression=0)
    for page_no, (_ox, _oy, pw, ph_h) in enumerate(prepared.page_sizes):
        c.setPageSize((pw, ph_h))
        phs = by_page.get(page_no, [])
        # Coordinates are relative to the mediabox origin (as pdfplumber reports them);
        # the overlay is shifted onto a non-zero origin when merged.
        c.setFillColorRGB(1, 1, 1)
        for mx, my, mw, mh in _mask_boxes(prepared, page_no, phs):
            c.rect(
                mx - MASK_PADDING,
                my - MASK_PADDING,
                mw + 2 * MASK_PADDING,
                mh + 2 * MASK_PADDING,
                stroke=0,
                fill=1,
            )
        for ph in phs:
            text = all_values.get(ph.tag, "")
            if text:
                _draw_value(c, ph, text)

        if page_no == 0:
            qx = pw - STAMP_MARGIN - QR_SIZE
            qy = STAMP_MARGIN
            c.drawImage(ImageReader(io.BytesIO(_qr_png(verify_url))), qx, qy, QR_SIZE, QR_SIZE)
            if not has_id_placeholder:
                c.setFont(font_for("sans"), STAMP_FONT_SIZE)
                c.setFillColorRGB(0.2, 0.2, 0.2)
                c.drawRightString(qx + QR_SIZE, qy - STAMP_FONT_SIZE - 2, public_id)
        if preview:
            c.saveState()
            c.setFillColorRGB(0.85, 0.1, 0.1, alpha=0.18)
            c.setFont(font_for("sans"), min(pw, ph_h) / 5)
            c.translate(pw / 2, ph_h / 2)
            c.rotate(30)
            c.drawCentredString(0, 0, "PREVIEW")
            c.restoreState()
        c.showPage()
    c.save()
    return buf.getvalue()


def render_certificate(
    template_pdf: bytes,
    placeholders: list[PlaceholderSpec],
    values: dict[str, str],
    public_id: str,
    verify_url: str,
    *,
    _preview: bool = False,
) -> bytes:
    """Fill a Certificate Template and stamp the Certificate ID and verification QR (R34).

    `values` maps each Placeholder's tag (e.g. "name", "form.team_name") to its text;
    `certificate_id` is always `public_id`. The Certificate ID text is stamped bottom-right
    of page 1 unless a `{{certificate_id}}` Placeholder is on page 1; the QR always is.
    """
    prepared = _prepare(template_pdf)
    overlay = PdfReader(
        io.BytesIO(_build_overlay(prepared, placeholders, values, public_id, verify_url, _preview))
    )
    writer = PdfWriter(clone_from=PdfReader(io.BytesIO(prepared.pdf)))
    for page, overlay_page, (ox, oy, _w, _h) in zip(
        writer.pages, overlay.pages, prepared.page_sizes, strict=True
    ):
        if ox or oy:
            page.merge_translated_page(overlay_page, ox, oy)
        else:
            page.merge_page(overlay_page)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def preview_pdf(
    template_pdf: bytes,
    placeholders: list[PlaceholderSpec],
    values: dict[str, str],
    verify_url: str,
) -> bytes:
    """Same as `render_certificate`, stamped "PREVIEW", with public_id ORG-PREV-IEW0 (R33)."""
    return render_certificate(
        template_pdf, placeholders, values, PREVIEW_PUBLIC_ID, verify_url, _preview=True
    )
