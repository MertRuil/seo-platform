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
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title=f"Server returned HTTP status {status_code}",
                description="Server errors block web crawling and result in temporary or permanent de-indexing.",
                evidence={"url": page_context.get("url"), "status_code": status_code},
                recommendation_template="Investigate web server and application logs to resolve internal server errors.",
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
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title=f"Page returned HTTP client error {status_code}",
                description="The requested page could not be found or was deleted.",
                evidence={"url": page_context.get("url"), "status_code": status_code},
                recommendation_template="Restore the page or establish a permanent 301 redirect to an active relevant page.",
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
        chain = page_context.get("redirect_chain", [])
        if len(chain) > 1:
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title=f"Redirect chain detected ({len(chain)} hops)",
                description="Redirect chains waste crawl budget and increase latency before destination page delivery.",
                evidence={"url": page_context.get("url"), "hop_count": len(chain), "chain": chain},
                recommendation_template="Point the initial redirect directly to the final canonical destination.",
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
        if page_context.get("is_redirect_loop", False):
            return RuleCheckResult(
                passed=False,
                rule_id=self.rule_id,
                category=self.category,
                severity=self.default_severity,
                confidence=1.0,
                title="Circular redirect loop prevents page load",
                description="An infinite redirect loop was encountered, completely preventing bots and users from reaching the page.",
                evidence={"url": page_context.get("url"), "chain": page_context.get("redirect_chain", [])},
                recommendation_template="Break the infinite loop by updating redirect rules in your server or CMS configuration.",
                documentation_url=self.documentation_url
            )
        return None

# 4. Titles & Meta Descriptions
class TitleMissingRule(SeoRule):
    rule_id = "RULE_TITLE_MISSING"
    name = "Missing <title> Tag"
    category = RuleCategory.TITLES
    default_severity = IssueSeverity.HIGH
    documentation_url = "https://developers.google.com/search/docs/appearance/title-link"

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
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
