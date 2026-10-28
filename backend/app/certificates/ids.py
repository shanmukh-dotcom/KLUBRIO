"""Certificate ID format (decision 26): `ORG-XXXX-XXXX`.

Alphabet is Crockford base32 (no I, L, O, U), so IDs read aloud or typed from paper
don't confuse 0/O or 1/I/L. 8 random characters = 32^8 ≈ 1.1 trillion IDs, generated
with `secrets` so they can't be guessed in sequence. Uniqueness is still enforced by the
`certificates.public_id` unique constraint; on a collision the caller retries.
"""

import re
import secrets

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
PREFIX = "ORG"
GROUP = 4
GROUPS = 2

_PATTERN = re.compile(rf"^{PREFIX}(-[{ALPHABET}]{{{GROUP}}}){{{GROUPS}}}$")
# Letters people commonly type instead of the Crockford ones.
_LOOKALIKES = str.maketrans({"O": "0", "I": "1", "L": "1", "U": "V"})


def new_certificate_id() -> str:
    groups = ("".join(secrets.choice(ALPHABET) for _ in range(GROUP)) for _ in range(GROUPS))
    return "-".join((PREFIX, *groups))


def normalise_certificate_id(raw: str) -> str | None:
    """Clean up a typed ID for lookup on the Verification Page; None if it can't be valid."""
    cleaned = raw.strip().upper().replace(" ", "")
    body = cleaned.removeprefix(PREFIX).replace("-", "").translate(_LOOKALIKES)
    if len(body) != GROUP * GROUPS:
        return None
    candidate = "-".join((PREFIX, *(body[i : i + GROUP] for i in range(0, len(body), GROUP))))
    return candidate if _PATTERN.match(candidate) else None
