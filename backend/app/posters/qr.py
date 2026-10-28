"""Event QR generation (R19, decision 36).

Pure functions: no database, no FastAPI, no storage. The Event QR points to the Event's
public page on the frontend, never to the Registration Form (decision 5).
"""

import io
import uuid

import qrcode
import qrcode.image.svg
from PIL import Image
from qrcode.constants import ERROR_CORRECT_M

from app.core.settings import get_settings

QUIET_ZONE_MODULES = 4


def event_page_url(event_id: uuid.UUID | str) -> str:
    """URL of the Event's public page on the frontend, which the Event QR encodes."""
    base = get_settings().frontend_base_url.rstrip("/")
    return f"{base}/events/{event_id}"


def _qr(data: str, box_size: int = 10, border: int = QUIET_ZONE_MODULES) -> qrcode.QRCode:
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=box_size, border=border)
    qr.add_data(data)
    qr.make(fit=True)
    return qr


def qr_png(data: str, box_size: int = 10, border: int = QUIET_ZONE_MODULES) -> bytes:
    """The QR as a PNG, `box_size` pixels per module with a `border`-module quiet zone."""
    image = _qr(data, box_size=box_size, border=border).make_image(
        fill_color="black", back_color="white"
    )
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def qr_svg(data: str) -> bytes:
    """The QR as an SVG document (vector, for print designers)."""
    image = _qr(data).make_image(image_factory=qrcode.image.svg.SvgPathImage)
    return image.to_string(encoding="utf-8")


def qr_image(data: str, size_px: int) -> Image.Image:
    """A crisp square QR exactly `size_px` wide, with a 4-module white quiet zone.

    Every module is drawn the same whole number of pixels wide; any leftover pixels
    are added as extra white margin, so the quiet zone is never less than 4 modules.
    """
    if size_px <= 0:
        raise ValueError("size_px must be positive")
    matrix = _qr(data, box_size=1, border=QUIET_ZONE_MODULES).get_matrix()
    modules = len(matrix)

    base = Image.new("L", (modules, modules), 255)
    base.putdata([0 if cell else 255 for row in matrix for cell in row])

    box = size_px // modules
    if box < 1:
        # Too small to draw one pixel per module; scaling down this far won't scan,
        # but still return the requested size.
        return base.resize((size_px, size_px), Image.Resampling.NEAREST).convert("RGB")

    drawn = base.resize((modules * box, modules * box), Image.Resampling.NEAREST)
    out = Image.new("L", (size_px, size_px), 255)
    offset = (size_px - drawn.width) // 2
    out.paste(drawn, (offset, offset))
    return out.convert("RGB")
