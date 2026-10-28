"""Poster loading, QR Area checks and Final Poster composition (R20–R22, decisions 9, 30).

Pure functions: no database, no FastAPI, no storage. The poster job and endpoints call
these with bytes they have already fetched.
"""

import io
from dataclasses import dataclass

import pypdfium2 as pdfium
from PIL import Image, UnidentifiedImageError

from app.posters.qr import qr_image

RENDER_DPI = 300
MIN_QR_PX = 300  # 2.5 cm at 300 DPI (R21)
MAX_QR_ASPECT = 1.5
CM_PER_INCH = 2.54
# Largest poster we decode, in pixels: A1 at 300 DPI (7016 x 9933) is ~70 M, so this leaves
# room. It caps memory per poster (~300 MB as RGB) for both rasters and rasterised PDFs; a
# tiny file can otherwise claim billions of pixels (a decompression bomb).
MAX_POSTER_PIXELS = 100_000_000

SUPPORTED_TYPES = "PNG, JPG or PDF"
_TOO_LARGE_MESSAGE = (
    "The poster has too many pixels (the most is {limit} million). "
    "Export it at 300 DPI at the printed size, A1 or smaller."
)


class PosterError(ValueError):
    """A poster or QR Area problem the President can fix. `code` is machine-readable."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


@dataclass(frozen=True)
class PosterImage:
    image: Image.Image  # RGB, at full resolution
    width_px: int
    height_px: int


def _px_to_cm(px: int, dpi: int = RENDER_DPI) -> float:
    return px / dpi * CM_PER_INCH


def _too_large_message() -> str:
    return _TOO_LARGE_MESSAGE.format(limit=MAX_POSTER_PIXELS // 1_000_000)


def _kind(data: bytes, content_type_or_filename: str | None) -> str:
    hint = (content_type_or_filename or "").lower().strip()
    if hint.endswith(".pdf") or hint == "application/pdf":
        return "pdf"
    if hint.endswith(".png") or hint == "image/png":
        return "png"
    if hint.endswith((".jpg", ".jpeg")) or hint in ("image/jpeg", "image/jpg", "image/pjpeg"):
        return "jpeg"
    if hint:
        raise PosterError(
            "unsupported_file_type",
            f"'{content_type_or_filename}' is not supported. "
            f"Upload the poster as {SUPPORTED_TYPES}.",
        )
    # No hint: sniff the magic bytes.
    if data.startswith(b"%PDF"):
        return "pdf"
    if data.startswith(b"\x89PNG"):
        return "png"
    if data.startswith(b"\xff\xd8"):
        return "jpeg"
    raise PosterError(
        "unsupported_file_type",
        f"This file type is not supported. Upload the poster as {SUPPORTED_TYPES}.",
    )


def _load_pdf(data: bytes) -> Image.Image:
    try:
        pdf = pdfium.PdfDocument(data)
    except pdfium.PdfiumError as exc:
        raise PosterError(
            "corrupt_file",
            "The PDF could not be opened. Re-export it from your design tool and upload again.",
        ) from exc
    try:
        if len(pdf) < 1:
            raise PosterError("corrupt_file", "The PDF has no pages. Upload a one-page poster.")
        page = pdf[0]
        try:
            width_pt, height_pt = page.get_size()
            # Check the size before rendering: a small PDF can declare a page big enough to
            # need gigabytes at 300 DPI.
            if (width_pt * RENDER_DPI / 72) * (height_pt * RENDER_DPI / 72) > MAX_POSTER_PIXELS:
                raise PosterError("image_too_large", _too_large_message())
            image = page.render(scale=RENDER_DPI / 72).to_pil().convert("RGB")
        finally:
            page.close()
    finally:
        pdf.close()
    # pdfium can round a page edge up by a pixel; snap to the exact size at 300 DPI.
    target = (round(width_pt * RENDER_DPI / 72), round(height_pt * RENDER_DPI / 72))
    if image.size != target:
        if image.width >= target[0] and image.height >= target[1]:
            image = image.crop((0, 0, *target))
        else:
            image = image.resize(target, Image.Resampling.LANCZOS)
    return image


def _load_raster(data: bytes, kind: str) -> Image.Image:
    label = "PNG" if kind == "png" else "JPG"
    try:
        with Image.open(io.BytesIO(data)) as opened:
            if opened.format not in ("PNG", "JPEG"):
                raise PosterError(
                    "unsupported_file_type",
                    f"The file is a {opened.format} image, not {label}. "
                    f"Upload the poster as {SUPPORTED_TYPES}.",
                )
            # The header gives the size before any pixel is decoded, so reject here rather
            # than rely on Pillow's own bomb check (it only raises above 2x its limit).
            if opened.width * opened.height > MAX_POSTER_PIXELS:
                raise PosterError("image_too_large", _too_large_message())
            opened.load()
            image = opened
            if image.mode in ("RGBA", "LA", "P", "PA"):
                # Flatten transparency onto white so it prints as the designer saw it.
                rgba = image.convert("RGBA")
                flat = Image.new("RGB", rgba.size, (255, 255, 255))
                flat.paste(rgba, mask=rgba.getchannel("A"))
                return flat
            return image.convert("RGB")
    except PosterError:
        raise
    except Image.DecompressionBombError as exc:
        raise PosterError(
            "image_too_large",
            "The image has too many pixels. Export it at 300 DPI at the printed size.",
        ) from exc
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise PosterError(
            "corrupt_file",
            f"The {label} could not be read; it may be damaged. "
            "Re-export it from your design tool and upload again.",
        ) from exc


def load_poster(data: bytes, content_type_or_filename: str | None = None) -> PosterImage:
    """Decode a PNG, JPG or PDF poster. PDFs use page 1 only, rasterised at 300 DPI."""
    if not data:
        raise PosterError("corrupt_file", "The file is empty. Upload the poster again.")
    kind = _kind(data, content_type_or_filename)
    image = _load_pdf(data) if kind == "pdf" else _load_raster(data, kind)
    return PosterImage(image=image, width_px=image.width, height_px=image.height)


def preview_png(poster: PosterImage, max_side: int = 1600) -> tuple[bytes, float]:
    """A downscaled PNG for marking the QR Area, plus the scale factor.

    `scale` is preview px per original px (<= 1.0). Map a box drawn on the preview back
    to the original with `original = round(preview / scale)`.
    """
    longest = max(poster.width_px, poster.height_px)
    scale = min(1.0, max_side / longest)
    image = poster.image
    if scale < 1.0:
        size = (max(1, round(poster.width_px * scale)), max(1, round(poster.height_px * scale)))
        image = image.resize(size, Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue(), scale


def check_qr_area(poster: PosterImage, x: int, y: int, w: int, h: int) -> None:
    """Reject a QR Area that is off the poster, too small to scan, or far from square."""
    if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > poster.width_px or y + h > poster.height_px:
        raise PosterError(
            "qr_area_outside",
            f"The QR Area ({x}, {y}, {w}x{h} px) is not fully inside the poster "
            f"({poster.width_px}x{poster.height_px} px). Move or shrink it so it fits.",
        )
    side = min(w, h)
    if side < MIN_QR_PX:
        raise PosterError(
            "qr_area_too_small",
            f"The QR Area is {side} px ({_px_to_cm(side):.1f} cm at {RENDER_DPI} DPI) on its "
            f"shorter side; the minimum is {MIN_QR_PX} px ({_px_to_cm(MIN_QR_PX):.1f} cm) "
            "so it scans when printed. Make the area larger.",
        )
    ratio = max(w, h) / side
    if ratio > MAX_QR_ASPECT:
        raise PosterError(
            "qr_area_not_square_enough",
            f"The QR Area is {w}x{h} px (ratio {ratio:.2f}); the most allowed is "
            f"{MAX_QR_ASPECT}. The QR is square and is centred in the area at {side} px, "
            "so draw a box closer to a square.",
        )


def composite(poster: PosterImage, x: int, y: int, w: int, h: int, url: str) -> Image.Image:
    """Paste the QR for `url` at full resolution, centred in the QR Area on a white square."""
    check_qr_area(poster, x, y, w, h)
    side = min(w, h)
    left = x + (w - side) // 2
    top = y + (h - side) // 2
    out = poster.image.copy()
    out.paste(Image.new("RGB", (side, side), (255, 255, 255)), (left, top))
    out.paste(qr_image(url, side), (left, top))
    return out


def final_png(image: Image.Image) -> bytes:
    """The Final Poster as a PNG tagged 300 DPI."""
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="PNG", dpi=(RENDER_DPI, RENDER_DPI))
    return buffer.getvalue()


def final_pdf(image: Image.Image, dpi: int = RENDER_DPI) -> bytes:
    """The Final Poster as a one-page PDF whose page size is the pixel size at `dpi`."""
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas

    rgb = image.convert("RGB")
    page_w = rgb.width * 72 / dpi
    page_h = rgb.height * 72 / dpi
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(page_w, page_h), pageCompression=1)
    # Embed losslessly (PNG) so the QR modules stay sharp.
    png = io.BytesIO()
    rgb.save(png, format="PNG")
    png.seek(0)
    pdf.drawImage(ImageReader(png), 0, 0, width=page_w, height=page_h)
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
