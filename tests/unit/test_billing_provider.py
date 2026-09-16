import pytest
import hmac
import hashlib
import json
import time
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.future import select

from packages.shared.database import Base
from packages.shared.models import (
    Organization,
    Plan,
    Subscription,
    Invoice,
    BillingEvent,
)
from services.billing.plans import seed_billing_plans
from services.billing.provider.paddle import PaddleBillingProvider
from services.billing.provider.factory import get_billing_provider
from services.billing.usage import UsageService


@pytest.fixture
async def async_db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with async_session() as session:
        yield session

    await engine.dispose()


@pytest.fixture
def webhook_secret():
    return "pdl_sec_test_secret_12345"


@pytest.fixture
def paddle_provider(webhook_secret):
    return PaddleBillingProvider(
        api_key="mock_key",
        webhook_secret=webhook_secret,
        is_sandbox=True
    )


def generate_paddle_signature(secret: str, body_bytes: bytes, ts: int) -> str:
    signed_payload = f"{ts}:".encode("utf-8") + body_bytes
    h1 = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return f"ts={ts};h1={h1}"


@pytest.mark.asyncio
async def test_provider_factory():
    provider = get_billing_provider("paddle")
    assert provider.provider_name == "PADDLE"

    with pytest.raises(ValueError, match="Desteklenmeyen"):
        get_billing_provider("unknown_provider")


@pytest.mark.asyncio
async def test_webhook_signature_verification(paddle_provider, webhook_secret):
    body = json.dumps({"event_type": "test"}).encode("utf-8")
    ts = int(time.time())
    sig = generate_paddle_signature(webhook_secret, body, ts)

    # Geçerli imza
    headers = {"Paddle-Signature": sig}
    assert paddle_provider.verify_webhook_signature(headers, body) is True

    # Başlık yok
    assert paddle_provider.verify_webhook_signature({}, body) is False

    # Değiştirilmiş gövde (tampered)
    tampered_body = json.dumps({"event_type": "tampered"}).encode("utf-8")
    assert paddle_provider.verify_webhook_signature(headers, tampered_body) is False

    # Sahte imza
    fake_headers = {"Paddle-Signature": f"ts={ts};h1=deadbeef1234"}
    assert paddle_provider.verify_webhook_signature(fake_headers, body) is False


@pytest.mark.asyncio
async def test_checkout_session_creation(async_db: AsyncSession, paddle_provider):
    await seed_billing_plans(async_db)

    org = Organization(name="Acme Corp", slug="acme-corp")
    async_db.add(org)
    await async_db.commit()
    await async_db.refresh(org)

    result = await paddle_provider.create_checkout_session(
        db=async_db,
        org_id=org.id,
        plan_code="pro",
        interval="month",
        customer_email="founder@acme.com",
        return_url="https://app.calpeo.ai/billing/success"
    )

    assert result.provider == "PADDLE"
    assert "sandbox-buy.paddle.com" in result.checkout_url
    assert f"org_id={org.id}" in result.checkout_url
    assert "plan=pro" in result.checkout_url


@pytest.mark.asyncio
async def test_customer_portal_url(async_db: AsyncSession, paddle_provider):
    await seed_billing_plans(async_db)

    org = Organization(name="Beta Ltd", slug="beta-ltd")
    async_db.add(org)
    await async_db.commit()
    await async_db.refresh(org)

    result = await paddle_provider.get_portal_url(async_db, org.id)
    assert "sandbox-customer-portal.paddle.com" in result.portal_url
    assert f"org_id={org.id}" in result.portal_url


@pytest.mark.asyncio
async def test_subscription_activated_webhook(async_db: AsyncSession, paddle_provider, webhook_secret):
    await seed_billing_plans(async_db)

    org = Organization(name="Scale Inc", slug="scale-inc")
    async_db.add(org)
    await async_db.commit()
    await async_db.refresh(org)

    event_id = f"evt_test_{uuid.uuid4().hex[:8]}"
    payload = {
        "event_id": event_id,
        "event_type": "subscription.activated",
        "data": {
            "id": "sub_paddle_12345",
            "customer_id": "ctm_paddle_67890",
            "status": "active",
            "custom_data": {
                "organization_id": org.id,
                "plan_code": "pro"
            },
            "current_billing_period": {
                "starts_at": "2026-09-01T00:00:00Z",
                "ends_at": "2026-10-01T00:00:00Z"
            }
        }
    }
    body_bytes = json.dumps(payload).encode("utf-8")
    ts = int(time.time())
    headers = {"Paddle-Signature": generate_paddle_signature(webhook_secret, body_bytes, ts)}

    result = await paddle_provider.handle_webhook_event(async_db, body_bytes, headers)
    assert result.processed is True
    assert result.action_taken == "SUBSCRIPTION_ACTIVATED_PRO"

    # Organizasyon aboneliğini doğrula
    sub_res = await async_db.execute(select(Subscription).where(Subscription.organization_id == org.id))
    sub = sub_res.scalars().first()
    assert sub is not None
    assert sub.status == "ACTIVE"
    assert sub.provider == "PADDLE"
    assert sub.external_subscription_id == "sub_paddle_12345"
    assert sub.external_customer_id == "ctm_paddle_67890"

    # Pro plan AI kredisi tanımlandığını doğrula (Pro plan 500 AI kredisi içerir)
    credit_balance = await UsageService.get_credit_balance(async_db, org.id)
    assert credit_balance >= 500

    # Idempotency testi: Aynı event_id tekrar geldiğinde işlem atlanmalı ve kredi 2 kez yüklenmemeli
    dup_result = await paddle_provider.handle_webhook_event(async_db, body_bytes, headers)
    assert dup_result.processed is True
    assert dup_result.action_taken == "DUPLICATE_SKIPPED"
    after_balance = await UsageService.get_credit_balance(async_db, org.id)
    assert after_balance == credit_balance


@pytest.mark.asyncio
async def test_subscription_canceled_and_past_due_webhooks(async_db: AsyncSession, paddle_provider, webhook_secret):
    await seed_billing_plans(async_db)

    org = Organization(name="Churn Corp", slug="churn-corp")
    async_db.add(org)
    await async_db.commit()
    await async_db.refresh(org)

    # 1. Past due event
    event_id_1 = f"evt_pd_{uuid.uuid4().hex[:8]}"
    payload_pd = {
        "event_id": event_id_1,
        "event_type": "subscription.past_due",
        "data": {
            "id": "sub_churn_999",
            "custom_data": {"organization_id": org.id}
        }
    }
    body_pd = json.dumps(payload_pd).encode("utf-8")
    headers_pd = {"Paddle-Signature": generate_paddle_signature(webhook_secret, body_pd, int(time.time()))}

    res_pd = await paddle_provider.handle_webhook_event(async_db, body_pd, headers_pd)
    assert res_pd.processed is True
    assert res_pd.action_taken == "SUBSCRIPTION_PAST_DUE"

    sub_res = await async_db.execute(select(Subscription).where(Subscription.organization_id == org.id))
    sub = sub_res.scalars().first()
    assert sub.status == "PAST_DUE"

    # 2. Canceled event
    event_id_2 = f"evt_cancel_{uuid.uuid4().hex[:8]}"
    payload_cancel = {
        "event_id": event_id_2,
        "event_type": "subscription.canceled",
        "data": {
            "id": "sub_churn_999",
            "custom_data": {"organization_id": org.id}
        }
    }
    body_cancel = json.dumps(payload_cancel).encode("utf-8")
    headers_cancel = {"Paddle-Signature": generate_paddle_signature(webhook_secret, body_cancel, int(time.time()))}

    res_cancel = await paddle_provider.handle_webhook_event(async_db, body_cancel, headers_cancel)
    assert res_cancel.processed is True
    assert res_cancel.action_taken == "SUBSCRIPTION_CANCELED"

    await async_db.refresh(sub)
    assert sub.status == "CANCELED"
    assert sub.canceled_at is not None


@pytest.mark.asyncio
async def test_transaction_completed_creates_invoice(async_db: AsyncSession, paddle_provider, webhook_secret):
    await seed_billing_plans(async_db)

    org = Organization(name="Invoice Org", slug="invoice-org")
    async_db.add(org)
    await async_db.commit()
    await async_db.refresh(org)

    event_id = f"evt_txn_{uuid.uuid4().hex[:8]}"
    payload_txn = {
        "event_id": event_id,
        "event_type": "transaction.completed",
        "data": {
            "id": "txn_paddle_555",
            "invoice_id": "inv_paddle_555",
            "invoice_number": "INV-2026-001",
            "currency_code": "USD",
            "invoice_pdf": "https://invoices.paddle.com/inv_paddle_555.pdf",
            "custom_data": {"organization_id": org.id},
            "details": {
                "totals": {
                    "subtotal": 11900,
                    "tax": 0,
                    "total": 11900
                }
            }
        }
    }
    body_txn = json.dumps(payload_txn).encode("utf-8")
    headers_txn = {"Paddle-Signature": generate_paddle_signature(webhook_secret, body_txn, int(time.time()))}

    res_txn = await paddle_provider.handle_webhook_event(async_db, body_txn, headers_txn)
    assert res_txn.processed is True
    assert "INVOICE_RECORDED" in res_txn.action_taken

    # Fatura kaydını doğrula
    inv_res = await async_db.execute(select(Invoice).where(Invoice.organization_id == org.id))
    inv = inv_res.scalars().first()
    assert inv is not None
    assert inv.number == "INV-2026-001"
    assert inv.total_minor == 11900
    assert inv.status == "PAID"
    assert inv.currency == "USD"
    assert inv.pdf_url == "https://invoices.paddle.com/inv_paddle_555.pdf"
