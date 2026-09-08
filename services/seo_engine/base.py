from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

class RuleCategory(str, Enum):
    CRAWLABILITY = "CRAWLABILITY"
    INDEXABILITY = "INDEXABILITY"
    CANONICALIZATION = "CANONICALIZATION"
    STATUS_CODES = "STATUS_CODES"
    REDIRECTS = "REDIRECTS"
    ROBOTS = "ROBOTS"
    SITEMAPS = "SITEMAPS"
    TITLES = "TITLES"
    META_DESCRIPTIONS = "META_DESCRIPTIONS"
    HEADINGS = "HEADINGS"
    CONTENT = "CONTENT"
    DUPLICATION = "DUPLICATION"
    INTERNAL_LINKING = "INTERNAL_LINKING"
    IMAGES = "IMAGES"
    STRUCTURED_DATA = "STRUCTURED_DATA"
    HREFLANG = "HREFLANG"
    JAVASCRIPT = "JAVASCRIPT"
    PERFORMANCE = "PERFORMANCE"

class IssueSeverity(str, Enum):
    INFO = "INFO"
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class RuleCheckResult(BaseModel):
    passed: bool
    rule_id: str
    category: RuleCategory
    severity: IssueSeverity
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    title: str
    description: str
    evidence: Dict[str, Any]
    recommendation_template: str
    documentation_url: Optional[str] = None

class SeoRule:
    rule_id: str
    name: str
    category: RuleCategory
    default_severity: IssueSeverity
    version: int = 1
    documentation_url: str = ""

    def check(self, page_context: Dict[str, Any], site_context: Optional[Dict[str, Any]] = None) -> Optional[RuleCheckResult]:
        """
        Executes a deterministic check on page facts.
        Returns None if passed, or RuleCheckResult with concrete evidence if failed.
        """
        raise NotImplementedError
