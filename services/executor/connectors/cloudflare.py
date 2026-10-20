import hashlib
import json
import httpx
from typing import Dict, Any, List, Optional
from services.executor.base import SiteConnector
from services.security.ssrf import validate_safe_url
from services.crawler.safe_client import SSRFSafeAsyncHTTPTransport

class CloudflareWorkerConnector(SiteConnector):
    """
    Edge SEO Connector for Cloudflare Workers & Cloudflare KV.
    Enables zero-touch edge-level SEO optimizations:
      - Canonical tag injection and overrides
      - 301 / 302 Edge redirects without origin server hits
      - Dynamic meta tag and title rewriting via HTMLRewriter
      - Automated JSON-LD structured data injection
      - Robots header / meta override
    """

    CF_API_BASE = "https://api.cloudflare.com/client/v4"

    def __init__(
        self,
        zone_id: str,
        api_token: str,
        account_id: Optional[str] = None,
        kv_namespace_id: Optional[str] = None,
        base_url: Optional[str] = None
    ):
        import re
        if zone_id and not re.match(r"^[a-zA-Z0-9_\-]+$", zone_id):
            raise ValueError("Geçersiz Cloudflare zone_id biçimi")
        if account_id and not re.match(r"^[a-zA-Z0-9_\-]+$", account_id):
            raise ValueError("Geçersiz Cloudflare account_id biçimi")
        if kv_namespace_id and not re.match(r"^[a-zA-Z0-9_\-]+$", kv_namespace_id):
            raise ValueError("Geçersiz Cloudflare kv_namespace_id biçimi")

        self.zone_id = zone_id
        self.api_token = api_token
        self.account_id = account_id
        self.kv_namespace_id = kv_namespace_id or "seo_edge_overrides"
        self.base_url = base_url or ""
        self._memory_kv: Dict[str, Any] = {}

    def _safe_async_client(self, timeout: float = 15.0) -> httpx.AsyncClient:
        transport = SSRFSafeAsyncHTTPTransport(verify=True, trust_env=False)
        return httpx.AsyncClient(
            transport=transport,
            timeout=timeout,
            follow_redirects=False,
            trust_env=False
        )

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }

    async def verify_connection(self) -> bool:
        """Verifies API token credentials with Cloudflare."""
        if not self.zone_id or not self.api_token:
            return False

        # Support mock testing
        if self.api_token.startswith("mock") or self.zone_id.startswith("mock") or self.base_url.startswith("mock://"):
            return True

        url = f"{self.CF_API_BASE}/zones/{self.zone_id}"
        try:
            validate_safe_url(url)
            async with self._safe_async_client(timeout=10.0) as client:
                resp = await client.get(url, headers=self._get_headers())
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("success", False) is True
                return False
        except Exception:
            return False

    async def get_capabilities(self) -> List[str]:
        """Returns edge capabilities provided by Cloudflare HTMLRewriter & KV."""
        return [
            "CAN_EDIT_TITLE",
            "CAN_EDIT_META",
            "CAN_EDIT_CANONICAL",
            "CAN_EDIT_SCHEMA",
            "CAN_EDIT_REDIRECT",
            "CAN_OVERRIDE_ROBOTS",
            "CAN_DEPLOY_LLMS_TXT",
            "EDGE_HTML_REWRITE",
            "ZERO_ORIGIN_LATENCY"
        ]

    async def read_page_state(self, url: str) -> Dict[str, Any]:
        """Reads current edge configuration state or live page content hash."""
        # Check memory KV cache first
        rule_key = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
        if rule_key in self._memory_kv:
            existing_rule = self._memory_kv[rule_key]
            return {
                "url": url,
                "current_hash": hashlib.sha256(json.dumps(existing_rule).encode("utf-8")).hexdigest(),
                "edge_active": True,
                "rule": existing_rule,
                "is_valid": True
            }

        if url.startswith("mock://") or self.api_token.startswith("mock"):
            return {
                "url": url,
                "current_hash": "edge-mock-hash-valid",
                "canonical_seo_hash": "edge-mock-hash-valid",
                "edge_active": False,
                "is_valid": True
            }

        validate_safe_url(url)
        async with self._safe_async_client(timeout=15.0) as client:
            resp = await client.get(url)
            content_hash = hashlib.sha256(resp.content).hexdigest()
            canonical_hash = content_hash
            try:
                from services.crawler.html_extractor import HtmlExtractor
                extracted = HtmlExtractor.extract(resp.text, url)
                canonical_hash = extracted.canonical_seo_hash
            except Exception:
                pass
            return {
                "url": url,
                "current_hash": content_hash,
                "canonical_seo_hash": canonical_hash,
                "status_code": resp.status_code,
                "edge_active": False,
                "is_valid": resp.status_code < 500
            }

    async def apply_change(self, change_item: Dict[str, Any]) -> bool:
        """
        Stores an edge transformation rule in Cloudflare KV or dispatches to Worker.
        Supports:
          - Canonical links
          - 301/302 Redirects
          - Meta descriptions / Title tags
          - JSON-LD schemas
          - Static /llms.txt and /llms-full.txt Edge serving
          - Direct Answer HTML block injection
        """
        target_url = change_item.get("target_url") or change_item.get("url") or "/"
        operation = change_item.get("operation") or change_item.get("action_type") or "EDGE_OVERRIDE"
        raw_state_after = change_item.get("state_after") or {}
        if isinstance(raw_state_after, str):
            try:
                state_after = json.loads(raw_state_after)
                if not isinstance(state_after, dict):
                    state_after = {"static_body": str(raw_state_after)}
            except Exception:
                state_after = {"static_body": raw_state_after}
        else:
            state_after = raw_state_after

        rule_key = hashlib.sha256(target_url.encode("utf-8")).hexdigest()[:16]
        edge_payload = {
            "target_url": target_url,
            "operation": operation,
            "canonical": state_after.get("canonical") or change_item.get("canonical"),
            "title": state_after.get("title") or change_item.get("title"),
            "meta_description": state_after.get("meta_description") or change_item.get("meta_description"),
            "schema_json": state_after.get("schema_json") or change_item.get("schema_json"),
            "direct_answer_html": state_after.get("direct_answer_html") or change_item.get("direct_answer_html"),
            "static_body": state_after.get("static_body") or state_after.get("llms_txt_content") or change_item.get("static_body"),
            "content_type": state_after.get("content_type", "text/plain; charset=utf-8"),
            "redirect_to": state_after.get("redirect_to") or change_item.get("redirect_to"),
            "redirect_status": state_after.get("redirect_status", 301),
            "custom_headers": state_after.get("custom_headers", {})
        }

        # Store in local memory state
        self._memory_kv[rule_key] = edge_payload

        # Mock testing mode
        if (
            self.api_token.startswith("mock")
            or self.zone_id.startswith("mock")
            or target_url.startswith("mock://")
        ):
            return True

        # Live Cloudflare KV API dispatch
        if self.account_id and self.kv_namespace_id:
            kv_url = f"{self.CF_API_BASE}/accounts/{self.account_id}/storage/kv/namespaces/{self.kv_namespace_id}/values/{rule_key}"
            try:
                validate_safe_url(kv_url)
                async with self._safe_async_client(timeout=15.0) as client:
                    resp = await client.put(
                        kv_url,
                        headers=self._get_headers(),
                        content=json.dumps(edge_payload)
                    )
                    return resp.status_code in (200, 201)
            except Exception:
                return False

        return True

    async def rollback_change(self, backup_state: Dict[str, Any]) -> bool:
        """
        Rolls back edge modification by deleting or restoring previous KV state.
        """
        target_url = backup_state.get("target_url") or backup_state.get("url") or "/"
        rule_key = hashlib.sha256(target_url.encode("utf-8")).hexdigest()[:16]

        if "state_before" in backup_state and backup_state["state_before"]:
            self._memory_kv[rule_key] = backup_state["state_before"]
            return True
        else:
            self._memory_kv.pop(rule_key, None)

        if (
            self.api_token.startswith("mock")
            or self.zone_id.startswith("mock")
            or target_url.startswith("mock://")
        ):
            return True

        if self.account_id and self.kv_namespace_id:
            kv_url = f"{self.CF_API_BASE}/accounts/{self.account_id}/storage/kv/namespaces/{self.kv_namespace_id}/values/{rule_key}"
            try:
                validate_safe_url(kv_url)
                async with self._safe_async_client(timeout=15.0) as client:
                    resp = await client.delete(kv_url, headers=self._get_headers())
                    return resp.status_code in (200, 204, 404)
            except Exception:
                return False

        return True

    @classmethod
    def generate_edge_worker_script(cls) -> str:
        """
        Generates production-ready Cloudflare Worker script leveraging HTMLRewriter
        to dynamically inject SEO & GEO optimizations (/llms.txt, Direct Answer, JSON-LD) at the edge.
        """
        return """/**
 * Autonomous SEO & GEO Edge Worker (Cloudflare Workers + HTMLRewriter)
 * Intercepts incoming responses and applies zero-latency SEO/GEO rules.
 */

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const pathKey = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(url.href)
  ).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16));

  // Retrieve Edge SEO/GEO rule from KV namespace
  let rule = null;
  if (typeof SEO_EDGE_KV !== 'undefined') {
    const raw = await SEO_EDGE_KV.get(pathKey);
    if (raw) rule = JSON.parse(raw);
  }

  // Handle Static Edge Serving (/llms.txt and /llms-full.txt)
  if (rule && rule.static_body) {
    return new Response(rule.static_body, {
      status: 200,
      headers: {
        'Content-Type': rule.content_type || 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-GEO-Edge': 'Calpeo-LLMS-TXT'
      }
    });
  }

  // Handle Edge Redirect
  if (rule && rule.redirect_to) {
    return Response.redirect(rule.redirect_to, rule.redirect_status || 301);
  }

  // Fetch from origin
  const response = await fetch(request);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') || !rule) {
    return response;
  }

  // Apply HTMLRewriter transformations
  let rewriter = new HTMLRewriter();

  // Title tag injection
  let titleSeen = false;
  if (rule.title) {
    rewriter = rewriter.on('title', {
      element(el) {
        titleSeen = true;
        el.setInnerContent(rule.title);
      }
    });
  }

  // Meta description
  let metaSeen = false;
  if (rule.meta_description) {
    rewriter = rewriter.on('meta[name="description"]', {
      element(el) {
        metaSeen = true;
        el.setAttribute('content', rule.meta_description);
      }
    });
  }

  // Missing <title> / meta description: insert before </head> so "missing tag" fixes take effect
  if (rule.title || rule.meta_description) {
    rewriter = rewriter.on('head', {
      element(el) {
        el.onEndTag(end => {
          if (rule.title && !titleSeen) {
            end.before(`<title>${escapeHtml(rule.title)}</title>`, { html: true });
          }
          if (rule.meta_description && !metaSeen) {
            end.before(`<meta name="description" content="${escapeHtml(rule.meta_description)}">`, { html: true });
          }
        });
      }
    });
  }

  // Canonical tag injection: replace any existing canonical instead of adding a conflicting second one
  if (rule.canonical) {
    rewriter = rewriter.on('link[rel="canonical"]', {
      element(el) {
        el.remove();
      }
    }).on('head', {
      element(el) {
        el.append(`<link rel="canonical" href="${escapeHtml(rule.canonical)}" />`, { html: true });
      }
    });
  }

  // JSON-LD schema injection
  if (rule.schema_json) {
    rewriter = rewriter.on('head', {
      element(el) {
        const schemaStr = typeof rule.schema_json === 'string' ? rule.schema_json : JSON.stringify(rule.schema_json);
        el.append(`<script type="application/ld+json">${schemaStr}</script>`, { html: true });
      }
    });
  }

  // GEO Direct Answer block injection
  if (rule.direct_answer_html) {
    rewriter = rewriter.on('body', {
      element(el) {
        el.prepend(rule.direct_answer_html, { html: true });
      }
    });
  }

  return rewriter.transform(response);
}
"""

