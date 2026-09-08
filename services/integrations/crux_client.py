import httpx
from typing import Dict, Any, Optional
from packages.config.settings import settings

class CruxRecord:
    def __init__(self, url: str, form_factor: str, p75_lcp_ms: Optional[int], p75_inp_ms: Optional[int], p75_cls: Optional[float], has_data: bool):
        self.url = url
        self.form_factor = form_factor
        self.p75_lcp_ms = p75_lcp_ms
        self.p75_inp_ms = p75_inp_ms
        self.p75_cls = p75_cls
        self.has_data = has_data

class ChromeUxReportClient:
    API_URL = "https://chromeuxreport.googleapis.com/v1/records:queryRecord"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.CRUX_API_KEY

    async def get_field_metrics(self, url: str, form_factor: str = "PHONE") -> CruxRecord:
        if not self.api_key:
            return CruxRecord(url, form_factor, None, None, None, False)

        params = {"key": self.api_key}
        payload = {
            "url": url,
            "formFactor": form_factor,
            "metrics": ["largest_contentful_paint", "interaction_to_next_paint", "cumulative_layout_shift"]
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                resp = await client.post(self.API_URL, params=params, json=payload)
                if resp.status_code != 200:
                    return CruxRecord(url, form_factor, None, None, None, False)

                data = resp.json().get("record", {}).get("metrics", {})

                # Extract p75 values
                lcp = data.get("largest_contentful_paint", {}).get("percentiles", {}).get("p75")
                inp = data.get("interaction_to_next_paint", {}).get("percentiles", {}).get("p75")
                cls = data.get("cumulative_layout_shift", {}).get("percentiles", {}).get("p75")

                return CruxRecord(
                    url=url,
                    form_factor=form_factor,
                    p75_lcp_ms=int(lcp) if lcp is not None else None,
                    p75_inp_ms=int(inp) if inp is not None else None,
                    p75_cls=float(cls) if cls is not None else None,
                    has_data=True
                )
            except Exception:
                return CruxRecord(url, form_factor, None, None, None, False)
