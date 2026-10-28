from collections.abc import Iterator

import pytest

from app.core.settings import get_settings
from app.core.storage import LocalStorage, StorageNotFound, get_storage


@pytest.fixture
def storage(tmp_path) -> LocalStorage:
    return LocalStorage(tmp_path)


def test_put_get_round_trip(storage):
    storage.put("posters/e1/final.png", b"\x89PNG data", "image/png")
    assert storage.get("posters/e1/final.png") == b"\x89PNG data"


def test_nested_keys_create_folders(storage, tmp_path):
    storage.put("certificates/b1/c/d/cert.pdf", b"%PDF", "application/pdf")
    assert (tmp_path / "certificates" / "b1" / "c" / "d" / "cert.pdf").read_bytes() == b"%PDF"


def test_overwrite_replaces_content(storage, tmp_path):
    storage.put("exports/e1.csv", b"old", "text/csv")
    storage.put("exports/e1.csv", b"new", "text/csv")
    assert storage.get("exports/e1.csv") == b"new"
    # No temp files are left behind after the atomic write.
    assert [p.name for p in (tmp_path / "exports").iterdir()] == ["e1.csv"]


def test_exists(storage):
    assert not storage.exists("a/b.txt")
    storage.put("a/b.txt", b"x", "text/plain")
    assert storage.exists("a/b.txt")
    assert not storage.exists("a")  # a folder (key prefix) is not an object


def test_delete(storage):
    storage.put("a/b.txt", b"x", "text/plain")
    storage.delete("a/b.txt")
    assert not storage.exists("a/b.txt")


def test_delete_missing_key_is_not_an_error(storage):
    storage.delete("never/there.txt")


def test_get_missing_key_raises(storage):
    with pytest.raises(StorageNotFound):
        storage.get("missing.txt")


def test_get_folder_raises_not_found(storage):
    storage.put("a/b.txt", b"x", "text/plain")
    with pytest.raises(StorageNotFound):
        storage.get("a")


@pytest.mark.parametrize(
    "key",
    [
        "",
        "/abs/path.png",
        "../escape.png",
        "posters/../../escape.png",
        "posters/..",
        "posters\\e1\\final.png",
        "posters//final.png",
        "posters/./final.png",
        "posters/",
        "C:/Windows/evil.png",
        "C:evil.png",
    ],
)
def test_rejected_keys(storage, key):
    with pytest.raises(ValueError):
        storage.put(key, b"x", "text/plain")
    with pytest.raises(ValueError):
        storage.get(key)
    with pytest.raises(ValueError):
        storage.exists(key)
    with pytest.raises(ValueError):
        storage.delete(key)


@pytest.fixture
def fresh_caches() -> Iterator[None]:
    get_settings.cache_clear()
    get_storage.cache_clear()
    yield
    get_settings.cache_clear()
    get_storage.cache_clear()


def test_get_storage_defaults_to_local(fresh_caches, monkeypatch, tmp_path):
    monkeypatch.setenv("ORGNISER_STORAGE_PROVIDER", "")
    monkeypatch.setenv("ORGNISER_STORAGE_LOCAL_DIR", str(tmp_path))
    storage = get_storage()
    assert isinstance(storage, LocalStorage)
    assert storage.base_dir == tmp_path


def test_get_storage_unknown_provider_not_implemented(fresh_caches, monkeypatch):
    monkeypatch.setenv("ORGNISER_STORAGE_PROVIDER", "s3")
    with pytest.raises(NotImplementedError):
        get_storage()
