import pytest
from services.integrations.ga4_client import GoogleAnalytics4Client, Ga4TrafficRow
from services.integrations.google_sync_hub import GoogleSyncHub

@pytest.mark.asyncio
async def test_ga4_row_mapping():
    row = Ga4TrafficRow(
        date_str="2026-09-26",
        channel="Organic Search",
        page_path="/blog/seo",
        active_users=120,
        sessions=150,
        page_views=310,
        engagement_rate=0.75,
        bounce_rate=0.25,
        conversions=10.0,
        avg_session_duration_sec=142.5
    )
    d = row.to_dict()
    assert d["active_users"] == 120
    assert d["sessions"] == 150
    assert d["engagement_rate"] == 0.75
    assert d["bounce_rate"] == 0.25
    assert d["conversions"] == 10.0

@pytest.mark.asyncio
async def test_ga4_client_run_report():
    client = GoogleAnalytics4Client(encrypted_access_token="mock_token_123")
    rows = await client.run_report(
        property_id="properties/999888777",
        start_date="2026-09-01",
        end_date="2026-09-26"
    )
    assert len(rows) > 0
    total_sess = sum(r.sessions for r in rows)
    assert total_sess > 0
    assert any(r.channel == "Organic Search" for r in rows)

@pytest.mark.asyncio
async def test_google_sync_hub_synchronize():
    result = await GoogleSyncHub.synchronize_site_telemetry(
        site_domain="example.com",
        gsc_site_url="sc-domain:example.com",
        ga4_property_id="properties/123456789",
        access_token="mock_token"
    )

    assert result["status"] == "HEALTHY"
    assert "last_synced_at" in result
    assert result["gsc"]["connected"] is True
    assert result["gsc"]["total_clicks"] > 0
    assert result["gsc"]["avg_ctr_percent"] >= 0.0

    assert result["ga4"]["connected"] is True
    assert result["ga4"]["total_sessions"] > 0
    assert result["ga4"]["organic_sessions"] > 0
    assert result["ga4"]["conversions"] > 0
    assert result["ga4"]["organic_conversion_rate"] >= 0.0

    assert "correlation" in result
    assert "insights" in result
    assert isinstance(result["insights"], list)
