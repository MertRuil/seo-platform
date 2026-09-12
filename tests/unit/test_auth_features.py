import uuid
import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import AsyncClient, ASGITransport
from apps.api.routes.auth import router as auth_router
from packages.shared.database import engine, Base

api_app = FastAPI(title="Auth Feature Test")
api_app.include_router(auth_router, prefix="/api/v1")

@pytest_asyncio.fixture(autouse=True)
async def prepare_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

@pytest.mark.anyio
async def test_failed_attempts_and_forgot_password_flow():
    transport = ASGITransport(app=api_app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        unique_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
        # Register a test user
        reg_res = await client.post("/api/v1/auth/register", json={
            "email": unique_email,
            "password": "CorrectPassword123!",
            "full_name": "Lockout Tester"
        })
        assert reg_res.status_code == 201

        # 1st wrong attempt
        res1 = await client.post("/api/v1/auth/login", json={
            "email": unique_email,
            "password": "WrongPassword1"
        })
        assert res1.status_code == 401
        assert res1.headers.get("X-Failed-Attempts") == "1"
        assert res1.headers.get("X-Show-Forgot-Password") == "false"

        # 2nd wrong attempt
        res2 = await client.post("/api/v1/auth/login", json={
            "email": unique_email,
            "password": "WrongPassword2"
        })
        assert res2.status_code == 401
        assert res2.headers.get("X-Failed-Attempts") == "2"
        assert res2.headers.get("X-Show-Forgot-Password") == "false"

        # 3rd wrong attempt -> Should trigger X-Show-Forgot-Password: true
        res3 = await client.post("/api/v1/auth/login", json={
            "email": unique_email,
            "password": "WrongPassword3"
        })
        assert res3.status_code == 401
        assert res3.headers.get("X-Failed-Attempts") == "3"
        assert res3.headers.get("X-Show-Forgot-Password") == "true"
        assert "şifrenizi sıfırlayın" in res3.json()["detail"].lower()

        # Request forgot password
        forgot_res = await client.post("/api/v1/auth/forgot-password", json={
            "email": unique_email
        })
        assert forgot_res.status_code == 200
        forgot_data = forgot_res.json()
        assert forgot_data["success"] is True
        token = forgot_data["reset_token"]
        assert token is not None

        # Reset password with valid token
        reset_res = await client.post("/api/v1/auth/reset-password", json={
            "token": token,
            "new_password": "NewBrandPassword123!"
        })
        assert reset_res.status_code == 200

        # Attempting to use the SAME token again should fail (one-time use)
        replay_res = await client.post("/api/v1/auth/reset-password", json={
            "token": token,
            "new_password": "AnotherPassword123!"
        })
        assert replay_res.status_code == 400

        # Login with new password
        login_res = await client.post("/api/v1/auth/login", json={
            "email": unique_email,
            "password": "NewBrandPassword123!"
        })
        assert login_res.status_code == 200
        assert "access_token" in login_res.json()

@pytest.mark.anyio
async def test_oauth_login_flow():
    from packages.config.settings import settings
    prev_env = settings.ENVIRONMENT
    prev_test_tokens = settings.ALLOW_TEST_OAUTH_TOKENS

    try:
        # Enable test tokens for the unit test
        settings.ENVIRONMENT = "test"
        settings.ALLOW_TEST_OAUTH_TOKENS = True

        transport = ASGITransport(app=api_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            unique_oauth_email = f"oauth_{uuid.uuid4().hex[:8]}@example.com"
            # 1. Valid test token flow when ALLOW_TEST_OAUTH_TOKENS=True in test environment
            res = await client.post("/api/v1/auth/oauth", json={
                "provider": "google",
                "email": unique_oauth_email,
                "full_name": "Google Tester",
                "token": f"test-oauth-token:{unique_oauth_email}"
            })
            assert res.status_code == 200
            assert "access_token" in res.json()

            # 2. Security Exploit Test: Dummy token "x" MUST be rejected with 401
            exploit_res = await client.post("/api/v1/auth/oauth", json={
                "provider": "google",
                "email": unique_oauth_email,
                "token": "x"
            })
            assert exploit_res.status_code == 401
            assert "Geçersiz veya sahte OAuth belirteci" in exploit_res.json()["detail"]

            # 3. Security Exploit Test: Token with mismatched email MUST be rejected
            mismatch_res = await client.post("/api/v1/auth/oauth", json={
                "provider": "google",
                "email": "victim@example.com",
                "token": f"test-oauth-token:attacker@example.com"
            })
            assert mismatch_res.status_code == 401

            # 4. Security Exploit Test: In production, test tokens MUST be strictly rejected!
            settings.ENVIRONMENT = "production"
            settings.ALLOW_TEST_OAUTH_TOKENS = False
            prod_reject_res = await client.post("/api/v1/auth/oauth", json={
                "provider": "google",
                "email": unique_oauth_email,
                "token": f"test-oauth-token:{unique_oauth_email}"
            })
            # In production, it cannot use test token and will attempt Google verification and fail with 401
            assert prod_reject_res.status_code in (401, 502)
    finally:
        settings.ENVIRONMENT = prev_env
        settings.ALLOW_TEST_OAUTH_TOKENS = prev_test_tokens


