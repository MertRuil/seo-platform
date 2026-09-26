"""
Backlink Analysis, Toxic Link Detection, and Google Disavow Generator Engine.
Provides comprehensive link profile auditing, toxicity scoring based on Google Spam Policies,
and automatic Google Disavow tool (.txt) file generation.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional, Tuple
from urllib.parse import urlparse
from datetime import datetime, timezone


class AnchorCategory(str, Enum):
    BRAND = "BRAND"
    EXACT_MATCH = "EXACT_MATCH"
    PARTIAL_MATCH = "PARTIAL_MATCH"
    GENERIC = "GENERIC"
    NAKED_URL = "NAKED_URL"


class ToxicityRisk(str, Enum):
    CLEAN = "CLEAN"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


# Known suspicious or high-spam TLDs commonly used by PBNs and automated link farms
SUSPICIOUS_TLDS = {
    ".xyz", ".top", ".click", ".win", ".fit", ".kim", ".loan", ".buzz",
    ".surf", ".work", ".gq", ".cf", ".ml", ".ga", ".tk", ".link", ".party"
}

# Spam trigger words in anchor texts or domain names
SPAM_TRIGGER_PATTERNS = [
    "casino", "gambling", "poker", "viagra", "cialis", "payday loans",
    "crypto yield", "free bitcoin", "replica watches", "adult", "dating hookup",
    "cheap essay", "buy followers", "hack tool", "warez", "torrent download"
]


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


def classify_anchor_text(anchor: str, brand_name: str, target_url: str) -> AnchorCategory:
    """Classifies an anchor text into standard SEO anchor categories."""
    if not anchor or not anchor.strip():
        return AnchorCategory.GENERIC
    
    clean_anchor = anchor.strip().lower()
    clean_brand = brand_name.strip().lower() if brand_name else ""
    
    # Naked URL check
    if clean_anchor.startswith("http://") or clean_anchor.startswith("https://") or clean_anchor.startswith("www."):
        return AnchorCategory.NAKED_URL
    if "/" in clean_anchor and "." in clean_anchor:
        return AnchorCategory.NAKED_URL
    
    # Generic anchors
    generic_words = {"click here", "here", "website", "tıklayın", "buraya tıklayın", "web sitesi", "link", "read more", "source", "kaynak"}
    if clean_anchor in generic_words:
        return AnchorCategory.GENERIC
    
    # Brand check
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
    domain = parsed.netloc.lower()
    
    # 1. Suspicious TLD check
    for tld in SUSPICIOUS_TLDS:
        if domain.endswith(tld):
            reasons.append(f"Yüksek riskli/şüpheli spam uzantısı ({tld})")
            break

    # 2. Spam keyword check in anchor and domain
    lower_anchor = (anchor_text or "").lower()
    for trigger in SPAM_TRIGGER_PATTERNS:
        if trigger in lower_anchor:
            reasons.append(f"Yasaklı/Spam anahtar kelime içeren bağlantı metni ('{trigger}')")
            break
        if trigger in domain:
            reasons.append(f"Şüpheli spam sektörüne ait alan adı ('{trigger}')")
            break

    # 3. High external spam score (>50)
    if source_spam_score >= 60:
        reasons.append(f"Kritik alan adı spam skoru (%{source_spam_score})")
    elif source_spam_score >= 35:
        reasons.append(f"Yüksek spam sinyali (%{source_spam_score})")

    # 4. Low authority combined with high spam
    if source_da < 10 and source_spam_score > 30:
        reasons.append("Çok düşük domain otoritesi (DR < 10) ve şüpheli link profili")

    # Calculate final spam score & risk
    score = source_spam_score
    if len(reasons) >= 3:
        score = max(score, 85)
        risk = ToxicityRisk.CRITICAL
        is_toxic = True
    elif len(reasons) == 2:
        score = max(score, 65)
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


def analyze_backlinks(backlinks: List[BacklinkItem]) -> BacklinkSummary:
    """Generates an aggregate summary of a website's backlink profile."""
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
            top_toxic_domains=[]
        )

    domains = set()
    toxic_domains = set()
    dofollow_count = 0
    nofollow_count = 0
    total_da = 0
    toxic_count = 0
    anchor_dist: Dict[str, int] = {
        AnchorCategory.BRAND.value: 0,
        AnchorCategory.EXACT_MATCH.value: 0,
        AnchorCategory.PARTIAL_MATCH.value: 0,
        AnchorCategory.GENERIC.value: 0,
        AnchorCategory.NAKED_URL.value: 0
    }

    for b in backlinks:
        domains.add(b.source_domain)
        total_da += b.domain_authority
        
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
        top_toxic_domains=sorted(list(toxic_domains))[:10]
    )


def generate_google_disavow_file(
    backlinks: List[BacklinkItem],
    mode: str = "domain"
) -> str:
    """
    Generates standard Google Search Console Disavow Links file format (.txt).
    Complies with Google Search Central Disavow tool specifications:
    - Lines starting with '#' are comments
    - 'domain:example.com' disavows all links from that domain
    - Plain URL disavows only that specific URL
    """
    toxic_links = [b for b in backlinks if b.is_toxic or b.toxicity_risk in (ToxicityRisk.HIGH, ToxicityRisk.CRITICAL)]
    
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    lines = [
        "# -------------------------------------------------------------",
        "# Google Disavow Links File",
        f"# Generated autonomously by SEO Platform on {now_str}",
        f"# Total Toxic Items Identified: {len(toxic_links)}",
        "# Format: domain:example.com or specific URL",
        "# -------------------------------------------------------------",
        ""
    ]

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
