from typing import List, Dict, Any, Optional
from services.seo_engine.base import SeoRule, RuleCheckResult
from services.seo_engine.rules.rules_impl import (
    CanonicalTo404Rule,
    CanonicalLoopRule,
    NoindexBlockedByRobotsRule,
    Server5xxErrorRule,
    Client4xxErrorRule,
    RedirectChainRule,
    RedirectLoopRule,
    TitleMissingRule,
    TitleEmptyRule,
    MetaDescriptionMissingRule,
    H1MissingRule,
    ThinContentRule,
    SchemaSyntaxErrorRule
)

class SeoRuleEngine:
    def __init__(self):
        self.rules: List[SeoRule] = [
            CanonicalTo404Rule(),
            CanonicalLoopRule(),
            NoindexBlockedByRobotsRule(),
            Server5xxErrorRule(),
            Client4xxErrorRule(),
            RedirectChainRule(),
            RedirectLoopRule(),
            TitleMissingRule(),
            TitleEmptyRule(),
            MetaDescriptionMissingRule(),
            H1MissingRule(),
            ThinContentRule(),
            SchemaSyntaxErrorRule(),
        ]

    def register_rule(self, rule: SeoRule):
        self.rules.append(rule)

    def evaluate_page(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> List[RuleCheckResult]:
        """Evaluates all registered deterministic rules against a single page context."""
        issues: List[RuleCheckResult] = []
        for rule in self.rules:
            try:
                res = rule.check(page_context, site_context)
                if res and not res.passed:
                    issues.append(res)
            except Exception as e:
                # Rule execution should not crash the engine
                continue
        return issues

    def evaluate_site(self, pages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Evaluates a complete crawl dataset. Builds global site index (pages by URL)
        to detect cross-page anomalies like canonical loops, duplicate titles, and 404 targets.
        """
        pages_by_url = {p["url"]: p for p in pages if "url" in p}
        site_context = {"pages_by_url": pages_by_url}

        all_issues: List[RuleCheckResult] = []
        issues_by_page: Dict[str, List[RuleCheckResult]] = {}

        for page in pages:
            url = page.get("url", "unknown")
            page_issues = self.evaluate_page(page, site_context)
            if page_issues:
                issues_by_page[url] = page_issues
                all_issues.extend(page_issues)

        # Calculate deterministic health score (0 - 100)
        # Deductions: CRITICAL: -15, HIGH: -8, MEDIUM: -4, LOW: -1
        deductions = 0
        for issue in all_issues:
            if issue.severity == "CRITICAL":
                deductions += 15
            elif issue.severity == "HIGH":
                deductions += 8
            elif issue.severity == "MEDIUM":
                deductions += 4
            elif issue.severity == "LOW":
                deductions += 1

        health_score = max(0, 100 - deductions)

        return {
            "total_pages_evaluated": len(pages),
            "total_issues_found": len(all_issues),
            "health_score": health_score,
            "issues": all_issues,
            "issues_by_page": issues_by_page
        }
