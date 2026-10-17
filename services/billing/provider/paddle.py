import os
import json
import hmac
import hashlib
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from packages.shared.models import (
    Plan,
    Subscription,
    Invoice,
    BillingEvent,
    utc_now,
)
from services.billing.provider.base import (
    BillingProvider,
    CheckoutResult,
    PortalResult,
    WebhookProcessResult,
)
from services.billing.usage import UsageService
from services.billing.entitlements import EntitlementGuard
from packages.config.settings import settings


class PaddleBillingProvider(BillingProvider):
    """
    Paddle Billing (v2 / v3 API) Entegrasyon Sağlayıcısı.
    Sandbox ve Production modlarını destekler, imza doğrulaması ve idempotent webhook işleme sunar.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        webhook_secret: Optional[str] = None,
        is_sandbox: Optional[bool] = None
    ):
        self.api_key = api_key or os.getenv("PADDLE_API_KEY", "")
        self.webhook_secret = webhook_secret or os.getenv("PADDLE_WEBHOOK_SECRET", "")
        
        env_sandbox = os.getenv("PADDLE_SANDBOX", "true").lower() in ("true", "1", "yes")
        self.is_sandbox = is_sandbox if is_sandbox is not None else env_sandbox

        self.api_base_url = (
            "https://sandbox-api.paddle.com" if self.is_sandbox else "https://api.paddle.com"
        )
        self.checkout_base_url = (
            "https://sandbox-buy.paddle.com" if self.is_sandbox else "https://buy.paddle.com"
        )

    @property
    def provider_name(self) -> str:
        return "PADDLE"

    def verify_webhook_signature(
        self,
        headers: Dict[str, str],
        body_bytes: bytes
    ) -> bool:
        """
        Paddle-Signature başlığını doğrular.
        Format: ts=1690000000;h1=hash
        """
        if not self.webhook_secret:
            return False

        sig_header = headers.get("Paddle-Signature") or headers.get("paddle-signature")
        if not sig_header:
            return False

        try:
            parts = dict(item.split("=", 1) for item in sig_header.split(";"))
            ts = parts.get("ts")
            h1 = parts.get("h1")

            if not ts or not h1:
                return False
            if abs(time.time() - int(ts)) > 300:
                return False

            # İmza hesabı: ts:raw_body
            signed_payload = f"{ts}:".encode("utf-8") + body_bytes
            computed_hash = hmac.new(
                self.webhook_secret.encode("utf-8"),
                signed_payload,
                hashlib.sha256
            ).hexdigest()

            return hmac.compare_digest(computed_hash, h1)
        except Exception:
            return False

    async def create_checkout_session(
        self,
        db: AsyncSession,
        org_id: str,
        plan_code: str,
        interval: str = "month",
        customer_email: Optional[str] = None,
        return_url: Optional[str] = None
    ) -> CheckoutResult:
        """
        Kullanıcının plan yükseltmesi için Paddle Checkout oturumu oluşturur.
        """
        # Planı veritabanında doğrula
        res = await db.execute(
            select(Plan)
            .where(Plan.code == plan_code.lower())
            .options(selectinload(Plan.prices))
        )
        plan = res.scalars().first()
        if not plan:
            raise ValueError(f"Geçersiz plan kodu: {plan_code}")

        # Eğer gerçek Paddle API Key tanımlıysa doğrudan Paddle API çağrısı yap
        if self.api_key and not self.api_key.startswith("mock_"):
            try:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
                price = next(
                    (p for p in plan.prices if p.interval == interval and p.active),
                    plan.prices[0] if plan.prices else None
                )
                if not price or not price.external_price_id:
                    raise ValueError("Bu plan ve dönem için Paddle fiyat kimliği yapılandırılmamış.")
                payload = {
                    "items": [
                        {
                            "price_id": price.external_price_id,
                            "quantity": 1
                        }
                    ],
                    "custom_data": {
                        "organization_id": org_id,
                        "plan_code": plan.code,
                        "interval": interval
                    }
                }
                # Paddle collects customer details in checkout. The configured default
                # payment link supplies checkout.url; success redirects belong to Paddle.js.

                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(f"{self.api_base_url}/transactions", json=payload, headers=headers)
                    if resp.status_code in (200, 201):
                        data = resp.json().get("data", {})
                        checkout_url = data.get("checkout", {}).get("url")
                        if checkout_url:
                            return CheckoutResult(
                                checkout_url=checkout_url,
                                session_id=data.get("id"),
                                provider=self.provider_name
                            )
            except ValueError:
                raise
            except Exception as exc:
                raise ValueError("Paddle ödeme servisine ulaşılamadı; planınız değiştirilmedi.") from exc

        # Sandbox / Fallback checkout linki
        if settings.ENVIRONMENT.lower() != "test" or not self.api_key.startswith("mock_"):
            raise ValueError("Ödeme oturumu oluşturulamadı. Paddle API anahtarını ve ürün fiyatlarını kontrol edin; planınız değiştirilmedi.")
        callback = return_url or f"/billing?session=checkout_complete&org_id={org_id}"
        checkout_url = (
            f"{self.checkout_base_url}/checkout?"
            f"org_id={org_id}&plan={plan.code}&interval={interval}&return_url={callback}"
        )
        return CheckoutResult(
            checkout_url=checkout_url,
            session_id=f"chk_sim_{int(time.time())}_{org_id[:8]}",
            provider=self.provider_name
        )

    async def get_portal_url(
        self,
        db: AsyncSession,
        org_id: str,
        return_url: Optional[str] = None
    ) -> PortalResult:
        """
        Kullanıcı için Paddle Müşteri Portalı bağlantısı üretir.
        """
        sub = await EntitlementGuard.get_or_create_subscription(db, org_id)
        customer_id = sub.external_customer_id
        if not self.api_key or self.api_key.startswith("mock_"):
            if settings.ENVIRONMENT.lower() == "test":
                return PortalResult(portal_url=f"https://sandbox-customer-portal.paddle.com/?org_id={org_id}")
            raise ValueError("Paddle müşteri portalı henüz yapılandırılmamış.")
        if not customer_id:
            raise ValueError("Bu kuruluş için Paddle müşteri kaydı bulunmuyor. Önce ödeme işlemini tamamlayın.")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    f"{self.api_base_url}/customers/{customer_id}/portal-sessions",
                    json={}, headers={"Authorization": f"Bearer {self.api_key}"})
                response.raise_for_status()
                url = response.json()["data"]["urls"]["general"]["overview"]
                return PortalResult(portal_url=url)
        except Exception as exc:
            raise ValueError("Paddle müşteri portalı oturumu oluşturulamadı.") from exc

    async def cancel_subscription(self, db: AsyncSession, org_id: str, immediately: bool = False) -> bool:
        sub = await EntitlementGuard.get_or_create_subscription(db, org_id)
        if not self.api_key or self.api_key.startswith("mock_") or not sub.external_subscription_id:
            raise ValueError("Paddle aboneliği doğrulanamadı; iptal işlemi yapılmadı.")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post(
                    f"{self.api_base_url}/subscriptions/{sub.external_subscription_id}/cancel",
                    json={"effective_from": "immediately" if immediately else "next_billing_period"},
                    headers={"Authorization": f"Bearer {self.api_key}"})
                response.raise_for_status()
                data = response.json()["data"]
            if immediately and data.get("status") != "canceled":
                raise ValueError("Paddle iptal işlemini onaylamadı.")
            if not immediately and data.get("scheduled_change", {}).get("action") != "cancel":
                raise ValueError("Paddle dönem sonu iptalini onaylamadı.")
            sub.cancel_at_period_end = not immediately
            sub.canceled_at = utc_now() if immediately else None
            if immediately: sub.status = "CANCELED"
            await db.commit()
            return True
        except Exception as exc:
            raise ValueError("Paddle abonelik iptali doğrulanamadı; yerel kayıt değiştirilmedi.") from exc

    async def handle_webhook_event(
        self,
        db: AsyncSession,
        body_bytes: bytes,
        headers: Dict[str, str]
    ) -> WebhookProcessResult:
        """
        Paddle webhook olayını güvenli, doğrulanmış ve idempotent şekilde işler.
        """
        if not self.verify_webhook_signature(headers, body_bytes):
            return WebhookProcessResult(
                event_id="unknown",
                event_type="unknown",
                processed=False,
                action_taken="SIGNATURE_VERIFICATION_FAILED",
                error="Invalid Paddle-Signature"
            )

        try:
            payload = json.loads(body_bytes.decode("utf-8"))
        except Exception as e:
            return WebhookProcessResult(
                event_id="unknown",
                event_type="unknown",
                processed=False,
                action_taken="INVALID_JSON",
                error=str(e)
            )

        event_id = payload.get("event_id") or f"evt_sim_{int(time.time())}"
        event_type = payload.get("event_type", "unknown")
        data = payload.get("data", {})

        # Idempotency Kontrolü: Aynı event_id daha önce işlendi mi?
        existing_event = await db.execute(
            select(BillingEvent).where(BillingEvent.external_event_id == event_id)
        )
        if existing_event.scalars().first():
            return WebhookProcessResult(
                event_id=event_id,
                event_type=event_type,
                processed=True,
                action_taken="DUPLICATE_SKIPPED"
            )

        # Olay kaydı aç (audit)
        billing_event = BillingEvent(
            provider=self.provider_name,
            external_event_id=event_id,
            event_type=event_type,
            payload_json=json.dumps(payload),
        )
        db.add(billing_event)

        action_taken = "IGNORED"
        error_detail: Optional[str] = None

        try:
            custom_data = data.get("custom_data") or {}
            org_id = custom_data.get("organization_id")

            # 1. Abonelik Başlatıldı / Aktif Edildi
            if event_type in ("subscription.activated", "subscription.created"):
                action_taken = await self._handle_subscription_activated(db, data, org_id)

            # 2. Abonelik Güncellendi
            elif event_type == "subscription.updated":
                action_taken = await self._handle_subscription_updated(db, data, org_id)

            # 3. Abonelik İptal Edildi
            elif event_type == "subscription.canceled":
                action_taken = await self._handle_subscription_canceled(db, data, org_id)

            # 4. Abonelik Ödemesi Gecikti
            elif event_type == "subscription.past_due":
                action_taken = await self._handle_subscription_past_due(db, data, org_id)

            # 5. Ödeme / Fatura Tamamlandı
            elif event_type in ("transaction.completed", "transaction.paid"):
                action_taken = await self._handle_transaction_completed(db, data, org_id)

            billing_event.processed_at = utc_now()
            await db.commit()

            return WebhookProcessResult(
                event_id=event_id,
                event_type=event_type,
                processed=True,
                action_taken=action_taken
            )

        except Exception as ex:
            error_detail = str(ex)
            billing_event.error = error_detail
            await db.commit()
            return WebhookProcessResult(
                event_id=event_id,
                event_type=event_type,
                processed=False,
                action_taken="ERROR",
                error=error_detail
            )

    async def _handle_subscription_activated(
        self,
        db: AsyncSession,
        data: dict,
        org_id: Optional[str]
    ) -> str:
        """Abonelik aktivasyonunu işler."""
        if not org_id:
            return "NO_ORG_ID"

        custom_data = data.get("custom_data") or {}
        plan_code = custom_data.get("plan_code")

        # Plan kodunu custom_data'dan veya ürün/fiyat ID'sinden bul
        if not plan_code and data.get("items"):
            price_id = data["items"][0].get("price", {}).get("id")
            # Fiyata bağlı planı ara
            from packages.shared.models import PlanPrice
            price_res = await db.execute(
                select(PlanPrice).where(PlanPrice.external_price_id == price_id)
            )
            price_record = price_res.scalars().first()
            if price_record:
                plan_res = await db.execute(select(Plan).where(Plan.id == price_record.plan_id))
                found_plan = plan_res.scalars().first()
                if found_plan:
                    plan_code = found_plan.code

        plan_code = (plan_code or "pro").lower()

        res = await db.execute(
            select(Plan)
            .where(Plan.code == plan_code)
            .options(selectinload(Plan.limits))
        )
        target_plan = res.scalars().first()
        if not target_plan:
            return f"PLAN_NOT_FOUND_{plan_code}"

        sub = await EntitlementGuard.get_or_create_subscription(db, org_id)
        sub.plan_id = target_plan.id
        sub.plan = target_plan
        sub.status = "ACTIVE"
        sub.provider = self.provider_name
        sub.external_subscription_id = data.get("id")
        sub.external_customer_id = data.get("customer_id")

        # Dönem tarihleri
        current_period = data.get("current_billing_period") or {}
        if current_period.get("starts_at"):
            sub.current_period_start = datetime.fromisoformat(current_period["starts_at"].replace("Z", "+00:00"))
        if current_period.get("ends_at"):
            sub.current_period_end = datetime.fromisoformat(current_period["ends_at"].replace("Z", "+00:00"))

        # Plan başlangıç AI kredisi tanımla
        plan_credits = next((l.hard_limit for l in target_plan.limits if l.metric == "ai_credits"), 0)
        if plan_credits > 0:
            await UsageService.grant_credits(
                db,
                org_id,
                plan_credits,
                reason="PLAN_GRANT",
                ref_id=f"sub_activated_{data.get('id', 'new')}"
            )

        return f"SUBSCRIPTION_ACTIVATED_{plan_code.upper()}"

    async def _handle_subscription_updated(
        self,
        db: AsyncSession,
        data: dict,
        org_id: Optional[str]
    ) -> str:
        """Abonelik güncellemesini işler."""
        sub_id = data.get("id")
        sub = None

        if org_id:
            sub = await EntitlementGuard.get_or_create_subscription(db, org_id)
        elif sub_id:
            res = await db.execute(
                select(Subscription).where(Subscription.external_subscription_id == sub_id)
            )
            sub = res.scalars().first()

        if not sub:
            return "SUBSCRIPTION_NOT_FOUND"

        paddle_status = data.get("status", "active").lower()
        if paddle_status in ("active", "trialing"):
            sub.status = "ACTIVE"
        elif paddle_status == "past_due":
            sub.status = "PAST_DUE"
        elif paddle_status in ("canceled", "cancelled"):
            sub.status = "CANCELED"

        current_period = data.get("current_billing_period") or {}
        if current_period.get("ends_at"):
            sub.current_period_end = datetime.fromisoformat(current_period["ends_at"].replace("Z", "+00:00"))

        return f"SUBSCRIPTION_UPDATED_{sub.status}"

    async def _handle_subscription_canceled(
        self,
        db: AsyncSession,
        data: dict,
        org_id: Optional[str]
    ) -> str:
        """Abonelik iptalini işler."""
        sub_id = data.get("id")
        sub = None

        if org_id:
            sub = await EntitlementGuard.get_or_create_subscription(db, org_id)
        elif sub_id:
            res = await db.execute(
                select(Subscription).where(Subscription.external_subscription_id == sub_id)
            )
            sub = res.scalars().first()

        if not sub:
            return "SUBSCRIPTION_NOT_FOUND"

        sub.status = "CANCELED"
        sub.canceled_at = utc_now()
        return "SUBSCRIPTION_CANCELED"

    async def _handle_subscription_past_due(
        self,
        db: AsyncSession,
        data: dict,
        org_id: Optional[str]
    ) -> str:
        """Abonelik ödemesi gecikmesini işler."""
        sub_id = data.get("id")
        sub = None

        if org_id:
            sub = await EntitlementGuard.get_or_create_subscription(db, org_id)
        elif sub_id:
            res = await db.execute(
                select(Subscription).where(Subscription.external_subscription_id == sub_id)
            )
            sub = res.scalars().first()

        if not sub:
            return "SUBSCRIPTION_NOT_FOUND"

        sub.status = "PAST_DUE"
        return "SUBSCRIPTION_PAST_DUE"

    async def _handle_transaction_completed(
        self,
        db: AsyncSession,
        data: dict,
        org_id: Optional[str]
    ) -> str:
        """Tamamlanan işlemden fatura (Invoice) üretir."""
        if not org_id:
            # Subscriptions üzerinden bulmayı dene
            sub_id = data.get("subscription_id")
            if sub_id:
                res = await db.execute(
                    select(Subscription).where(Subscription.external_subscription_id == sub_id)
                )
                sub = res.scalars().first()
                if sub:
                    org_id = sub.organization_id

        if not org_id:
            return "TRANSACTION_NO_ORG_ID"

        tx_id = data.get("id", f"txn_{int(time.time())}")
        details = data.get("details", {})
        totals = details.get("totals", {})

        total_minor = int(float(totals.get("total", 0)))
        tax_minor = int(float(totals.get("tax", 0)))
        subtotal_minor = int(float(totals.get("subtotal", 0)))
        currency = data.get("currency_code", "USD")
        invoice_number = data.get("invoice_number") or f"INV-{tx_id[-8:].upper()}"
        invoice_id = data.get("invoice_id") or tx_id

        # Mükerrer fatura engelleme
        res = await db.execute(
            select(Invoice).where(Invoice.external_invoice_id == invoice_id)
        )
        existing_invoice = res.scalars().first()
        if existing_invoice:
            return "INVOICE_ALREADY_EXISTS"

        invoice = Invoice(
            organization_id=org_id,
            external_invoice_id=invoice_id,
            number=invoice_number,
            status="PAID",
            currency=currency,
            subtotal_minor=subtotal_minor,
            tax_minor=tax_minor,
            total_minor=total_minor,
            pdf_url=data.get("invoice_pdf") or f"https://invoices.paddle.com/{invoice_id}.pdf",
            issued_at=utc_now(),
            paid_at=utc_now()
        )
        db.add(invoice)
        return f"INVOICE_RECORDED_{invoice_number}"
