"""Example job proving the queue works end to end. Real jobs (render_poster,
generate_certificate, send_certificate_notification) live in their owning modules."""


def ping(message: str) -> str:
    return f"pong: {message}"
