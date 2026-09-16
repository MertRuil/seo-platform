from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession


class CheckoutResult(BaseModel):
    checkout_url: str
    session_id: Optional[str] = None
    provider: str


class PortalResult(BaseModel):
    portal_url: str


class WebhookProcessResult(BaseModel):
    event_id: str
    event_type: str
    processed: bool
    action_taken: str
    error: Optional[str] = None


class BillingProvider(ABC):
    """
    Tüm ödeme ve faturalama sağlayıcıları (Paddle, iyzico, Stripe vb.) için ortak soyut arayüz.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Sağlayıcı tanımlayıcısı (örn: 'PADDLE', 'IYZICO', 'STRIPE')."""
        pass

    @abstractmethod
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
        Kullanıcının plan yükseltmesi veya abonelik başlatması için checkout linki oluşturur.
        """
        pass

    @abstractmethod
    async def get_portal_url(
        self,
        db: AsyncSession,
        org_id: str,
        return_url: Optional[str] = None
    ) -> PortalResult:
        """
        Kullanıcının fatura indirme, kart değiştirme işlemlerini yapabileceği müşteri portalı URL'ini döner.
        """
        pass

    @abstractmethod
    async def cancel_subscription(
        self,
        db: AsyncSession,
        org_id: str,
        immediately: bool = False
    ) -> bool:
        """
        Aboneliği dönem sonunda veya anında iptal eder.
        """
        pass

    @abstractmethod
    def verify_webhook_signature(
        self,
        headers: Dict[str, str],
        body_bytes: bytes
    ) -> bool:
        """
        Gelen webhook isteğinin sağlayıcıya ait olduğunu ve değiştirilmediğini imzadan doğrular.
        """
        pass

    @abstractmethod
    async def handle_webhook_event(
        self,
        db: AsyncSession,
        body_bytes: bytes,
        headers: Dict[str, str]
    ) -> WebhookProcessResult:
        """
        Gelen webhook olayını ayrıştırır, doğrular, idempotency kontrolü yapar ve DB'yi günceller.
        """
        pass
