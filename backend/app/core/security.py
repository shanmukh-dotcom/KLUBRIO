"""Password and token hashing (decisions 24, 25). Pure functions: no database access.

Passwords are hashed with Argon2id. Session and password-reset tokens are random,
URL-safe strings; only their SHA-256 hex digest is stored, so a database leak doesn't
hand out live sessions or reset links.
"""

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

# argon2-cffi's defaults are Argon2id with the RFC 9106 low-memory profile.
_hasher = PasswordHasher()


def hash_password(plain: str) -> str:
    """Hash a password for storage in `students.password_hash`."""
    return _hasher.hash(plain)


def verify_password(password_hash: str | None, plain: str) -> bool:
    """True when `plain` matches `password_hash`. A missing or malformed hash never matches."""
    if not password_hash:
        return False
    try:
        return _hasher.verify(password_hash, plain)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    """True when the hash was made with older parameters and should be replaced after login."""
    try:
        return _hasher.check_needs_rehash(password_hash)
    except InvalidHashError:
        return True


def new_token() -> str:
    """A fresh random token for a session cookie or a password-reset link."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """SHA-256 hex digest of a token: what `sessions` and `password_reset_tokens` store."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
