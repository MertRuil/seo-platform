import pytest
import hmac
import hashlib
import json
from services.notifications.alert_dispatcher import AlertPayload, AlertDispatcher

@pytest.mark.asyncio
async def test_alert_payload_serialization():
    payload = AlertPayload(
        event_type="RANKING_DROP",
        title="Kritik Pozisyon Kaybı",
        summary="'organik ürünler' kelimesinde 3 sıra gerileme tespit edildi.",
        site_domain="acmestore.io",
        severity="CRITICAL",
        metadata={"keyword": "organik ürünler", "old_pos": 2, "new_pos": 5}
    )
    d = payload.to_dict()
    assert d["event_type"] == "RANKING_DROP"
    assert d["severity"] == "CRITICAL"
    assert d["site_domain"] == "acmestore.io"
    assert d["metadata"]["keyword"] == "organik ürünler"

@pytest.mark.asyncio
async def test_slack_alert_mock_dispatch():
    payload = AlertPayload(
        event_type="COMPLIANCE_VIOLATION",
        title="Yasaklı Sağlık İddiası",
        summary="Ürün açıklamasında 'kanseri iyileştirir' tespit edildi.",
        site_domain="acmestore.io",
        severity="CRITICAL"
    )
    res = await AlertDispatcher.send_slack_alert("mock://hooks.slack.com/services/test", payload)
    assert res["success"] is True
    assert res["channel"] == "SLACK"
    assert res["status_code"] == 200

@pytest.mark.asyncio
async def test_discord_alert_mock_dispatch():
    payload = AlertPayload(
        event_type="CRITICAL_ISSUE",
        title="500 Sunucu Hatası Artışı",
        summary="Kategori sayfalarında 12 adet 500 hatası alındı.",
        site_domain="acmestore.io",
        severity="WARNING"
    )
    res = await AlertDispatcher.send_discord_alert("mock://discord.com/api/webhooks/test", payload)
    assert res["success"] is True
    assert res["channel"] == "DISCORD"
    assert res["status_code"] == 204

@pytest.mark.asyncio
async def test_telegram_alert_mock_dispatch():
    payload = AlertPayload(
        event_type="TEST_NOTIFICATION",
        title="Telegram Test Bildirimi",
        summary="Otonom SEO Platformu bildirim kanalı doğrulandı.",
        site_domain="acmestore.io",
        severity="SUCCESS"
    )
    res = await AlertDispatcher.send_telegram_alert("mock_token", "12345678", payload)
    assert res["success"] is True
    assert res["channel"] == "TELEGRAM"

@pytest.mark.asyncio
async def test_custom_webhook_mock_dispatch():
    payload = AlertPayload(
        event_type="CRAWL_FINISHED",
        title="Site Taraması Tamamlandı",
        summary="245 sayfa tarandı, 2 hata bulundu.",
        site_domain="acmestore.io",
        severity="INFO"
    )
    res = await AlertDispatcher.send_custom_webhook("mock://api.corp.com/seo-webhook", "secret-key-123", payload)
    assert res["success"] is True
    assert res["channel"] == "WEBHOOK"
