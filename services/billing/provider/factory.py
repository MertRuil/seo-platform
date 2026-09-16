from services.billing.provider.base import BillingProvider
from services.billing.provider.paddle import PaddleBillingProvider


def get_billing_provider(name: str = "paddle") -> BillingProvider:
    """
    Belirtilen isimdeki ödeme sağlayıcı adaptörünü döner.
    Varsayılan: 'paddle'
    """
    provider_key = (name or "paddle").lower()
    if provider_key == "paddle":
        return PaddleBillingProvider()
    
    raise ValueError(f"Desteklenmeyen veya tanımlanmamış faturalama sağlayıcısı: {name}")
