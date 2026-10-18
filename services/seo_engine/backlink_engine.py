"""
Backlink Analysis, Live Provider Sync (DataForSEO / OpenPageRank / GSC Export / Live HTML Crawl),
Toxic Link Detection, and Google Disavow Generator Engine.
"""

from __future__ import annotations

import base64
import csv
import hashlib
import io
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse

logger = logging.getLogger("services.seo_engine.backlinks")


class AnchorCategory(str, Enum):
    BRAND = "BRAND"
    EXACT_MATCH = "EXACT_MATCH"
    PARTIAL_MATCH = "PARTIAL_MATCH"
    GENERIC = "GENERIC"
    NAKED_URL = "NAKED_URL"
    SPAM = "SPAM"


class ToxicityRisk(str, Enum):
    CLEAN = "CLEAN"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class BacklinkDataSource(str, Enum):
    DATAFORSEO_LIVE = "DATAFORSEO_LIVE"
    LIVE_CRAWL_VERIFIED = "LIVE_CRAWL_VERIFIED"
    GSC_LINKS_IMPORT = "GSC_LINKS_IMPORT"
    OPENPAGERANK_ENRICHED = "OPENPAGERANK_ENRICHED"
    MANUAL_ENTRY = "MANUAL_ENTRY"
    DEMO_SEED = "DEMO_SEED"


# Known suspicious or high-spam TLDs commonly used by PBNs and automated link farms
SUSPICIOUS_TLDS = {
    ".xyz", ".top", ".click", ".win", ".fit", ".kim", ".loan", ".buzz",
    ".surf", ".work", ".gq", ".cf", ".ml", ".ga", ".tk", ".link", ".party",
    ".icu", ".monster", ".cfd", ".sbs", ".cam", ".beauty", ".hair", ".skin",
    ".quest", ".rest", ".boats", ".cyou", ".pw", ".cc", ".press"
}

# Spam trigger words in anchor texts or domain names (English & Turkish)
SPAM_TRIGGER_PATTERNS = [
    # Gambling & Betting
    "casino", "gambling", "poker", "betting", "sportsbook", "blackjack",
    "slots", "roulette", "baccarat", "bet365", "bahis", "canlı bahis",
    "kaçak bahis", "kumar", "bet", "slot", "rulet", "deneme bonusu",
    "canlı casino", "iddaa", "güvenilir bahis",
    # Pharma & Illicit Drugs
    "viagra", "cialis", "levitra", "kamagra", "pharmacy", "payday loans",
    "cheap pills", "weight loss pill",
    # Adult & Dating
    "adult", "dating hookup", "escort", "porn", "porno", "sex", "xxx",
    "cam girls", "onlyfans",
    # Counterfeits & Scams
    "replica watches", "cheap essay", "buy followers", "free followers",
    "crypto yield", "free bitcoin", "free crypto", "crypto doubler", "airdrop claim",
    # Blackhat SEO & Link Farms
    "buy backlinks", "cheap backlinks", "pbn links", "seo link farm",
    "guest post service",
    # Warez & Piracy
    "hack tool", "warez", "torrent download", "crack", "keygen", "serial key"
]

ANCHOR_TAG_RE = re.compile(
    r"<a\b([^>]*?)href=[\"\']([^\"\']+)[\"\']([^>]*?)>(.*?)</a>",
    re.IGNORECASE | re.DOTALL,
)
REL_ATTR_RE = re.compile(r"\brel=[\"\']([^\"\']+)[\"\']", re.IGNORECASE)
HTML_TAG_STRIP_RE = re.compile(r"<[^>]+>")


@dataclass
class BacklinkItem:
    id: str
    source_url: str
    source_domain: str
    target_url: str
    anchor_text: str
    anchor_category: AnchorCategory
    is_dofollow: bool
    domain_authority: int  # 1-100 (DR / DA)
    page_authority: int    # 1-100 (UR / PA)
    spam_score: int        # 0-100 (Spam score percentage)
    is_toxic: bool
    toxicity_risk: ToxicityRisk
    toxicity_reasons: List[str] = field(default_factory=list)
    first_seen: str = field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    status: str = "ACTIVE"  # "ACTIVE" | "LOST"
    data_source: str = "DEMO_SEED"
    verified_live: bool = False
    http_status: Optional[int] = None
    rel_attributes: List[str] = field(default_factory=list)


@dataclass
class BacklinkSummary:
    total_backlinks: int
    referring_domains: int
    dofollow_count: int
    nofollow_count: int
    dofollow_ratio: float
    avg_domain_authority: float
    toxic_backlinks_count: int
    toxic_domains_count: int
    toxicity_percentage: float
    overall_toxicity_risk: ToxicityRisk
    anchor_distribution: Dict[str, int]
    top_toxic_domains: List[str] = field(default_factory=list)
    data_source: str = "DEMO_SEED"
    live_verified_count: int = 0
    providers_configured: List[str] = field(default_factory=list)


def classify_anchor_text(anchor: str, brand_name: str, target_url: str) -> AnchorCategory:
    """Classifies an anchor text into standard SEO anchor categories."""
    if not anchor or not anchor.strip():
        return AnchorCategory.GENERIC

    clean_anchor = anchor.strip().lower()
    clean_brand = brand_name.strip().lower() if brand_name else ""

    # 1. Spam trigger check in anchor text
    for trigger in SPAM_TRIGGER_PATTERNS:
        if trigger in clean_anchor:
            return AnchorCategory.SPAM

    # 2. Naked URL check
    if clean_anchor.startswith("http://") or clean_anchor.startswith("https://") or clean_anchor.startswith("www."):
        return AnchorCategory.NAKED_URL
    if "/" in clean_anchor and "." in clean_anchor:
        return AnchorCategory.NAKED_URL

    # 3. Generic anchors
    generic_words = {
        "click here", "here", "website", "tıklayın", "buraya tıklayın",
        "web sitesi", "link", "read more", "source", "kaynak", "incele", "detaylar"
    }
    if clean_anchor in generic_words:
        return AnchorCategory.GENERIC

    # 4. Brand check
    if clean_brand and clean_brand in clean_anchor:
        if clean_anchor == clean_brand:
            return AnchorCategory.BRAND
        return AnchorCategory.PARTIAL_MATCH

    return AnchorCategory.EXACT_MATCH


def evaluate_backlink_toxicity(
    source_url: str,
    anchor_text: str,
    source_da: int,
    source_spam_score: int
) -> Tuple[bool, ToxicityRisk, int, List[str]]:
    """
    Evaluates backlink toxicity based on Google Webmaster Guidelines & Spam Policies.
    Returns (is_toxic, risk_level, computed_spam_score, reasons).
    """
    reasons: List[str] = []
    parsed = urlparse(source_url)
    raw_host = (parsed.netloc or "").lower()
    domain = raw_host.split(":")[0]

    # 1. Raw IP address or non-standard port check (classic botnet/PBN signature)
    is_ip = bool(re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", domain))
    if is_ip:
        reasons.append("Ham IP adresi üzerinden şüpheli botnet/scraper bağlantısı")
    elif ":" in raw_host:
        port = raw_host.split(":")[1]
        if port not in ("80", "443"):
            reasons.append(f"Standart dışı port üzerinden şüpheli bağlantı (:{port})")

    # 2. Suspicious TLD check
    is_suspicious_tld = False
    for tld in SUSPICIOUS_TLDS:
        if domain.endswith(tld):
            reasons.append(f"Yüksek riskli/şüpheli spam uzantısı ({tld})")
            is_suspicious_tld = True
            break

    # 3. Spam keyword check in anchor and domain
    lower_anchor = (anchor_text or "").lower()
    has_spam_keyword = False
    for trigger in SPAM_TRIGGER_PATTERNS:
        if trigger in lower_anchor:
            reasons.append(f"Yasaklı/Spam anahtar kelime içeren bağlantı metni ('{trigger}')")
            has_spam_keyword = True
            break
        if trigger in domain:
            reasons.append(f"Şüpheli spam sektörüne ait alan adı ('{trigger}')")
            has_spam_keyword = True
            break

    # 4. High external spam score signals
    has_critical_spam_score = False
    if source_spam_score >= 60:
        reasons.append(f"Kritik alan adı spam skoru (%{source_spam_score})")
        has_critical_spam_score = True
    elif source_spam_score >= 35:
        reasons.append(f"Yüksek spam sinyali (%{source_spam_score})")

    # 5. Low authority combined with high spam or suspicious TLD
    has_pbn_signature = False
    if source_da < 10 and source_spam_score > 30:
        reasons.append("Çok düşük domain otoritesi (DR < 10) ve şüpheli link profili")
        has_pbn_signature = True
    elif source_da < 10 and is_suspicious_tld:
        reasons.append("Çok düşük domain otoritesi (DR < 10) ve şüpheli alan adı uzantısı")
        has_pbn_signature = True

    score = source_spam_score

    is_severe_single = (
        has_spam_keyword
        or has_critical_spam_score
        or is_ip
        or has_pbn_signature
        or (is_suspicious_tld and (source_da < 30 or source_spam_score >= 20))
    )

    if len(reasons) >= 3:
        score = max(score, 85)
        risk = ToxicityRisk.CRITICAL
        is_toxic = True
    elif len(reasons) == 2:
        score = max(score, 65)
        risk = ToxicityRisk.HIGH
        is_toxic = True
    elif is_severe_single:
        score = max(score, 70 if (has_spam_keyword or has_critical_spam_score) else 55)
        risk = ToxicityRisk.HIGH
        is_toxic = True
    elif len(reasons) == 1:
        score = max(score, 40)
        risk = ToxicityRisk.MEDIUM
        is_toxic = False
    elif score > 20:
        risk = ToxicityRisk.LOW
        is_toxic = False
    else:
        risk = ToxicityRisk.CLEAN
        is_toxic = False

    return is_toxic, risk, score, reasons


def get_configured_backlink_providers() -> List[str]:
    """Returns a list of live backlink/authority providers currently configured in settings."""
    providers = ["LIVE_HTML_VERIFIER", "GSC_CSV_IMPORTER"]
    try:
        from packages.config.settings import settings
        if getattr(settings, "DATAFORSEO_LOGIN", None) and getattr(settings, "DATAFORSEO_PASSWORD", None):
            providers.insert(0, "DATAFORSEO_LIVE")
        if getattr(settings, "OPENPAGERANK_API_KEY", None):
            providers.insert(0, "OPENPAGERANK_API")
    except Exception:
        pass
    return providers


def analyze_backlinks(backlinks: List[BacklinkItem]) -> BacklinkSummary:
    """Generates an aggregate summary of a website's backlink profile, including data provenance."""
    configured = get_configured_backlink_providers()
    if not backlinks:
        return BacklinkSummary(
            total_backlinks=0,
            referring_domains=0,
            dofollow_count=0,
            nofollow_count=0,
            dofollow_ratio=0.0,
            avg_domain_authority=0.0,
            toxic_backlinks_count=0,
            toxic_domains_count=0,
            toxicity_percentage=0.0,
            overall_toxicity_risk=ToxicityRisk.CLEAN,
            anchor_distribution={},
            top_toxic_domains=[],
            data_source="EMPTY",
            live_verified_count=0,
            providers_configured=configured,
        )

    domains = set()
    toxic_domains = set()
    dofollow_count = 0
    nofollow_count = 0
    total_da = 0
    toxic_count = 0
    live_verified_count = 0
    sources_seen = set()

    anchor_dist: Dict[str, int] = {
        AnchorCategory.BRAND.value: 0,
        AnchorCategory.EXACT_MATCH.value: 0,
        AnchorCategory.PARTIAL_MATCH.value: 0,
        AnchorCategory.GENERIC.value: 0,
        AnchorCategory.NAKED_URL.value: 0,
        AnchorCategory.SPAM.value: 0,
    }

    for b in backlinks:
        domains.add(b.source_domain)
        total_da += b.domain_authority
        sources_seen.add(getattr(b, "data_source", "DEMO_SEED"))

        if getattr(b, "verified_live", False) or getattr(b, "data_source", "") in (
            "DATAFORSEO_LIVE",
            "LIVE_CRAWL_VERIFIED",
            "GSC_LINKS_IMPORT",
        ):
            live_verified_count += 1

        if b.is_dofollow:
            dofollow_count += 1
        else:
            nofollow_count += 1

        if b.is_toxic:
            toxic_count += 1
            toxic_domains.add(b.source_domain)

        cat = b.anchor_category.value if isinstance(b.anchor_category, AnchorCategory) else str(b.anchor_category)
        anchor_dist[cat] = anchor_dist.get(cat, 0) + 1

    total = len(backlinks)
    dofollow_ratio = round((dofollow_count / total) * 100, 1) if total > 0 else 0.0
    avg_da = round(total_da / total, 1) if total > 0 else 0.0
    toxicity_pct = round((toxic_count / total) * 100, 1) if total > 0 else 0.0

    if toxicity_pct >= 25 or len(toxic_domains) >= 10:
        overall_risk = ToxicityRisk.CRITICAL
    elif toxicity_pct >= 12 or len(toxic_domains) >= 5:
        overall_risk = ToxicityRisk.HIGH
    elif toxicity_pct > 3:
        overall_risk = ToxicityRisk.MEDIUM
    else:
        overall_risk = ToxicityRisk.LOW if toxic_count > 0 else ToxicityRisk.CLEAN

    if "DATAFORSEO_LIVE" in sources_seen:
        primary_source = "DATAFORSEO_LIVE"
    elif "LIVE_CRAWL_VERIFIED" in sources_seen:
        primary_source = "LIVE_CRAWL_VERIFIED"
    elif "GSC_LINKS_IMPORT" in sources_seen:
        primary_source = "GSC_LINKS_IMPORT"
    elif "MANUAL_ENTRY" in sources_seen and "DEMO_SEED" not in sources_seen:
        primary_source = "MANUAL_ENTRY"
    elif len(sources_seen) > 1:
        primary_source = "HYBRID"
    else:
        primary_source = next(iter(sources_seen), "DEMO_SEED")

    return BacklinkSummary(
        total_backlinks=total,
        referring_domains=len(domains),
        dofollow_count=dofollow_count,
        nofollow_count=nofollow_count,
        dofollow_ratio=dofollow_ratio,
        avg_domain_authority=avg_da,
        toxic_backlinks_count=toxic_count,
        toxic_domains_count=len(toxic_domains),
        toxicity_percentage=toxicity_pct,
        overall_toxicity_risk=overall_risk,
        anchor_distribution=anchor_dist,
        top_toxic_domains=sorted(list(toxic_domains))[:10],
        data_source=primary_source,
        live_verified_count=live_verified_count,
        providers_configured=configured,
    )


def generate_google_disavow_file(
    backlinks: List[BacklinkItem],
    mode: str = "domain",
    target_domain: Optional[str] = None
) -> str:
    """
    Generates standard Google Search Console Disavow Links file format (.txt).
    Strictly prevents cross-site leakage by filtering backlinks targeting 'target_domain'.
    """
    clean_target = (
        target_domain.strip().lower().replace("https://", "").replace("http://", "").split("/")[0]
        if target_domain
        else None
    )

    toxic_links = [
        b for b in backlinks
        if (b.is_toxic or b.toxicity_risk in (ToxicityRisk.HIGH, ToxicityRisk.CRITICAL))
        and (clean_target is None or clean_target in b.target_url.lower())
    ]

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    lines = [
        "# -------------------------------------------------------------",
        "# Google Disavow Links File",
        f"# Generated autonomously by SEO Platform on {now_str}",
        f"# Target Site: {clean_target or 'All Sites'}",
        f"# Total Toxic Items Identified: {len(toxic_links)}",
        "# Format: domain:example.com or specific URL",
        "# -------------------------------------------------------------",
        ""
    ]

    if not toxic_links:
        lines.append("# [BILGI] Bu site icin disavow edilecek toksik/zararli baglanti bulunmuyor.")
        lines.append("# Sitenize baglanti vermemis alan adlarini disavow dosyasina eklemeyiniz.")
        lines.append("")
        lines.append("# End of Google Disavow File")
        return "\n".join(lines)

    disavowed_domains = set()
    disavowed_urls = set()

    for item in toxic_links:
        if mode == "domain" or item.toxicity_risk == ToxicityRisk.CRITICAL:
            if item.source_domain not in disavowed_domains:
                lines.append(f"# Reason: {', '.join(item.toxicity_reasons) if item.toxicity_reasons else 'Spam profile'}")
                lines.append(f"domain:{item.source_domain}")
                disavowed_domains.add(item.source_domain)
        else:
            if item.source_url not in disavowed_urls:
                lines.append(f"# Anchor: '{item.anchor_text}' | Score: {item.spam_score}")
                lines.append(item.source_url)
                disavowed_urls.add(item.source_url)

    lines.append("")
    lines.append("# End of Google Disavow File")
    return "\n".join(lines)


class BacklinkDataProvider:
    """
    Multi-Source Real Backlink & Authority Provider Adapter:
      1. Live HTML Backlink Verifier (verifies whether source_url links to target_domain, extracts real anchor & rel)
      2. OpenPageRank API Enricher (fetches real 0-100 Domain Authority scores)
      3. DataForSEO Backlinks Live API Adapter (fetches live referring pages & anchors)
      4. Google Search Console External Links CSV/Text Importer
    """

    @staticmethod
    def clean_domain(domain_or_url: str) -> str:
        raw = (domain_or_url or "").strip().lower()
        if "://" in raw:
            host = urlparse(raw).hostname or raw
        else:
            host = raw.split("/")[0]
        return host.removeprefix("www.")

    @classmethod
    def extract_links_from_html(
        cls,
        html: str,
        source_url: str,
        target_domain: str,
    ) -> List[Dict[str, Any]]:
        """
        Parses HTML from `source_url` and extracts all `<a>` links pointing to `target_domain`.
        Returns list of dicts with `target_url`, `anchor_text`, `is_dofollow`, and `rel_attributes`.
        """
        clean_target = cls.clean_domain(target_domain)
        matches: List[Dict[str, Any]] = []
        if not html or not clean_target:
            return matches

        for pre_attrs, href, post_attrs, inner_html in ANCHOR_TAG_RE.findall(html):
            resolved_href = urljoin(source_url, href.strip())
            parsed_href = urlparse(resolved_href)
            href_host = (parsed_href.hostname or "").lower().removeprefix("www.")
            if href_host != clean_target and not href_host.endswith(f".{clean_target}"):
                continue

            combined_attrs = f"{pre_attrs} {post_attrs}"
            rel_match = REL_ATTR_RE.search(combined_attrs)
            rel_tokens: List[str] = []
            if rel_match:
                rel_tokens = [t.strip().lower() for t in rel_match.group(1).split() if t.strip()]

            is_dofollow = not any(r in ("nofollow", "sponsored", "ugc") for r in rel_tokens)
            clean_anchor = HTML_TAG_STRIP_RE.sub("", inner_html or "").strip()
            clean_anchor = re.sub(r"\s+", " ", clean_anchor) or clean_target

            matches.append({
                "target_url": resolved_href,
                "anchor_text": clean_anchor[:200],
                "is_dofollow": is_dofollow,
                "rel_attributes": rel_tokens,
            })

        return matches

    @classmethod
    async def verify_backlink_live_on_page(
        cls,
        source_url: str,
        target_domain: str,
    ) -> Dict[str, Any]:
        """
        Fetches `source_url` using SSRF-safe `SafeHttpClient` and verifies whether
        it contains an active link to `target_domain`.
        """
        if not source_url or source_url.startswith("mock://"):
            return {
                "verified_live": True,
                "http_status": 200,
                "found_link": True,
                "anchor_text": None,
                "is_dofollow": True,
                "rel_attributes": [],
            }

        try:
            from services.crawler.safe_client import SafeHttpClient
            from services.security.ssrf import validate_safe_url

            validate_safe_url(source_url)
            client = SafeHttpClient(mode="OWNER_AUDIT", timeout_seconds=8.0)
            resp = await client.fetch(source_url)
            if resp.status_code >= 400 or not resp.text:
                return {
                    "verified_live": False,
                    "http_status": resp.status_code,
                    "found_link": False,
                }

            found = cls.extract_links_from_html(resp.text, source_url, target_domain)
            if found:
                first = found[0]
                return {
                    "verified_live": True,
                    "http_status": resp.status_code,
                    "found_link": True,
                    "target_url": first["target_url"],
                    "anchor_text": first["anchor_text"],
                    "is_dofollow": first["is_dofollow"],
                    "rel_attributes": first["rel_attributes"],
                }
            return {
                "verified_live": False,
                "http_status": resp.status_code,
                "found_link": False,
            }
        except Exception as exc:
            logger.debug(f"Live backlink verification skipped for {source_url}: {exc}")
            return {
                "verified_live": False,
                "http_status": None,
                "found_link": False,
            }

    @classmethod
    async def fetch_openpagerank_scores(cls, domains: List[str]) -> Dict[str, int]:
        """
        Queries OpenPageRank API (if OPENPAGERANK_API_KEY is configured) to get real 1-100 DA scores.
        """
        from packages.config.settings import settings
        api_key = getattr(settings, "OPENPAGERANK_API_KEY", None)
        if not api_key or not domains:
            return {}

        clean_list = list({cls.clean_domain(d) for d in domains if d})[:40]
        if not clean_list:
            return {}

        try:
            import httpx
            params = [(f"domains[{idx}]", dom) for idx, dom in enumerate(clean_list)]
            async with httpx.AsyncClient(timeout=12.0) as client:
                resp = await client.get(
                    "https://openpagerank.com/api/v1.0/getPageRank",
                    params=params,
                    headers={"API-OPR": api_key},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    scores: Dict[str, int] = {}
                    for item in data.get("response", []):
                        dom = item.get("domain")
                        pr = item.get("page_rank_decimal")
                        if dom and pr is not None:
                            scores[dom] = max(1, min(100, int(round(float(pr) * 10))))
                    return scores
        except Exception as exc:
            logger.debug(f"OpenPageRank query failed: {exc}")
        return {}

    @classmethod
    async def fetch_from_dataforseo(
        cls,
        target_domain: str,
        brand_name: str,
        limit: int = 25,
    ) -> List[BacklinkItem]:
        """
        Queries DataForSEO Backlinks API when DATAFORSEO_LOGIN & DATAFORSEO_PASSWORD are set.
        """
        from packages.config.settings import settings
        login = getattr(settings, "DATAFORSEO_LOGIN", None)
        password = getattr(settings, "DATAFORSEO_PASSWORD", None)
        if not login or not password:
            return []

        clean_target = cls.clean_domain(target_domain)
        token = base64.b64encode(f"{login}:{password}".encode("utf-8")).decode("utf-8")
        try:
            import httpx
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    "https://api.dataforseo.com/v3/backlinks/backlinks/live",
                    headers={
                        "Authorization": f"Basic {token}",
                        "Content-Type": "application/json",
                    },
                    json=[
                        {
                            "target": clean_target,
                            "mode": "as_is",
                            "limit": limit,
                            "backlinks_status_type": "live",
                        }
                    ],
                )
                if resp.status_code != 200:
                    return []
                payload = resp.json()
                tasks = payload.get("tasks") or []
                if not tasks or not tasks[0].get("result"):
                    return []
                raw_items = tasks[0]["result"][0].get("items") or []
                results: List[BacklinkItem] = []

                for idx, raw in enumerate(raw_items):
                    src_url = str(raw.get("url_from") or "")
                    src_dom = cls.clean_domain(str(raw.get("domain_from") or src_url))
                    tgt_url = str(raw.get("url_to") or f"https://{clean_target}")
                    anchor = str(raw.get("anchor") or src_dom)
                    dofollow = bool(raw.get("dofollow", True))
                    # DataForSEO rank is 0-1000; normalize to 1-100
                    raw_rank = int(raw.get("domain_from_rank") or raw.get("rank") or 300)
                    da = max(1, min(100, int(round(raw_rank / 10)) if raw_rank > 100 else raw_rank))
                    pa = max(1, min(100, int(round((raw.get("page_from_rank") or raw_rank) / 10))))
                    ext_spam = int(raw.get("backlink_spam_score") or 0)

                    is_tox, risk, comp_spam, reasons = evaluate_backlink_toxicity(
                        source_url=src_url,
                        anchor_text=anchor,
                        source_da=da,
                        source_spam_score=ext_spam,
                    )
                    cat = classify_anchor_text(anchor, brand_name, tgt_url)
                    first_seen = str(raw.get("first_seen") or "")[:10] or datetime.now(timezone.utc).strftime("%Y-%m-%d")

                    results.append(
                        BacklinkItem(
                            id=f"bl-dfs-{idx + 1}",
                            source_url=src_url,
                            source_domain=src_dom,
                            target_url=tgt_url,
                            anchor_text=anchor,
                            anchor_category=cat,
                            is_dofollow=dofollow,
                            domain_authority=da,
                            page_authority=pa,
                            spam_score=comp_spam,
                            is_toxic=is_tox,
                            toxicity_risk=risk,
                            toxicity_reasons=reasons,
                            first_seen=first_seen,
                            status="ACTIVE",
                            data_source=BacklinkDataSource.DATAFORSEO_LIVE.value,
                            verified_live=True,
                            http_status=200,
                            rel_attributes=[] if dofollow else ["nofollow"],
                        )
                    )
                return results
        except Exception as exc:
            logger.warning(f"DataForSEO live backlinks error: {exc}")
            return []

    @classmethod
    def parse_gsc_links_export(
        cls,
        raw_text_or_lines: str | List[str],
        target_domain: str,
        brand_name: str,
    ) -> List[BacklinkItem]:
        """
        Parses Google Search Console 'External Links' CSV export or newline-separated URL/domain list
        into structured, toxicity-scored BacklinkItem records with data_source='GSC_LINKS_IMPORT'.
        """
        clean_target = cls.clean_domain(target_domain)
        base_target_url = f"https://{clean_target}"

        if isinstance(raw_text_or_lines, list):
            text = "\n".join(str(x) for x in raw_text_or_lines)
        else:
            text = str(raw_text_or_lines or "")

        items: List[BacklinkItem] = []
        seen_sources: set[str] = set()

        reader = csv.reader(io.StringIO(text.strip()))
        for idx, row in enumerate(reader):
            if not row:
                continue
            first_col = row[0].strip()
            if not first_col or first_col.lower() in (
                "source_url", "source", "linking site", "top linking sites", "url", "domain", "kaynak"
            ):
                continue

            if first_col.startswith(("http://", "https://")):
                src_url = first_col
                src_dom = cls.clean_domain(src_url)
            else:
                src_dom = cls.clean_domain(first_col)
                if "." not in src_dom:
                    continue
                src_url = f"https://{src_dom}/"

            if src_url in seen_sources:
                continue
            seen_sources.add(src_url)

            anchor = row[1].strip() if len(row) > 1 and row[1].strip() else brand_name or clean_target
            tgt_url = row[2].strip() if len(row) > 2 and row[2].strip().startswith("http") else base_target_url

            # Baseline authority before optional OpenPageRank enrichment
            is_suspicious_tld = any(src_dom.endswith(t) for t in SUSPICIOUS_TLDS)
            baseline_da = 8 if is_suspicious_tld else 48
            baseline_spam = 65 if is_suspicious_tld else 4

            is_tox, risk, comp_spam, reasons = evaluate_backlink_toxicity(
                source_url=src_url,
                anchor_text=anchor,
                source_da=baseline_da,
                source_spam_score=baseline_spam,
            )
            cat = classify_anchor_text(anchor, brand_name, tgt_url)

            items.append(
                BacklinkItem(
                    id=f"bl-gsc-{hashlib.md5(src_url.encode()).hexdigest()[:8]}",
                    source_url=src_url,
                    source_domain=src_dom,
                    target_url=tgt_url,
                    anchor_text=anchor,
                    anchor_category=cat,
                    is_dofollow=True,
                    domain_authority=baseline_da,
                    page_authority=max(1, baseline_da - 10),
                    spam_score=comp_spam,
                    is_toxic=is_tox,
                    toxicity_risk=risk,
                    toxicity_reasons=reasons,
                    first_seen=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    status="ACTIVE",
                    data_source=BacklinkDataSource.GSC_LINKS_IMPORT.value,
                    verified_live=False,
                )
            )

        return items
