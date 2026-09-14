from typing import Any, Dict, Optional, List
from services.seo_engine.base import SeoRule, RuleCategory, IssueSeverity, RuleCheckResult

# 1. Canonical Rules
class CanonicalTo404Rule(SeoRule):
    rule_id = "RULE_CANONICAL_TO_404"
    name = "Canonical URL Returns 404/Client Error"
    category = RuleCategory.CANONICALIZATION
    default_severity = IssueSeverity.CRITICAL
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        canonical = page_context.get("canonical_target")
        if not canonical:
            return None

        # Check if target is in site pages and status is 4xx
        pages_by_url = (site_context or {}).get("pages_by_url", {})
        target_page = pages_by_url.get(canonical)
        if target_page and target_page.get("status_code", 200) >= 400:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Canonical tag references a 404/broken page",
                description=f"The page specifies '{canonical}' as its canonical URL, but that destination returns HTTP status {target_page.get('status_code')}.",
                evidence={
                    "page_url": page_context.get("url"),
                    "canonical_target": canonical,
                    "target_status_code": target_page.get("status_code")
                },
                recommendation_template="Update the canonical tag to point to a valid, status 200 indexable URL.",
                documentation_url=self.documentation_url
            )
        return None

class CanonicalToRedirectRule(SeoRule):
    rule_id = "RULE_CANONICAL_TO_REDIRECT"
    name = "Canonical URL References a 3xx Redirect"
    category = RuleCategory.CANONICALIZATION
    default_severity = IssueSeverity.HIGH
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        canonical = page_context.get("canonical_target")
        if not canonical:
            return None

        pages_by_url = (site_context or {}).get("pages_by_url", {})
        target_page = pages_by_url.get(canonical)
        if target_page and target_page.get("status_code", 200) in (301, 302, 303, 307, 308):
            target_status = target_page.get("status_code")
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title=f"Canonical tag references a redirecting ({target_status}) page",
                description=f"The page specifies '{canonical}' as its canonical URL, but that destination redirects with HTTP status {target_status}. Search engines expect canonical tags to point directly to the final status 200 URL.",
                evidence={
                    "page_url": page_context.get("url"),
                    "canonical_target": canonical,
                    "target_status_code": target_status
                },
                recommendation_template="Update the canonical tag to point directly to the final 200 destination URL.",
                documentation_url=self.documentation_url
            )
        return None


class CanonicalLoopRule(SeoRule):
    rule_id = "RULE_CANONICAL_LOOP"
    name = "Circular Canonical Loop Detected"
    category = RuleCategory.CANONICALIZATION
    default_severity = IssueSeverity.CRITICAL
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        current_url = page_context.get("url")
        canonical = page_context.get("canonical_target")
        if not canonical or canonical == current_url:
            return None

        pages_by_url = (site_context or {}).get("pages_by_url", {})
        target_page = pages_by_url.get(canonical)
        if target_page and target_page.get("canonical_target") == current_url:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Circular canonical reference between two pages",
                description=f"Page '{current_url}' canonicalizes to '{canonical}', which points back to '{current_url}'. This confuses search indexers.",
                evidence={
                    "url_a": current_url,
                    "url_b": canonical,
                    "url_b_canonical": target_page.get("canonical_target")
                },
                recommendation_template="Resolve the circular reference so only the authoritative page has a self-canonical.",
                documentation_url=self.documentation_url
            )
        return None

# 2. Robots & Noindex Rules
class NoindexBlockedByRobotsRule(SeoRule):
    rule_id = "RULE_NOINDEX_BLOCKED_BY_ROBOTS"
    name = "Noindex Page Blocked in Robots.txt"
    category = RuleCategory.ROBOTS
    default_severity = IssueSeverity.HIGH
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        has_noindex = page_context.get("has_noindex", False)
        is_blocked_by_robots = page_context.get("is_blocked_by_robots", False)

        if has_noindex and is_blocked_by_robots:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Page marked noindex is blocked by robots.txt",
                description="Googlebot cannot crawl the page to discover the noindex tag, meaning it may remain indexed if referenced elsewhere.",
                evidence={
                    "url": page_context.get("url"),
                    "has_noindex": True,
                    "is_blocked_by_robots": True
                },
                recommendation_template="Remove the robots.txt disallow rule to allow Googlebot to crawl and process the noindex directive.",
                documentation_url=self.documentation_url
            )
        return None

# 3. Status Codes & Redirects
class Server5xxErrorRule(SeoRule):
    rule_id = "RULE_HTTP_5XX_ERROR"
    name = "Server Error 5xx"
    category = RuleCategory.STATUS_CODES
    default_severity = IssueSeverity.CRITICAL
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/http-network-errors"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        status_code = page_context.get("status_code", 200)
        if 500 <= status_code <= 599:
            if status_code == 500:
                title = "Sunucu Hatası (HTTP 500 Internal Server Error)"
                desc = "Sunucu veya arka uç uygulaması beklenmeyen bir istisna (crash/exception) ile karşılaştı ve isteği tamamlayamadı."
                rec = "Sunucu ve uygulama hata loglarını inceleyerek kod kaynaklı istisnaları (exception) çözün."
            elif status_code == 502:
                title = "Geçersiz Ağ Geçidi (HTTP 502 Bad Gateway)"
                desc = "Ters proxy veya yük dengeleyici (Nginx, Cloudflare vb.), arkasındaki uygulama sunucusundan geçersiz yanıt aldı."
                rec = "Uygulama servisinin (upstream) çalıştığını ve bağlantı soketlerinin/portlarının doğru yapılandırıldığını doğrulayın."
            elif status_code == 503:
                title = "Hizmet Kullanılamıyor (HTTP 503 Service Unavailable)"
                desc = "Sunucu geçici aşırı yüklenme veya bakım modunda olduğu için isteği işleyemedi. Arama motorlarının taramasını durdurur."
                rec = "Sunucu kaynaklarını (CPU/RAM) artırın veya bakım modunda Retry-After HTTP başlığı tanımlayın."
            elif status_code == 504:
                title = "Ağ Geçidi Zaman Aşımı (HTTP 504 Gateway Timeout)"
                desc = "Ağ geçidi veya ters proxy, arka uç sunucusunun yanıt vermesini beklerken zaman aşımına uğradı."
                rec = "Yavaş çalışan veritabanı sorgularını ve harici API çağrılarını optimize ederek yanıt süresini kısaltın."
            else:
                title = f"Sunucu Hatası (HTTP {status_code})"
                desc = f"Sunucu {status_code} durum kodu döndürdü. Arama motoru botlarının taramasını engeller ve dizinden düşmeye yol açar."
                rec = "Web sunucusu ve uygulama loglarını inceleyerek sunucu hatasını giderin."

            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title=title,
                description=desc,
                evidence={"url": page_context.get("url"), "status_code": status_code},
                recommendation_template=rec,
                documentation_url=self.documentation_url
            )
        return None

class Client4xxErrorRule(SeoRule):
    rule_id = "RULE_HTTP_4XX_CLIENT_ERROR"
    name = "Client Error 4xx / Broken Page"
    category = RuleCategory.STATUS_CODES
    default_severity = IssueSeverity.HIGH
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/http-network-errors"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        status_code = page_context.get("status_code", 200)
        if 400 <= status_code <= 499:
            if status_code == 404:
                title = "Sayfa Bulunamadı (HTTP 404 Not Found)"
                desc = "İstenen sayfa sunucuda bulunamadı. İç veya dış bağlantılardan gelen ziyaretçiler ve arama motoru botları kırık linkle karşılaşır."
                rec = "Sayfa yanlışlıkla silindiyse geri yükleyin; yeri değiştiyse en alakalı canlı sayfaya 301 kalıcı yönlendirme kurun."
            elif status_code == 410:
                title = "Sayfa Kalıcı Olarak Kaldırıldı (HTTP 410 Gone)"
                desc = "İstenen sayfa kasıtlı ve kalıcı olarak kaldırılmış (410 Gone). Googlebot bu sayfayı 404'e kıyasla çok daha hızlı dizinden düşürür."
                rec = "Kaldırma işlemi kasıtlıysa bu URL'ye işaret eden tüm iç bağlantıları siteden temizleyin. Kasıtsız ise sayfayı geri yükleyin veya yönlendirin."
            else:
                title = f"İstemci Hatası (HTTP {status_code})"
                desc = f"İstenen sayfa {status_code} istemci hatası döndürdü."
                rec = "Yetkilendirme, erişim izinleri ve URL yapısını kontrol ederek hatayı giderin."

            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title=title,
                description=desc,
                evidence={"url": page_context.get("url"), "status_code": status_code},
                recommendation_template=rec,
                documentation_url=self.documentation_url
            )
        return None

class TemporaryRedirect302Rule(SeoRule):
    rule_id = "RULE_TEMPORARY_REDIRECT_302"
    name = "Temporary Redirect (302/307) in Place of Permanent (301)"
    category = RuleCategory.REDIRECTS
    default_severity = IssueSeverity.MEDIUM
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/301-redirects"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        status_code = page_context.get("status_code", 200)
        if status_code in (302, 303, 307):
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title=f"Geçici Yönlendirme Tespit Edildi (HTTP {status_code})",
                description=f"Sayfa HTTP {status_code} geçici yönlendirme döndürüyor. Arama motorları geçici yönlendirmelerde PageRank (bağlantı otoritesini) hedefe aktarmayabilir ve eski URL'yi arama dizininde tutmaya devam edebilir.",
                evidence={"url": page_context.get("url"), "status_code": status_code},
                recommendation_template="Kalıcı içerik taşımaları ve birincil site mimarisi için 301 kalıcı yönlendirme (Moved Permanently) kullanın.",
                documentation_url=self.documentation_url
            )
        return None

class RedirectChainRule(SeoRule):
    rule_id = "RULE_REDIRECT_CHAIN"
    name = "Redirect Chain Exceeds 1 Hop"
    category = RuleCategory.REDIRECTS
    default_severity = IssueSeverity.MEDIUM
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/301-redirects"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        current_url = page_context.get("url", "")
        # 1. Direct check if redirect_chain is explicitly provided in page_context
        chain = page_context.get("redirect_chain", [])
        if len(chain) > 1:
            hop_count = len(chain)
            chain_list = [getattr(h, 'to_url', str(h)) for h in chain]
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title=f"Yönlendirme Zinciri Tespit Edildi ({hop_count} Atlama)",
                description=f"Sayfa nihai hedefe ulaşmadan önce {hop_count} kez art arda yönlendiriliyor. Bu durum tarama bütçesini tüketir ve sayfa açılışını geciktirir.",
                evidence={"url": current_url, "hop_count": hop_count, "chain": chain_list},
                recommendation_template="İlk yönlendirmenin doğrudan nihai 200 HTTP hedefine yönlendirilmesini sağlayarak aradaki yönlendirmeleri kaldırın.",
                documentation_url=self.documentation_url
            )

        # 2. Cross-page graph tracing via site_context
        status_code = page_context.get("status_code", 200)
        if status_code in (301, 302, 303, 307, 308) and site_context:
            pages_by_url = site_context.get("pages_by_url", {})
            visited_chain = [current_url]
            curr = page_context

            while curr:
                target = curr.get("canonical_target")
                if not target or target in visited_chain:
                    break
                target_page = pages_by_url.get(target)
                if not target_page:
                    target_page = pages_by_url.get(target.rstrip("/")) or pages_by_url.get(target + "/")

                if target_page and target_page.get("status_code") in (301, 302, 303, 307, 308):
                    visited_chain.append(target)
                    curr = target_page
                else:
                    if target_page:
                        visited_chain.append(target)
                    break

            hop_count = len(visited_chain) - 1
            if hop_count > 1:
                return RuleCheckResult(
                    passed=False,
                    rule_id=self.rule_id,
                    category=self.category,
                    severity=self.default_severity,
                    confidence=1.0,
                    title=f"Yönlendirme Zinciri Tespit Edildi ({hop_count} Atlama)",
                    description=f"Sayfa nihai hedefe ulaşmadan önce {hop_count} kez art arda yönlendiriliyor ({' -> '.join(visited_chain)}). Bu durum tarama bütçesini tüketir ve sayfa açılışını geciktirir.",
                    evidence={"url": current_url, "hop_count": hop_count, "chain": visited_chain},
                    recommendation_template="İlk yönlendirmenin doğrudan nihai 200 HTTP hedefine yönlendirilmesini sağlayarak aradaki yönlendirmeleri kaldırın.",
                    documentation_url=self.documentation_url
                )
        return None

class RedirectLoopRule(SeoRule):
    rule_id = "RULE_REDIRECT_LOOP"
    name = "Circular Redirect Loop"
    category = RuleCategory.REDIRECTS
    default_severity = IssueSeverity.CRITICAL
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/301-redirects"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        current_url = page_context.get("url", "")

        # 1. Direct check if is_redirect_loop flag is present
        if page_context.get("is_redirect_loop", False):
            chain = page_context.get("redirect_chain", [])
            chain_list = [getattr(h, 'to_url', str(h)) for h in chain] if chain else [current_url]
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Döngüsel Yönlendirme (Redirect Loop) Tespit Edildi",
                description="Sayfa sonsuz bir yönlendirme döngüsüne giriyor. Tarayıcı botları ve kullanıcılar sayfaya hiçbir şekilde ulaşamaz.",
                evidence={"url": current_url, "chain": chain_list},
                recommendation_template="Yönlendirme kurallarını güncelleyerek döngüyü kırın ve sayfayı doğrudan tek bir nihai URL'ye yönlendirin.",
                documentation_url=self.documentation_url
            )

        # 2. Cross-page circular graph tracing via site_context
        status_code = page_context.get("status_code", 200)
        if status_code in (301, 302, 303, 307, 308, 310) and site_context:
            pages_by_url = site_context.get("pages_by_url", {})
            visited = [current_url]
            curr = page_context

            while curr:
                target = curr.get("canonical_target")
                if not target:
                    break
                if target == current_url or target in visited:
                    visited.append(target)
                    return RuleCheckResult(
                        passed=False,
                        rule_id=self.rule_id,
                        category=self.category,
                        severity=self.default_severity,
                        confidence=1.0,
                        title="Döngüsel Yönlendirme (Redirect Loop) Tespit Edildi",
                        description=f"Sayfa sonsuz bir yönlendirme döngüsüne giriyor ({' -> '.join(visited)}). Tarayıcı botları ve kullanıcılar sayfaya hiçbir şekilde ulaşamaz.",
                        evidence={"url": current_url, "chain": visited},
                        recommendation_template="Yönlendirme kurallarını güncelleyerek döngüyü kırın ve sayfayı doğrudan tek bir nihai URL'ye yönlendirin.",
                        documentation_url=self.documentation_url
                    )

                target_page = pages_by_url.get(target)
                if not target_page:
                    target_page = pages_by_url.get(target.rstrip("/")) or pages_by_url.get(target + "/")

                if target_page and target_page.get("status_code") in (301, 302, 303, 307, 308):
                    visited.append(target)
                    curr = target_page
                else:
                    break

        return None

# 4. Titles & Meta Descriptions
class TitleMissingRule(SeoRule):
    rule_id = "RULE_TITLE_MISSING"
    name = "Missing <title> Tag"
    category = RuleCategory.TITLES
    default_severity = IssueSeverity.HIGH
    documentation_url = "https://developers.google.com/search/docs/appearance/title-link"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if page_context.get("status_code", 200) != 200:
            return None
        title = page_context.get("title")
        if title is None:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Page is missing a <title> tag in <head>",
                description="The HTML document does not contain a title element, forcing search engines to guess a title link.",
                evidence={"url": page_context.get("url")},
                recommendation_template="Add an informative, descriptive <title> tag to the document <head>.",
                documentation_url=self.documentation_url
            )
        return None

class TitleEmptyRule(SeoRule):
    rule_id = "RULE_TITLE_EMPTY"
    name = "Empty <title> Tag"
    category = RuleCategory.TITLES
    default_severity = IssueSeverity.HIGH
    documentation_url = "https://developers.google.com/search/docs/appearance/title-link"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if page_context.get("status_code", 200) != 200:
            return None
        title = page_context.get("title")
        if title is not None and not title.strip():
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="The <title> tag exists but contains only whitespace",
                description="An empty title tag provides no signal to crawlers and users.",
                evidence={"url": page_context.get("url"), "raw_title": title},
                recommendation_template="Populate the title tag with a concise, keyword-accurate summary of the page.",
                documentation_url=self.documentation_url
            )
        return None

class MetaDescriptionMissingRule(SeoRule):
    rule_id = "RULE_META_DESC_MISSING"
    name = "Missing Meta Description"
    category = RuleCategory.META_DESCRIPTIONS
    default_severity = IssueSeverity.LOW
    documentation_url = "https://developers.google.com/search/docs/appearance/snippet"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if page_context.get("status_code", 200) != 200:
            return None
        meta_desc = page_context.get("meta_description")
        if not meta_desc or not meta_desc.strip():
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Page lacks a meta description tag",
                description="Without a meta description, Google will extract random text snippets for SERP results.",
                evidence={"url": page_context.get("url")},
                recommendation_template="Add a unique, engaging meta description tag to encourage organic CTR.",
                documentation_url=self.documentation_url
            )
        return None

# 5. Headings & Content
class H1MissingRule(SeoRule):
    rule_id = "RULE_H1_MISSING"
    name = "Missing H1 Heading"
    category = RuleCategory.HEADINGS
    default_severity = IssueSeverity.MEDIUM
    documentation_url = "https://developers.google.com/search/docs/fundamentals/seo-starter-guide"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if page_context.get("status_code", 200) != 200:
            return None
        headings = page_context.get("headings", {})
        h1_list = headings.get("h1", [])
        if not h1_list:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Page contains no <h1> heading tag",
                description="The H1 heading establishes primary document topic hierarchy for search engines and accessibility screen readers.",
                evidence={"url": page_context.get("url"), "headings_found": list(headings.keys())},
                recommendation_template="Add a descriptive <h1> element representing the main topic of the page.",
                documentation_url=self.documentation_url
            )
        return None

class ThinContentRule(SeoRule):
    rule_id = "RULE_THIN_CONTENT_PROBABLE"
    name = "Very Low Word Count / Thin Content"
    category = RuleCategory.CONTENT
    default_severity = IssueSeverity.MEDIUM
    documentation_url = "https://developers.google.com/search/docs/essentials/spam-policies#thin-content"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        word_count = page_context.get("word_count", 0)
        # Exclude redirecting or non-200 pages
        if page_context.get("status_code", 200) == 200 and word_count < 50:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=0.85,
                title="Page contains fewer than 50 visible body words",
                description="Thin content pages often struggle to rank and may trigger helpful content / quality filters.",
                evidence={"url": page_context.get("url"), "word_count": word_count},
                recommendation_template="Expand the page with substantive, helpful original information or consolidate with a stronger page.",
                documentation_url=self.documentation_url
            )
        return None

# 6. Structured Data
class SchemaSyntaxErrorRule(SeoRule):
    rule_id = "RULE_SCHEMA_SYNTAX_ERROR"
    name = "Malformed JSON-LD Syntax"
    category = RuleCategory.STRUCTURED_DATA
    default_severity = IssueSeverity.HIGH
    documentation_url = "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if page_context.get("status_code", 200) != 200:
            return None
        syntax_errors = page_context.get("schema_syntax_errors", [])
        if syntax_errors:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="JSON-LD structured data contains syntax errors",
                description="Invalid JSON formatting prevents search engines from parsing rich result markup.",
                evidence={"url": page_context.get("url"), "errors": syntax_errors},
                recommendation_template="Fix JSON syntax errors such as trailing commas or unescaped characters.",
                documentation_url=self.documentation_url
            )
        return None
