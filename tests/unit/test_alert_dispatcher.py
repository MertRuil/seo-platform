import pytest
import hmac
import hashlib
import json
from unittest.mock import AsyncMock, patch, MagicMock
import httpx
from services.notifications.alert_dispatcher import (
    AlertPayload,
    AlertDispatcher,
    _is_mock_url,
    _is_mock_bot_token,
    _telegram_html_escape,
    _slack_mrkdwn_escape
)

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

def test_mock_detection_helpers():
    """Ensures legitimate domains containing 'test' or 'mock' are NOT falsely detected as mock."""
    # Real legitimate URLs that contain 'test' or 'mock'
    assert _is_mock_url("https://contest.io/webhook") is False
    assert _is_mock_url("https://api.latest-corp.com/alerts") is False
    assert _is_mock_url("https://fastest-cdn.net/events") is False
    assert _is_mock_url("https://mockup-services.com/hook") is False
    assert _is_mock_url("https://speedtest.company.com/alerts") is False

    # Actual mock URLs
    assert _is_mock_url("mock://hooks.slack.com") is True
    assert _is_mock_url("mock://api.corp.com/seo-webhook") is True
    assert _is_mock_url("mock") is True

    # Real bot tokens that contain 'test' or 'mock' in alphanumeric string
    assert _is_mock_bot_token("123456789:ABC_test_xyz987") is False
    assert _is_mock_bot_token("123456789:DEF_mock_corp123") is False

    # Actual mock bot tokens
    assert _is_mock_bot_token("mock_token") is True
    assert _is_mock_bot_token("mock_12345") is True
    assert _is_mock_bot_token("mock") is True

def test_telegram_html_escape_special_characters():
    """Ensures '<', '>', '&' are properly escaped into HTML entities for Telegram."""
    raw_title = "GSC & GA4: CTR < %2.0 ve Pozisyon > 10"
    escaped = _telegram_html_escape(raw_title)
    assert escaped == "GSC &amp; GA4: CTR &lt; %2.0 ve Pozisyon &gt; 10"
    assert "<" not in escaped
    assert ">" not in escaped
    assert "&" in escaped and "&amp;" in escaped

    raw_summary = "Sayfada <title> & <meta> etiketleri eksik. https://site.com?a=1&b=2"
    escaped_summary = _telegram_html_escape(raw_summary)
    assert "&lt;title&gt;" in escaped_summary
    assert "&lt;meta&gt;" in escaped_summary
    assert "a=1&amp;b=2" in escaped_summary

def test_slack_mrkdwn_escape():
    """Ensures Slack mrkdwn escapes &, <, >."""
    raw = "Organik & Doğrudan Trafik: <meta> incelemesi"
    escaped = _slack_mrkdwn_escape(raw)
    assert escaped == "Organik &amp; Doğrudan Trafik: &lt;meta&gt; incelemesi"

@pytest.mark.asyncio
async def test_webhook_dispatches_real_http_to_contest_io():
    """
    Verifies that domains like 'contest.io' and 'latest-corp.com'
    actually trigger an HTTP POST request rather than being intercepted as mock.
    """
    payload = AlertPayload(
        event_type="TEST_EVENT",
        title="Canlı Bildirim",
        summary="Bu gerçek bir webhook çağrısıdır.",
        site_domain="contest.io",
        severity="WARNING"
    )

    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.text = '{"status":"received"}'

    with patch("services.notifications.alert_dispatcher.validate_safe_url"):
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response

            res = await AlertDispatcher.send_custom_webhook(
                "https://contest.io/api/v1/webhook",
                "secret-123",
                payload
            )

            # Assert real HTTP POST was executed!
            assert mock_post.called
            call_url = mock_post.call_args[0][0]
            assert call_url == "https://contest.io/api/v1/webhook"
            assert res["success"] is True
            assert res["channel"] == "WEBHOOK"
            assert "başarıyla iletildi" in res["message"]

@pytest.mark.asyncio
async def test_webhook_dispatches_real_http_to_latest_corp():
    """
    Verifies that 'latest-corp.com' is not dropped.
    """
    payload = AlertPayload(
        event_type="AUDIT_ALERT",
        title="Denetim Bildirimi",
        summary="latest-corp bildirim testi",
        site_domain="latest-corp.com",
        severity="CRITICAL"
    )

    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.text = '{"ok":true}'

    with patch("services.notifications.alert_dispatcher.validate_safe_url"):
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response

            res = await AlertDispatcher.send_custom_webhook(
                "https://api.latest-corp.com/alerts/receiver",
                "secret-456",
                payload
            )

            assert mock_post.called
            assert mock_post.call_args[0][0] == "https://api.latest-corp.com/alerts/receiver"
            assert res["success"] is True

@pytest.mark.asyncio
async def test_telegram_alert_escapes_payload_in_http_call():
    """
    Verifies that send_telegram_alert sends properly escaped HTML payload
    when title and summary contain '<' and '&'.
    """
    payload = AlertPayload(
        event_type="GEO_DROP",
        title="Arama & AI Skoru: Görünürlük < %30",
        summary="Önemli sorgularda <schema> & <faq> eksik!",
        site_domain="acmestore.io",
        severity="CRITICAL"
    )

    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.headers = {"content-type": "application/json"}
    mock_response.json = MagicMock(return_value={"ok": True, "result": {"message_id": 999}})

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_response

        res = await AlertDispatcher.send_telegram_alert(
            "987654321:REAL_BOT_TOKEN_XYZ",
            "12345678",
            payload
        )

        assert mock_post.called
        sent_json = mock_post.call_args[1]["json"]
        sent_text = sent_json["text"]

        # Assert dangerous unescaped characters are NOT sent raw in the text
        assert "Arama &amp; AI Skoru: Görünürlük &lt; %30" in sent_text
        assert "&lt;schema&gt; &amp; &lt;faq&gt;" in sent_text
        assert res["success"] is True
        assert res["channel"] == "TELEGRAM"

@pytest.mark.asyncio
async def test_telegram_alert_fallback_to_plain_text_on_entity_error():
    """
    Verifies that if Telegram API returns 400 Bad Request with 'can't parse entities',
    the dispatcher automatically retries with plain text and delivers the alert.
    """
    payload = AlertPayload(
        event_type="ERROR_EVENT",
        title="Test Title",
        summary="Test Summary",
        site_domain="acmestore.io",
        severity="WARNING"
    )

    # First attempt: Telegram returns 400 entity parse error
    fail_response = MagicMock(spec=httpx.Response)
    fail_response.status_code = 400
    fail_response.headers = {"content-type": "application/json"}
    fail_response.json = MagicMock(return_value={
        "ok": False,
        "error_code": 400,
        "description": "Bad Request: can't parse entities: Unmatched tag"
    })

    # Second attempt (plain text retry): Telegram returns 200 OK
    success_response = MagicMock(spec=httpx.Response)
    success_response.status_code = 200
    success_response.headers = {"content-type": "application/json"}
    success_response.json = MagicMock(return_value={"ok": True, "result": {"message_id": 1001}})

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = [fail_response, success_response]

        res = await AlertDispatcher.send_telegram_alert(
            "987654321:REAL_BOT_TOKEN_XYZ",
            "12345678",
            payload
        )

        # Assert post was called twice: 1st with HTML, 2nd with plain text retry
        assert mock_post.call_count == 2
        retry_json = mock_post.call_args_list[1][1]["json"]
        assert "parse_mode" not in retry_json
        assert res["success"] is True
        assert res["message"] == "Telegram bildirimi iletildi."
