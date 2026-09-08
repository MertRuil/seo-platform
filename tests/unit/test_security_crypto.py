import pytest
from services.security.crypto import hash_password, verify_password, encrypt_secret, decrypt_secret

def test_argon2_password_hashing():
    pw = "SuperSecretPassword123!"
    hashed = hash_password(pw)
    assert hashed != pw
    assert verify_password(pw, hashed) is True
    assert verify_password("WrongPassword123!", hashed) is False

def test_aes_gcm_envelope_encryption():
    secret = "AIzaSySecretOAuthToken1234567890"
    encrypted = encrypt_secret(secret)
    assert encrypted != secret
    decrypted = decrypt_secret(encrypted)
    assert decrypted == secret
