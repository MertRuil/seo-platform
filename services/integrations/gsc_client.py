import httpx
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from services.security.crypto import decrypt_secret

class GscSearchRow:
    def __init__(self, query: str, page: str, clicks: int, impressions: int, ctr: float, position: float):
        self.query = query
        self.page = page
        self.clicks = clicks
        self.impressions = impressions
        self.ctr = ctr
        self.position = position

class GoogleSearchConsoleClient:
    API_BASE = "https://www.googleapis.com/webmasters/v3"

    def __init__(self, encrypted_access_token: str):
        self.access_token = decrypt_secret(encrypted_access_token)

    async def get_search_analytics(
        self,
        site_url: str,
        start_date: str,
        end_date: str,
        dimensions: List[str] = ["query", "page"],
        row_limit: int = 1000
    ) -> List[GscSearchRow]:
        """Queries Google Search Console Search Analytics API."""
        endpoint = f"{self.API_BASE}/sites/{site_url}/searchAnalytics/query"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "startDate": start_date,
            "endDate": end_date,
            "dimensions": dimensions,
            "rowLimit": row_limit
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            if resp.status_code != 200:
                # Return empty list or raise custom integration error
                return []

            data = resp.json()
            rows = []
            for item in data.get("rows", []):
                keys = item.get("keys", [])
                q = keys[0] if len(keys) > 0 else ""
                p = keys[1] if len(keys) > 1 else ""
                rows.append(GscSearchRow(
                    query=q,
                    page=p,
                    clicks=int(item.get("clicks", 0)),
                    impressions=int(item.get("impressions", 0)),
                    ctr=float(item.get("ctr", 0.0)),
                    position=float(item.get("position", 0.0))
                ))
            return rows
