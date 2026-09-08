# DETERMINISTIC SEO RULES SPECIFICATION
## Autonomous AI SEO Platform

### 1. Architectural Mandate
The SEO Rule Engine is strictly **deterministic**. SEO facts must never be deduced by LLM free-text reasoning.
Every rule must implement the `SeoRule` interface, return verified factual evidence, provide an explicit confidence level, and reference official search documentation.

---

### 2. Rule Interface Contract (Python / Pydantic)

```python
from enum import Enum
from typing import Any, Dict, List, Optional
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
    MOBILE = "MOBILE"
    SECURITY = "SECURITY"
    ACCESSIBILITY_RELEVANT = "ACCESSIBILITY_RELEVANT"

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
    confidence: float = Field(ge=0.0, le=1.0)
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
    documentation_url: str

    def check(self, page_data: Dict[str, Any], site_graph: Optional[Any] = None) -> Optional[RuleCheckResult]:
        raise NotImplementedError
```

---

### 3. Comprehensive Rule Catalog by Category

#### 3.1. Crawlability & Indexability
| Rule ID | Name | Severity | Description | Evidence Captured |
|---|---|---|---|---|
| `RULE_HTTP_5XX_ERROR` | Server Error 5xx | CRITICAL | Server returned 500, 502, 503, 504. Prevents Googlebot indexing. | HTTP status, response headers, response time |
| `RULE_HTTP_4XX_CLIENT_ERROR` | Broken Page 4xx | HIGH | Page returns 404/410; dead end for users and crawlers. | HTTP status, referring URLs |
| `RULE_NOINDEX_BLOCKED_BY_ROBOTS` | Noindex Blocked by Robots | HIGH | Page has `noindex` tag but is blocked in `robots.txt`. Googlebot cannot see the noindex signal. | `robots.txt` disallow line, meta robots content |
| `RULE_SITEMAP_CONTAINS_NOINDEX` | Sitemap Contains Noindex URL | MEDIUM | XML sitemap lists a URL marked with `noindex`. | Sitemap URL, meta robots / X-Robots-Tag |

#### 3.2. Canonicalization
| Rule ID | Name | Severity | Description | Evidence Captured |
|---|---|---|---|---|
| `RULE_CANONICAL_TO_404` | Canonical Points to 404 | CRITICAL | Canonical link points to a non-existent URL. | Canonical URL, target HTTP status code |
| `RULE_CANONICAL_TO_REDIRECT` | Canonical Points to 3xx | HIGH | Canonical target redirects instead of serving 200 directly. | Canonical URL, redirect chain |
| `RULE_CANONICAL_LOOP` | Canonical Loop Detected | CRITICAL | Page A canonicalizes to B, B canonicalizes to A. | URL A, Canonical B, Canonical A |
| `RULE_MULTIPLE_CANONICALS` | Multiple Canonical Tags | HIGH | Page defines conflicting `<link rel="canonical">` or header tags. | Extracted canonical tags list |
| `RULE_CANONICAL_TO_NOINDEX` | Canonical to Noindex | HIGH | Canonical target possesses a `noindex` directive. | Target URL, target meta robots tag |

#### 3.3. Redirects
| Rule ID | Name | Severity | Description | Evidence Captured |
|---|---|---|---|---|
| `RULE_REDIRECT_CHAIN` | Redirect Chain (> 2 hops) | MEDIUM | URL redirects through multiple hops before final destination. | Full redirect chain array, latency per hop |
| `RULE_REDIRECT_LOOP` | Circular Redirect Loop | CRITICAL | Infinite redirect loop prevents crawling and page access. | Circular URL path array |
| `RULE_INTERNAL_LINK_TO_3XX` | Internal Link to Redirect | LOW | Site navigates internal users to redirecting URL instead of final canonical. | Anchor text, source URL, target redirect URL |

#### 3.4. Robots.txt & Sitemaps
| Rule ID | Name | Severity | Description | Evidence Captured |
|---|---|---|---|---|
| `RULE_ROBOTS_TXT_SYNTAX_ERROR` | Malformed Robots.txt | HIGH | Syntax errors prevent standard parser compliance. | Line number, offending text, error parser message |
| `RULE_SITEMAP_INVALID_XML` | Invalid XML Sitemap | HIGH | XML parsing failed; not standard XML format. | XML parse error, byte offset |
| `RULE_SITEMAP_OVER_LIMIT` | Sitemap Size Exceeded | MEDIUM | Sitemap exceeds 50,000 URLs or 50MB uncompressed limit. | URL count, uncompressed payload size |

#### 3.5. Titles & Meta Descriptions
| Rule ID | Name | Severity | Description | Evidence Captured |
|---|---|---|---|---|
| `RULE_TITLE_MISSING` | Missing `<title>` Tag | HIGH | Page has no title tag in `<head>`. | Head HTML snippet |
| `RULE_TITLE_EMPTY` | Empty `<title>` Tag | HIGH | `<title>` tag exists but contains only whitespace. | Title content length |
| `RULE_TITLE_DUPLICATE` | Duplicate Title Tag | MEDIUM | Identical title shared across multiple distinct canonical pages. | Competing URL list, title text |
| `RULE_META_DESC_MISSING` | Missing Meta Description | LOW | Meta description tag is missing. Google will auto-generate snippet. | Head HTML snippet |

#### 3.6. Headings & Content
| Rule ID | Name | Severity | Description | Evidence Captured |
|---|---|---|---|---|
| `RULE_H1_MISSING` | Missing H1 Heading | MEDIUM | Page contains no `<h1>` heading element. | Heading list in DOM |
| `RULE_H1_EMPTY` | Empty H1 Heading | LOW | `<h1>` element exists but has no visible text. | Outer HTML of H1 |
| `RULE_THIN_CONTENT_PROBABLE` | Very Low Word Count | MEDIUM | Main body text contains fewer than 100 words of indexable text. | Word count, main body text extract |

#### 3.7. Structured Data & Schema.org
| Rule ID | Name | Severity | Description | Evidence Captured |
|---|---|---|---|---|
| `RULE_SCHEMA_SYNTAX_ERROR` | Malformed JSON-LD | HIGH | `<script type="application/ld+json">` contains invalid JSON. | JSON parser error snippet |
| `RULE_SCHEMA_MISSING_REQUIRED`| Rich Result Missing Field | MEDIUM | Supported Schema type (e.g. `Product`, `Article`) lacks Google-required field. | Schema type, missing required property names |

#### 3.8. Hreflang & Internationalization
| Rule ID | Name | Severity | Description | Evidence Captured |
|---|---|---|---|---|
| `RULE_HREFLANG_NO_RETURN_LINK`| Missing Return Hreflang | HIGH | Page A references Page B as alternate, but B does not link back to A. | Page A URL, Page B URL, reciprocal hreflangs |
| `RULE_HREFLANG_INVALID_CODE` | Invalid Language/Region Code | MEDIUM | Hreflang code violates ISO 639-1 or ISO 3166-1 Alpha 2. | Given code, valid expected format |

---

### 4. Explicit Repudiation of SEO Myths
The platform explicitly enforces that the following common misconceptions are **NEVER** treated as hard errors:

1. **Title Length Myth:** "Title must be strictly 60 characters." *(Refuted: Google constructs title links based on screen size, query intent, and brand. Length is a UX heuristic only, not an error.)*
2. **Meta Description Myth:** "Meta description over 160 characters is an SEO violation." *(Refuted: Google truncates or replaces snippets dynamically based on search query.)*
3. **Multiple H1 Myth:** "Having two H1 tags destroys rankings." *(Refuted: Google engineers confirm multiple H1s are semantically valid in HTML5; not an error.)*
4. **Keyword Density Myth:** "Keyword density must be exactly 2-3%." *(Refuted: Keyword density is an obsolete 2000s tactic. Modern NLP and Google Search evaluate entity relevance and semantic context.)*
5. **Schema Ranking Myth:** "Adding schema markup guarantees higher ranking." *(Refuted: Schema enables rich result eligibility, not direct ranking boost.)*
6. **Canonical Directive Myth:** "Canonical is a directive Google must follow." *(Refuted: Canonical is a suggestion/hint. Google may ignore it if content strongly contradicts it.)*
