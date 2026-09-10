import os
import base64
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from packages.config.settings import settings

_hasher = PasswordHasher()

def hash_password(password: str) -> str:
    """Hashes a plaintext password using Argon2id."""
    return _hasher.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    """Verifies a plaintext password against an Argon2id hash."""
    try:
        return _hasher.verify(hashed, password)
    except VerifyMismatchError:
        return False

def _get_encryption_key() -> bytes:
    key_hex = settings.ENCRYPTION_KEY
    if len(key_hex) >= 64:
        return bytes.fromhex(key_hex[:64])
    # Fallback to padded key in dev
    return key_hex.encode('utf-8').ljust(32, b'0')[:32]

def encrypt_secret(plaintext: str) -> str:
    """Encrypts plaintext secret at rest using AES-256-GCM. Returns base64 nonce+ciphertext."""
    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode('utf-8'), None)
    return base64.b64encode(nonce + ciphertext).decode('utf-8')

def decrypt_secret(encrypted_b64: str) -> str:
    """Decrypts AES-256-GCM base64 string back to plaintext secret."""
    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    raw = base64.b64decode(encrypted_b64.encode('utf-8'))
    if len(raw) < 28:
        raise ValueError("Invalid encrypted payload: insufficient length for AES-GCM")
    nonce = raw[:12]
    ciphertext = raw[12:]
    plaintext_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext_bytes.decode('utf-8')
