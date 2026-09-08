import pytest
from datetime import timedelta
from services.security.jwt_auth import create_access_token, create_refresh_token, decode_token
from fastapi import HTTPException

def test_access_token_creation_and_decode():
    data = {"sub": "user-uuid-1234", "email": "admin@example.com"}
    token = create_access_token(data)
    payload = decode_token(token)
    assert payload["sub"] == "user-uuid-1234"
    assert payload["email"] == "admin@example.com"
    assert payload["type"] == "access"

def test_refresh_token_type():
    data = {"sub": "user-uuid-1234"}
    token = create_refresh_token(data)
    payload = decode_token(token)
    assert payload["type"] == "refresh"

def test_expired_token_raises():
    data = {"sub": "user-uuid-1234"}
    expired_token = create_access_token(data, expires_delta=timedelta(seconds=-10))
    with pytest.raises(HTTPException) as exc_info:
        decode_token(expired_token)
    assert exc_info.value.status_code == 401
