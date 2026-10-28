"""File storage: posters, Final Posters, certificate templates, Certificate PDFs and exports.

Feature code depends only on the `Storage` interface. While `storage_provider` is empty the
local-folder stand-in is used (docs/PROTOTYPE.md); the real provider is added behind the same
interface when the frontend team connects it (docs/PROVIDERS.md), with no feature code changes.

Downloads are owner-only, so the API streams bytes from `get`; storage never hands out URLs.
Keys are forward-slash relative paths such as `posters/<event_id>/final.png`.
"""

import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from app.core.settings import get_settings


class StorageNotFound(KeyError):
    """No object is stored under the requested key."""


class Storage(Protocol):
    def put(self, key: str, data: bytes, content_type: str) -> None:
        """Store `data` under `key`, replacing anything already there (keeps jobs idempotent)."""
        ...

    def get(self, key: str) -> bytes:
        """Return the bytes under `key`; raise `StorageNotFound` if there are none."""
        ...

    def exists(self, key: str) -> bool: ...

    def delete(self, key: str) -> None:
        """Remove `key`. Deleting a missing key is not an error."""
        ...


def validate_key(key: str) -> list[str]:
    """Check a key and return its path segments. Raises ValueError for anything that could
    escape the base folder or mean different things on different providers."""
    if not key:
        raise ValueError("Storage key must not be empty.")
    if "\\" in key:
        raise ValueError(f"Storage key must use forward slashes: {key!r}")
    if key.startswith("/"):
        raise ValueError(f"Storage key must be relative: {key!r}")
    if ":" in key:  # blocks Windows drive paths such as `C:foo`
        raise ValueError(f"Storage key must not contain ':': {key!r}")
    parts = key.split("/")
    for part in parts:
        if part in ("", ".", ".."):
            raise ValueError(f"Storage key has an empty, '.' or '..' segment: {key!r}")
    return parts


class LocalStorage:
    """Local-folder stand-in. Writes are atomic, so a retried job never leaves a half file."""

    def __init__(self, base_dir: Path) -> None:
        self.base_dir = Path(base_dir)

    def _path(self, key: str) -> Path:
        return self.base_dir.joinpath(*validate_key(key))

    def put(self, key: str, data: bytes, content_type: str) -> None:
        # content_type is not needed on disk; real providers store it with the object.
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        # Temp file in the same folder so os.replace stays on one filesystem (atomic).
        fd, tmp_name = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
        try:
            with os.fdopen(fd, "wb") as tmp:
                tmp.write(data)
            os.replace(tmp_name, path)
        except BaseException:
            Path(tmp_name).unlink(missing_ok=True)
            raise

    def get(self, key: str) -> bytes:
        path = self._path(key)
        try:
            return path.read_bytes()
        except (FileNotFoundError, IsADirectoryError, PermissionError) as exc:
            # A folder (a key prefix) is not an object; on Windows reading one is PermissionError.
            if path.is_file():
                raise
            raise StorageNotFound(key) from exc

    def exists(self, key: str) -> bool:
        return self._path(key).is_file()

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.is_file():
            path.unlink(missing_ok=True)


@lru_cache
def get_storage() -> Storage:
    settings = get_settings()
    if not settings.storage_provider:
        return LocalStorage(settings.storage_local_dir)
    raise NotImplementedError(
        f"Storage provider {settings.storage_provider!r} is not built yet; it is added when the "
        "frontend team connects a provider (docs/PROVIDERS.md)."
    )
