import time
import httpx
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin
from services.security.ssrf import validate_safe_url, SSRFSecurityException

GOOGLEBOT_USER_AGENT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
OWNER_AUDIT_USER_AGENT = "AutonomousAI-SEO-Auditor/1.0 (+https://platform.example.com/bot)"

class RedirectHop:
    def __init__(self, from_url: str, to_url: str, status_code: int):
        self.from_url = from_url
        self.to_url = to_url
        self.status_code = status_code

class FetchResponse:
    def __init__(self, requested_url: str, final_url: str, status_code: int, headers: Dict[str, str], text: str, response_time_ms: int, redirect_chain: List[RedirectHop]):
        self.requested_url = requested_url
        self.final_url = final_url
        self.status_code = status_code
        self.headers = headers
        self.text = text
        self.response_time_ms = response_time_ms
        self.redirect_chain = redirect_chain
        self.is_redirect_chain = len(redirect_chain) > 1
        self.is_redirect_loop = False

class SafeHttpClient:
    MAX_REDIRECTS = 5
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB

    def __init__(self, mode: str = "GOOGLEBOT_SIMULATION", timeout_seconds: float = 15.0):
        self.mode = mode
        self.timeout = timeout_seconds
        self.user_agent = GOOGLEBOT_USER_AGENT if mode == "GOOGLEBOT_SIMULATION" else OWNER_AUDIT_USER_AGENT

    async def fetch(self, url: str) -> FetchResponse:
        redirect_chain: List[RedirectHop] = []
        visited_in_chain = set([url])
        current_url = url
        start_time = time.monotonic()

        limits = httpx.Limits(max_connections=20, max_keepalive_connections=10)
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=False, trust_env=False, limits=limits) as client:
            hops = 0
            while hops <= self.MAX_REDIRECTS:
                # Validate SSRF on current hop URL
                validate_safe_url(current_url)

                headers = {
                    "User-Agent": self.user_agent,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
                }

                req_start = time.monotonic()
                try:
                    request = client.build_request("GET", current_url, headers=headers)
                    response = await client.send(request, stream=True)
                except httpx.RequestError as e:
                    raise IOError(f"Network error while fetching '{current_url}': {str(e)}")

                response_time_ms = int((time.monotonic() - req_start) * 1000)

                # Check if response is redirect (301, 302, 303, 307, 308)
                if response.status_code in (301, 302, 303, 307, 308):
                    location = response.headers.get("Location")
                    if not location:
                        # 3xx without Location header
                        await response.aclose()
                        break

                    next_url = urljoin(current_url, location)
                    await response.aclose()
                    hop = RedirectHop(current_url, next_url, response.status_code)
                    redirect_chain.append(hop)

                    if next_url in visited_in_chain:
                        # Circular redirect loop detected
                        resp = FetchResponse(
                            requested_url=url,
                            final_url=next_url,
                            status_code=response.status_code,
                            headers=dict(response.headers),
                            text="",
                            response_time_ms=response_time_ms,
                            redirect_chain=redirect_chain
                        )
                        resp.is_redirect_loop = True
                        return resp

                    visited_in_chain.add(next_url)
                    current_url = next_url
                    hops += 1
                    continue

                # Final response reached
                try:
                    content_len = int(response.headers.get("Content-Length", 0))
                except (TypeError, ValueError):
                    content_len = 0
                if content_len > self.MAX_CONTENT_LENGTH:
                    raise IOError(f"Payload exceeded max size of {self.MAX_CONTENT_LENGTH} bytes")

                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    if len(body) > self.MAX_CONTENT_LENGTH:
                        await response.aclose()
                        raise IOError("Uncompressed body exceeded maximum permitted size")
                encoding = response.encoding or "utf-8"
                body_text = bytes(body).decode(encoding, errors="replace")
                await response.aclose()

                total_time_ms = int((time.monotonic() - start_time) * 1000)
                return FetchResponse(
                    requested_url=url,
                    final_url=current_url,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    text=body_text,
                    response_time_ms=total_time_ms,
                    redirect_chain=redirect_chain
                )

            # Max redirects exceeded
            resp = FetchResponse(
                requested_url=url,
                final_url=current_url,
                status_code=310,  # Too many redirects
                headers={},
                text="",
                response_time_ms=int((time.monotonic() - start_time) * 1000),
                redirect_chain=redirect_chain
            )
            resp.is_redirect_chain = True
            return resp
