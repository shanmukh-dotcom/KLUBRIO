from app.core.security import hash_password, hash_token, needs_rehash, new_token, verify_password


def test_password_round_trip():
    hashed = hash_password("correct horse battery staple")
    assert hashed.startswith("$argon2id$")
    assert verify_password(hashed, "correct horse battery staple")
    assert not needs_rehash(hashed)


def test_wrong_password_does_not_verify():
    hashed = hash_password("right")
    assert not verify_password(hashed, "wrong")


def test_missing_or_malformed_hash_never_verifies():
    assert not verify_password(None, "anything")
    assert not verify_password("", "anything")
    assert not verify_password("not-a-hash", "anything")
    assert needs_rehash("not-a-hash")


def test_same_password_hashes_differently():
    assert hash_password("same") != hash_password("same")  # random salt


def test_token_hash_is_sha256_hex_and_stable():
    token = new_token()
    digest = hash_token(token)
    assert len(digest) == 64
    assert all(c in "0123456789abcdef" for c in digest)
    assert hash_token(token) == digest
    assert hash_token(token + "x") != digest


def test_tokens_are_unique_and_url_safe():
    tokens = {new_token() for _ in range(200)}
    assert len(tokens) == 200
    allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
    for token in tokens:
        assert len(token) >= 43  # 32 random bytes
        assert set(token) <= allowed
