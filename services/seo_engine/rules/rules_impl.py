from typing import Any, Dict, Optional, List
from services.seo_engine.base import SeoRule, RuleCategory, IssueSeverity, RuleCheckResult
from services.crawler.url_normalizer import UrlNormalizer

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

class MultipleTitlesOnPageRule(SeoRule):
    rule_id = "RULE_MULTIPLE_TITLES_ON_PAGE"
    name = "Multiple <title> Tags on Single Page"
    category = RuleCategory.TITLES
    default_severity = IssueSeverity.HIGH
    documentation_url = "https://developers.google.com/search/docs/appearance/title-link"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if page_context.get("status_code", 200) != 200:
            return None
        all_titles = page_context.get("all_titles", [])
        if len(all_titles) > 1:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Sayfada Birden Fazla <title> Etiketi Bulunuyor",
                description=f"Sayfada {len(all_titles)} adet <title> etiketi tespit edildi. Arama motorları hangi başlığı seçeceğini belirleyemez.",
                evidence={"url": page_context.get("url"), "title_count": len(all_titles), "titles": all_titles},
                recommendation_template="HTML belgesinde <head> bölümü içinde yalnızca 1 adet <title> etiketi bırakın.",
                documentation_url=self.documentation_url
            )
        return None

class DuplicateTitleRule(SeoRule):
    rule_id = "RULE_DUPLICATE_TITLE"
    name = "Duplicate <title> Tag Across Multiple Pages"
    category = RuleCategory.TITLES
    default_severity = IssueSeverity.HIGH
    documentation_url = "https://developers.google.com/search/docs/appearance/title-link"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if page_context.get("status_code", 200) != 200 or page_context.get("has_noindex") or page_context.get("is_canonical") is False:
            return None
        title = page_context.get("title")
        if not title or not str(title).strip():
            return None

        current_url = page_context.get("url", "")
        raw_title = str(title).strip()
        norm_title = " ".join(raw_title.split()).strip().lower()

        matching_urls = []
        if site_context:
            titles_index = site_context.get("titles_index")
            if titles_index is not None:
                matching_urls = titles_index.get(norm_title, [])
            elif "pages_by_url" in site_context:
                for u, p in site_context["pages_by_url"].items():
                    if p.get("status_code", 200) != 200 or p.get("has_noindex") or p.get("is_canonical") is False:
                        continue
                    p_title = p.get("title")
                    if p_title and " ".join(str(p_title).split()).strip().lower() == norm_title:
                        matching_urls.append(u)

        other_urls = [u for u in matching_urls if u != current_url]
        if other_urls:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Yinelenen <title> Başlığı Tespit Edildi",
                description=f"Bu sayfanın <title> başlığı ('{raw_title}') sitedeki diğer {len(other_urls)} sayfa ile birebir aynı.",
                evidence={
                    "url": current_url,
                    "title": raw_title,
                    "duplicate_urls": other_urls,
                    "duplicate_count": len(other_urls) + 1
                },
                recommendation_template="Her sayfa için içeriğe özgü, benzersiz ve anahtar kelime odaklı bir <title> başlığı belirleyin.",
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

class MultipleMetaDescriptionsOnPageRule(SeoRule):
    rule_id = "RULE_MULTIPLE_META_DESCRIPTIONS"
    name = "Multiple Meta Description Tags on Single Page"
    category = RuleCategory.META_DESCRIPTIONS
    default_severity = IssueSeverity.MEDIUM
    documentation_url = "https://developers.google.com/search/docs/appearance/snippet"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if page_context.get("status_code", 200) != 200:
            return None
        all_meta_descs = page_context.get("all_meta_descriptions", [])
        if len(all_meta_descs) > 1:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Sayfada Birden Fazla Meta Açıklaması Bulunuyor",
                description=f"Sayfada {len(all_meta_descs)} adet meta description etiketi tespit edildi.",
                evidence={"url": page_context.get("url"), "meta_description_count": len(all_meta_descs), "meta_descriptions": all_meta_descs},
                recommendation_template="Sayfa içerisinde yalnızca 1 adet özgün meta açıklama etiketi kullanın.",
                documentation_url=self.documentation_url
            )
        return None

class DuplicateMetaDescriptionRule(SeoRule):
    rule_id = "RULE_DUPLICATE_META_DESCRIPTION"
    name = "Duplicate Meta Description Across Multiple Pages"
    category = RuleCategory.META_DESCRIPTIONS
    default_severity = IssueSeverity.MEDIUM
    documentation_url = "https://developers.google.com/search/docs/appearance/snippet"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if page_context.get("status_code", 200) != 200 or page_context.get("has_noindex") or page_context.get("is_canonical") is False:
            return None
        meta_desc = page_context.get("meta_description")
        if not meta_desc or not str(meta_desc).strip():
            return None

        current_url = page_context.get("url", "")
        raw_desc = str(meta_desc).strip()
        norm_desc = " ".join(raw_desc.split()).strip().lower()

        matching_urls = []
        if site_context:
            meta_desc_index = site_context.get("meta_desc_index")
            if meta_desc_index is not None:
                matching_urls = meta_desc_index.get(norm_desc, [])
            elif "pages_by_url" in site_context:
                for u, p in site_context["pages_by_url"].items():
                    if p.get("status_code", 200) != 200 or p.get("has_noindex") or p.get("is_canonical") is False:
                        continue
                    p_desc = p.get("meta_description")
                    if p_desc and " ".join(str(p_desc).split()).strip().lower() == norm_desc:
                        matching_urls.append(u)

        other_urls = [u for u in matching_urls if u != current_url]
        if other_urls:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Yinelenen Meta Açıklaması Tespit Edildi",
                description=f"Bu sayfanın meta açıklaması sitedeki diğer {len(other_urls)} sayfa ile birebir aynı.",
                evidence={
                    "url": current_url,
                    "meta_description": raw_desc,
                    "duplicate_urls": other_urls,
                    "duplicate_count": len(other_urls) + 1
                },
                recommendation_template="Her sayfa için kullanıcılara sayfa içeriğini özetleyen benzersiz bir meta açıklama yazın.",
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
        h1_list = headings.get("h1", []) if isinstance(headings, dict) else []
        if not h1_list and page_context.get("h1"):
            h1_list = [page_context["h1"]]
        if not h1_list:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Page contains no <h1> heading tag",
                description="The H1 heading establishes primary document topic hierarchy for search engines and accessibility screen readers.",
                evidence={"url": page_context.get("url"), "headings_found": list(headings.keys()) if isinstance(headings, dict) else []},
                recommendation_template="Add a descriptive <h1> element representing the main topic of the page.",
                documentation_url=self.documentation_url
            )
        return None

class MultipleH1Rule(SeoRule):
    rule_id = "RULE_MULTIPLE_H1"
    name = "Multiple <h1> Headings on Page"
    category = RuleCategory.HEADINGS
    default_severity = IssueSeverity.LOW
    documentation_url = "https://developers.google.com/search/docs/fundamentals/seo-starter-guide"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if page_context.get("status_code", 200) != 200:
            return None
        headings = page_context.get("headings", {})
        h1_list = headings.get("h1", []) if isinstance(headings, dict) else []
        if len(h1_list) > 1:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Sayfada Birden Fazla <h1> Başlığı Bulunuyor",
                description=f"Sayfada {len(h1_list)} adet <h1> etiketi tespit edildi: {', '.join(str(h) for h in h1_list[:3])}. Sayfa başlık hiyerarşisinin netliği için tek bir ana <h1> önerilir.",
                evidence={"url": page_context.get("url"), "h1_count": len(h1_list), "h1_list": h1_list},
                recommendation_template="Sayfa başına yalnızca 1 adet <h1> başlığı belirleyin, diğer alt başlıkları <h2> ve <h3> olarak yapılandırın.",
                documentation_url=self.documentation_url
            )
        return None

class DuplicateH1Rule(SeoRule):
    rule_id = "RULE_DUPLICATE_H1"
    name = "Duplicate <h1> Heading Across Multiple Pages"
    category = RuleCategory.HEADINGS
    default_severity = IssueSeverity.MEDIUM
    documentation_url = "https://developers.google.com/search/docs/fundamentals/seo-starter-guide"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if page_context.get("status_code", 200) != 200 or page_context.get("has_noindex") or page_context.get("is_canonical") is False:
            return None
        headings = page_context.get("headings", {})
        h1_list = headings.get("h1", []) if isinstance(headings, dict) else []
        if not h1_list and page_context.get("h1"):
            h1_list = [page_context["h1"]]
        if not h1_list:
            return None

        current_url = page_context.get("url", "")

        for h1_item in h1_list:
            if not h1_item or not str(h1_item).strip():
                continue
            raw_h1 = str(h1_item).strip()
            norm_h1 = " ".join(raw_h1.split()).strip().lower()

            matching_urls = []
            if site_context:
                h1_index = site_context.get("h1_index")
                if h1_index is not None:
                    matching_urls = h1_index.get(norm_h1, [])
                elif "pages_by_url" in site_context:
                    for u, p in site_context["pages_by_url"].items():
                        if p.get("status_code", 200) != 200 or p.get("has_noindex") or p.get("is_canonical") is False:
                            continue
                        p_headings = p.get("headings", {})
                        p_h1s = p_headings.get("h1", []) if isinstance(p_headings, dict) else []
                        if not p_h1s and p.get("h1"):
                            p_h1s = [p["h1"]]
                        for ph in p_h1s:
                            if ph and " ".join(str(ph).split()).strip().lower() == norm_h1:
                                if u not in matching_urls:
                                    matching_urls.append(u)
                                break

            other_urls = [u for u in matching_urls if u != current_url]
            if other_urls:
                return RuleCheckResult(
                    passed=False,
                    rule_id=self.rule_id,
                    category=self.category,
                    severity=self.default_severity,
                    confidence=1.0,
                    title="Yinelenen <h1> Başlığı Tespit Edildi",
                    description=f"Bu sayfanın <h1> başlığı ('{raw_h1}') sitedeki diğer {len(other_urls)} sayfa ile aynı.",
                    evidence={
                        "url": current_url,
                        "h1": raw_h1,
                        "duplicate_urls": other_urls,
                        "duplicate_count": len(other_urls) + 1
                    },
                    recommendation_template="Her sayfa için o sayfanın konusunu benzersiz şekilde özetleyen tekil bir <h1> başlığı kullanın.",
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

# 7. Sitemap Rules
class SitemapPage404Rule(SeoRule):
    rule_id = "RULE_SITEMAP_PAGE_404"
    name = "Sitemap URL Returns 404 Not Found"
    category = RuleCategory.SITEMAPS
    default_severity = IssueSeverity.CRITICAL
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if page_context.get("in_sitemap") and page_context.get("status_code", 200) == 404:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Site Haritasındaki Sayfa Bulunamadı (Sitemap 404)",
                description="Sayfa XML site haritasında dizine eklenmesi için sunulmuş ancak sunucudan 404 Not Found yanıtı dönüyor. Googlebot kırık linklerle karşılaşır ve sitenin tarama kalitesi düşer.",
                evidence={"url": page_context.get("url"), "status_code": 404, "in_sitemap": True},
                recommendation_template="Sayfayı XML site haritasından kaldırın veya doğru ve çalışan bir sayfaya 301 yönlendirmesi yapın.",
                documentation_url=self.documentation_url
            )
        return None

class SitemapPageRedirectRule(SeoRule):
    rule_id = "RULE_SITEMAP_PAGE_REDIRECT"
    name = "Sitemap URL Returns 3xx Redirect"
    category = RuleCategory.SITEMAPS
    default_severity = IssueSeverity.MEDIUM
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if page_context.get("in_sitemap") and page_context.get("status_code", 200) in (301, 302, 303, 307, 308):
            status = page_context.get("status_code")
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title=f"Site Haritasındaki Sayfa Yönlendiriliyor (HTTP {status})",
                description="Sayfa XML site haritasında yer alıyor ancak doğrudan 200 OK yanıtı vermek yerine yönlendirme yapıyor. Google kılavuzlarına göre site haritalarında yalnızca nihai ve kanonik 200 OK sayfalar yer almalıdır.",
                evidence={"url": page_context.get("url"), "status_code": status, "in_sitemap": True},
                recommendation_template="Site haritasındaki yönlendirilen URL'yi doğrudan nihai hedef URL ile değiştirin.",
                documentation_url=self.documentation_url
            )
        return None

class SitemapPageNoindexRule(SeoRule):
    rule_id = "RULE_SITEMAP_PAGE_NOINDEX"
    name = "Sitemap URL Marked with Noindex"
    category = RuleCategory.SITEMAPS
    default_severity = IssueSeverity.HIGH
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if page_context.get("in_sitemap") and page_context.get("has_noindex"):
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Site Haritasındaki Sayfa 'noindex' İle İşaretlenmiş",
                description="Sayfa XML site haritasında arama motorlarının dizine eklemesi için bildirilmiş fakat sayfa içinde 'noindex' yönergesi tespit edildi. Bu çelişki tarama bütçesini israf eder.",
                evidence={"url": page_context.get("url"), "has_noindex": True, "in_sitemap": True},
                recommendation_template="Sayfa dizine eklensin istiyorsanız 'noindex' etiketini kaldırın; dizine eklenmesin istiyorsanız sayfayı XML site haritasından çıkarın.",
                documentation_url=self.documentation_url
            )
        return None

class IndexablePageNotInSitemapRule(SeoRule):
    rule_id = "RULE_INDEXABLE_PAGE_NOT_IN_SITEMAP"
    name = "Indexable Page Not Included in Sitemap"
    category = RuleCategory.SITEMAPS
    default_severity = IssueSeverity.MEDIUM
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        # Yalnızca sitede bir sitemap mevcutsa değerlendirilir
        has_sitemap = (site_context or {}).get("has_sitemap", False)
        if not has_sitemap:
            return None

        status_code = page_context.get("status_code", 200)
        has_noindex = page_context.get("has_noindex", False)
        is_canonical = page_context.get("is_canonical", True)
        is_crawlable = page_context.get("is_crawlable_by_google", True)
        in_sitemap = page_context.get("in_sitemap", False)

        is_indexable = (
            status_code == 200 and
            not has_noindex and
            is_canonical and
            is_crawlable
        )

        if is_indexable and not in_sitemap:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="İndekslenebilir Canlı Sayfa Site Haritasında (Sitemap) Bulunmuyor",
                description="Sayfa 200 OK yanıtı veren, 'noindex' içermeyen ve kanonik olan dizine eklenebilir bir sayfadır; ancak XML site haritasında listelenmemiştir. Arama motorlarının bu sayfayı geç keşfetmesine ve tarama bütçesinin verimsiz kullanılmasına neden olur.",
                evidence={"url": page_context.get("url"), "status_code": 200, "in_sitemap": False, "is_indexable": True},
                recommendation_template="Bu URL'yi XML site haritanıza ekleyin veya dinamik site haritası oluşturucunuzu güncelleyin.",
                documentation_url=self.documentation_url
            )
        return None

class SitemapPageBlockedByRobotsRule(SeoRule):
    rule_id = "RULE_SITEMAP_PAGE_BLOCKED_BY_ROBOTS"
    name = "Sitemap URL Blocked by robots.txt"
    category = RuleCategory.SITEMAPS
    default_severity = IssueSeverity.CRITICAL
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if page_context.get("in_sitemap") and not page_context.get("is_crawlable_by_google", True):
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Site Haritasındaki Sayfa robots.txt İle Engellenmiş",
                description="Sayfa XML site haritasında taranması ve dizine eklenmesi için sunulmuş, ancak robots.txt dosyasındaki 'Disallow' kuralı arama motoru botlarının bu sayfayı taramasını engelliyor.",
                evidence={"url": page_context.get("url"), "in_sitemap": True, "is_crawlable_by_google": False},
                recommendation_template="Sayfanın taranmasını ve dizine eklenmesini istiyorsanız robots.txt dosyasındaki kısıtlamayı kaldırın; taranmasını istemiyorsanız sayfayı site haritasından silin.",
                documentation_url=self.documentation_url
            )
        return None

class SitemapPageNonCanonicalRule(SeoRule):
    rule_id = "RULE_SITEMAP_PAGE_NON_CANONICAL"
    name = "Sitemap URL Has Non-Self Canonical Tag"
    category = RuleCategory.SITEMAPS
    default_severity = IssueSeverity.HIGH
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if (
            page_context.get("in_sitemap") and
            page_context.get("status_code", 200) == 200 and
            page_context.get("is_canonical") is False and
            page_context.get("canonical_target") and
            page_context.get("canonical_target") != page_context.get("url")
        ):
            target = page_context.get("canonical_target")
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Site Haritasındaki Sayfa Kanonik Değil (Non-Canonical)",
                description=f"Sayfa XML site haritasında yer alıyor ancak rel=canonical etiketi ile başka bir URL'yi ('{target}') asıl kaynak olarak gösteriyor. Google yönergelerine göre site haritasında yalnızca asıl kanonik URL'ler yer almalıdır.",
                evidence={"url": page_context.get("url"), "canonical_target": target, "in_sitemap": True},
                recommendation_template="Site haritasından bu adresi çıkarın veya site haritasındaki kaydı doğrudan kanonik hedef olan asıl adresle değiştirin.",
                documentation_url=self.documentation_url
            )
        return None

class SitemapPage5xxRule(SeoRule):
    rule_id = "RULE_SITEMAP_PAGE_5XX"
    name = "Sitemap URL Returns 5xx Server Error"
    category = RuleCategory.SITEMAPS
    default_severity = IssueSeverity.CRITICAL
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/http-network-errors"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        status_code = page_context.get("status_code", 200)
        if page_context.get("in_sitemap") and 500 <= status_code <= 599:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title=f"Site Haritasındaki Sayfa Sunucu Hatası Veriyor (HTTP {status_code})",
                description="XML site haritasında listelenen sayfa arama motorları tarafından taranırken sunucu hatasıyla karşılaşıldı. Googlebot bu hatayı Search Console'da 'Gönderilen URL sunucu hatası (5xx)' olarak raporlar.",
                evidence={"url": page_context.get("url"), "status_code": status_code, "in_sitemap": True},
                recommendation_template="Sunucu ve uygulama hata loglarını kontrol ederek arka uçtaki hatayı giderin veya sayfayı site haritasından kaldırın.",
                documentation_url=self.documentation_url
            )
        return None

# 7. Internal Linking & Broken Links
def _extract_page_links(page_context: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw_links = page_context.get("internal_links") or page_context.get("links") or []
    extracted = []
    for l in raw_links:
        if isinstance(l, dict):
            if l.get("is_internal", True):
                extracted.append({
                    "href": l.get("href") or l.get("target_url") or "",
                    "anchor_text": l.get("anchor_text", ""),
                    "rel": l.get("rel", ""),
                    "status_code": l.get("status_code")
                })
        elif hasattr(l, "href"):
            if getattr(l, "is_internal", True):
                extracted.append({
                    "href": getattr(l, "href", ""),
                    "anchor_text": getattr(l, "anchor_text", ""),
                    "rel": getattr(l, "rel", ""),
                    "status_code": getattr(l, "status_code", None)
                })
    return extracted

def _resolve_target_page(target_url: str, site_context: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not site_context or not target_url:
        return None
    pages_by_url = site_context.get("pages_by_url", {})
    if target_url in pages_by_url:
        return pages_by_url[target_url]
    target_clean = target_url.rstrip("/")
    if target_clean in pages_by_url:
        return pages_by_url[target_clean]
    pages_by_norm = site_context.get("pages_by_norm", {})
    if target_url in pages_by_norm:
        return pages_by_norm[target_url]
    if target_clean in pages_by_norm:
        return pages_by_norm[target_clean]
    try:
        norm = UrlNormalizer.normalize(target_url)
        if norm in pages_by_norm:
            return pages_by_norm[norm]
        if norm in pages_by_url:
            return pages_by_url[norm]
    except Exception:
        pass
    return None

class InternalLinkTo404Rule(SeoRule):
    rule_id = "RULE_INTERNAL_LINK_TO_404"
    name = "Broken Internal Link (HTTP 404 / 410)"
    category = RuleCategory.INTERNAL_LINKING
    default_severity = IssueSeverity.HIGH
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/links-crawlable"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        links = _extract_page_links(page_context)
        if not links:
            return None

        broken_links = []
        for l in links:
            target_href = l["href"]
            if not target_href:
                continue

            target_status = l.get("status_code")
            if target_status is None and site_context:
                target_page = _resolve_target_page(target_href, site_context)
                if target_page:
                    target_status = target_page.get("status_code")

            if target_status in (404, 410) or (target_status is not None and 400 <= target_status < 500):
                broken_links.append({
                    "target_url": target_href,
                    "anchor_text": l.get("anchor_text", ""),
                    "status_code": target_status
                })

        if broken_links:
            count = len(broken_links)
            first_target = broken_links[0]["target_url"]
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Kırık İç Bağlantı Tespit Edildi (HTTP 404 / 410)",
                description=f"Bu sayfada {count} adet kırık iç bağlantı tespit edildi. Örneğin '{first_target}' adresi HTTP {broken_links[0]['status_code']} hatası veriyor.",
                evidence={
                    "url": page_context.get("url"),
                    "broken_count": count,
                    "broken_links": broken_links
                },
                recommendation_template="Kırık bağlantıları güncel ve çalışan bir hedef URL ile değiştirin veya sayfadan kaldırın.",
                documentation_url=self.documentation_url
            )
        return None

class InternalLinkTo5xxRule(SeoRule):
    rule_id = "RULE_INTERNAL_LINK_TO_5XX"
    name = "Broken Internal Link to 5xx Error Page"
    category = RuleCategory.INTERNAL_LINKING
    default_severity = IssueSeverity.CRITICAL
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/links-crawlable"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        links = _extract_page_links(page_context)
        if not links:
            return None

        server_error_links = []
        for l in links:
            target_href = l["href"]
            if not target_href:
                continue

            target_status = l.get("status_code")
            if target_status is None and site_context:
                target_page = _resolve_target_page(target_href, site_context)
                if target_page:
                    target_status = target_page.get("status_code")

            if target_status is not None and 500 <= target_status <= 599:
                server_error_links.append({
                    "target_url": target_href,
                    "anchor_text": l.get("anchor_text", ""),
                    "status_code": target_status
                })

        if server_error_links:
            count = len(server_error_links)
            first_target = server_error_links[0]["target_url"]
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Sunucu Hatası Veren Kırık İç Bağlantı (HTTP 5xx)",
                description=f"Bu sayfada {count} adet iç bağlantı sunucu hatası (HTTP {server_error_links[0]['status_code']}) veren sayfalara ({first_target}) işaret ediyor.",
                evidence={
                    "url": page_context.get("url"),
                    "server_error_count": count,
                    "server_error_links": server_error_links
                },
                recommendation_template="Hedef sayfadaki sunucu hatalarını giderin veya bağlantıyı çalışan bir adrese yönlendirin.",
                documentation_url=self.documentation_url
            )
        return None

class InternalLinkToRedirectRule(SeoRule):
    rule_id = "RULE_INTERNAL_LINK_TO_3XX"
    name = "Internal Link to 3xx Redirect"
    category = RuleCategory.INTERNAL_LINKING
    default_severity = IssueSeverity.LOW
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/301-redirects"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        links = _extract_page_links(page_context)
        if not links:
            return None

        redirect_links = []
        for l in links:
            target_href = l["href"]
            if not target_href:
                continue

            target_status = l.get("status_code")
            target_canonical = None
            if site_context:
                target_page = _resolve_target_page(target_href, site_context)
                if target_page:
                    if target_status is None:
                        target_status = target_page.get("status_code")
                    target_canonical = target_page.get("canonical_target")

            if target_status in (301, 302, 303, 307, 308):
                redirect_links.append({
                    "target_url": target_href,
                    "anchor_text": l.get("anchor_text", ""),
                    "status_code": target_status,
                    "redirect_target": target_canonical
                })

        if redirect_links:
            count = len(redirect_links)
            first_target = redirect_links[0]["target_url"]
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Yönlendirmeye İşaret Eden İç Bağlantı (HTTP 3xx)",
                description=f"Bu sayfadaki {count} adet iç bağlantı doğrudan nihai adrese değil, bir HTTP 3xx yönlendirmesine ({first_target}) işaret ediyor.",
                evidence={
                    "url": page_context.get("url"),
                    "redirect_count": count,
                    "redirect_links": redirect_links
                },
                recommendation_template="İç bağlantıları doğrudan nihai hedef URL ile güncelleyerek gereksiz yönlendirme gecikmelerini önleyin.",
                documentation_url=self.documentation_url
            )
        return None

class InternalLinkEmptyHrefRule(SeoRule):
    rule_id = "RULE_INTERNAL_LINK_EMPTY_HREF"
    name = "Empty or Non-Crawlable Internal Link Href"
    category = RuleCategory.INTERNAL_LINKING
    default_severity = IssueSeverity.MEDIUM
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/links-crawlable"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        raw_links = page_context.get("internal_links") or page_context.get("links") or []
        if not raw_links:
            return None

        empty_links = []
        for l in raw_links:
            href = (l.get("href") if isinstance(l, dict) else getattr(l, "href", "")) or ""
            href_clean = href.strip()
            anchor_text = (l.get("anchor_text") if isinstance(l, dict) else getattr(l, "anchor_text", "")) or ""
            if not href_clean or href_clean == "#" or href_clean.lower().startswith("javascript:"):
                empty_links.append({
                    "href": href,
                    "anchor_text": anchor_text
                })

        if empty_links:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Geçersiz veya Taranamayan İç Bağlantı (Empty/Invalid Href)",
                description=f"Sayfada {len(empty_links)} adet boş, '#' veya 'javascript:' formatında taranamayan iç bağlantı bulundu.",
                evidence={
                    "url": page_context.get("url"),
                    "empty_count": len(empty_links),
                    "empty_links": empty_links
                },
                recommendation_template="Arama motorlarının sayfalarınızı tarayabilmesi için tüm <a> etiketlerinde geçerli bir href URL'si kullanın.",
                documentation_url=self.documentation_url
            )
        return None

class InternalLinkOrphanRule(SeoRule):
    rule_id = "RULE_INTERNAL_LINK_ORPHAN"
    name = "Orphan Page (Zero Incoming Internal Links)"
    category = RuleCategory.INTERNAL_LINKING
    default_severity = IssueSeverity.HIGH
    documentation_url = "https://developers.google.com/search/docs/crawling-indexing/links-crawlable"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        if not site_context:
            return None

        # Orphan detection only applies when analyzing multiple pages with link data
        pages_by_url = site_context.get("pages_by_url", {})
        if len(pages_by_url) <= 1:
            return None

        if not site_context.get("has_links_data", False):
            return None

        current_url = page_context.get("url", "")
        if not current_url:
            return None

        # Root URL / Homepage is never an orphan
        root_url = site_context.get("root_url")
        if root_url and self._is_root(current_url, root_url):
            return None

        # Only evaluate 200 OK indexable candidates
        status_code = page_context.get("status_code", 200)
        if status_code != 200:
            return None
        if page_context.get("has_noindex"):
            return None
        if page_context.get("is_canonical") is False:
            return None

        orphan_pages = site_context.get("orphan_pages", set())
        incoming_links_count = site_context.get("incoming_links_count", {})

        is_orphan = current_url in orphan_pages or incoming_links_count.get(current_url, 1) == 0
        if not is_orphan:
            norm_url = current_url.rstrip("/")
            if norm_url in orphan_pages or incoming_links_count.get(norm_url, 1) == 0:
                is_orphan = True

        if is_orphan:
            in_sitemap = page_context.get("in_sitemap", False)
            topic = page_context.get("title") or "Sayfa İçeriği"
            if in_sitemap:
                desc = (
                    f"Bu sayfa ({current_url}) site haritasında (XML sitemap) yer almasına rağmen, "
                    "sitedeki diğer hiçbir sayfadan iç bağlantı (internal link) almıyor. "
                    "Yetim sayfalar (orphan pages) arama motorları ve kullanıcılar tarafından bulunmakta zorlanır."
                )
            else:
                desc = (
                    f"Bu sayfa ({current_url}) sitedeki diğer hiçbir sayfadan iç bağlantı (internal link) almıyor. "
                    "Yetim sayfalar (orphan pages) arama motorları ve kullanıcılar tarafından bulunmakta ve dizine eklenmekte zorlanır."
                )

            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Yetim Sayfa Tespit Edildi (Orphan Page)",
                description=desc,
                evidence={
                    "url": current_url,
                    "target_url": current_url,
                    "target_topic": topic,
                    "incoming_internal_links_count": 0,
                    "is_orphan": True,
                    "in_sitemap": in_sitemap
                },
                recommendation_template="Sitedeki ilgili ve otoriter sayfalardan bu yetim sayfaya açıklayıcı çapa metinleri (anchor text) ile iç bağlantı verin.",
                documentation_url=self.documentation_url
            )
        return None

    @staticmethod
    def _is_root(url: str, root: str) -> bool:
        if not url or not root:
            return False
        if url == root or url.rstrip("/") == root.rstrip("/"):
            return True
        try:
            return UrlNormalizer.normalize(url) == UrlNormalizer.normalize(root)
        except Exception:
            return False

