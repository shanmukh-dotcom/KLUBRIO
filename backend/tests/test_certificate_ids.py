import pytest

from app.certificates.ids import ALPHABET, new_certificate_id, normalise_certificate_id


def test_format_and_alphabet():
    for _ in range(500):
        cid = new_certificate_id()
        prefix, a, b = cid.split("-")
        assert prefix == "ORG" and len(a) == len(b) == 4
        assert set(a + b) <= set(ALPHABET)
        assert not set(a + b) & set("ILOU")


def test_ids_are_not_repeated_in_a_large_batch():
    ids = {new_certificate_id() for _ in range(5000)}
    assert len(ids) == 5000


@pytest.mark.parametrize(
    "typed, expected",
    [
        ("ORG-7KQ2-M9XD", "ORG-7KQ2-M9XD"),
        ("org-7kq2-m9xd", "ORG-7KQ2-M9XD"),
        (" ORG 7KQ2 M9XD ", "ORG-7KQ2-M9XD"),
        ("7KQ2M9XD", "ORG-7KQ2-M9XD"),
        ("ORG-OKQ2-M9XD", "ORG-0KQ2-M9XD"),  # O typed for zero
        ("ORG-7KQI-M9XD", "ORG-7KQ1-M9XD"),  # I typed for one
    ],
)
def test_normalise_accepts_common_typing(typed, expected):
    assert normalise_certificate_id(typed) == expected


@pytest.mark.parametrize("typed", ["", "ORG-123", "ORG-7KQ2-M9XD-EXTRA", "ORG-7KQ2-M9X!"])
def test_normalise_rejects_impossible_ids(typed):
    assert normalise_certificate_id(typed) is None
