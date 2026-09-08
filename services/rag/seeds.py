from typing import List, Dict, Any

SEED_DOCUMENTS: List[Dict[str, Any]] = [
    {
        "id": "doc-canonical-guidelines",
        "title": "Google Search Central: Consolidate Duplicate URLs",
        "canonical_url": "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "ACTIVE",
        "content": """# Consolidate Duplicate URLs (Canonicalization)
## Why Canonicalization Matters
If you have a single page accessible by multiple URLs, or different pages with similar content, Google sees these as duplicate versions of the same page. Google chooses one URL as the canonical version and crawls that, and all other URLs are considered duplicate URLs and crawled less often.

## How Google Chooses a Canonical URL
Google uses various signals to determine the canonical page, including rel=canonical tags, redirects, sitemaps, internal links, and page content similarity. The rel="canonical" link element is a strong hint for search engines, but it is not an absolute directive. If a page canonicalizes to a 404 page or a redirecting URL, Google is likely to ignore the canonical tag.

## Canonicalization Best Practices
Do not use robots.txt for canonicalization. Robots.txt does not prevent a URL from being indexed if other pages link to it.
Specify canonical URLs explicitly on all pages using absolute URLs. Self-referential canonicals are strongly recommended. Avoid canonical chains and circular loops.
"""
    },
    {
        "id": "doc-robots-txt-specification",
        "title": "Google Search Central: Robots.txt Specifications",
        "canonical_url": "https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "ACTIVE",
        "content": """# Robots.txt Specifications (RFC 9309)
## How Googlebot Interprets Robots.txt
A robots.txt file tells search engine crawlers which URLs the crawler can access on your site. This is used mainly to avoid overloading your site with requests. It is not a mechanism for keeping a web page out of Google.

## Blocking vs Noindex
To keep a web page out of Google, use noindex directives (via meta robots or X-Robots-Tag).
Important: If a page is blocked with a robots.txt file, Googlebot cannot crawl the page to see the noindex meta tag. As a result, the page may still appear in search results if other pages link to it with anchor text.

## Googlebot User-Agent Matching
Googlebot matches the most specific user-agent group applicable. If no Googlebot group exists, it falls back to the '*' wildcard group. Matching follows longest-prefix matching rules.
"""
    },
    {
        "id": "doc-structured-data",
        "title": "Google Search Central: Structured Data & Schema.org",
        "canonical_url": "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "ACTIVE",
        "content": """# Structured Data General Guidelines
## JSON-LD Format Preferred
Google Search supports structured data in JSON-LD, Microdata, and RDFa formats. JSON-LD is strongly recommended because it is decoupled from page layout and easy to maintain.

## Eligibility for Rich Results
Providing structured data allows search engines to understand the page content and enables special search result features (rich results) such as Breadcrumbs, Articles, FAQs, Products, and Reviews.

## Relevance and Quality Guidelines
Do not mark up content that is not visible to human readers. Avoid creating fake reviews, misleading prices, or structured data for spam purposes. All properties must be accurate and truthful.
"""
    },
    {
        "id": "doc-robots-meta-tags",
        "title": "Google Search Central: Robots Meta Tags & X-Robots-Tag",
        "canonical_url": "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "ACTIVE",
        "content": """# Robots Meta Tags and X-Robots-Tag HTTP Header
## Directives for Indexing Control
The 'noindex' directive prevents search engines from indexing the page. The 'nofollow' directive tells crawlers not to follow links on this page.
The 'max-snippet', 'max-image-preview', and 'max-video-preview' directives control how search snippets are displayed.

## Crawling vs Indexing Nuance
A robots meta tag with 'noindex' requires Googlebot to crawl the page to read the directive. If the URL is disallowed in robots.txt, Google cannot see the noindex tag.
"""
    },
    {
        "id": "doc-core-web-vitals",
        "title": "W3C & Google: Core Web Vitals (CWV) Standards",
        "canonical_url": "https://developers.google.com/search/docs/appearance/core-web-vitals",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "ACTIVE",
        "content": """# Core Web Vitals Thresholds and Metrics
## Largest Contentful Paint (LCP)
LCP measures perceived loading speed. A good LCP is 2.5 seconds or less for the 75th percentile of page visits.

## Interaction to Next Paint (INP)
INP measures page responsiveness to user interactions. A good INP is 200 milliseconds or less.

## Cumulative Layout Shift (CLS)
CLS measures visual stability. A good CLS score is 0.1 or less.
"""
    },
    {
        "id": "doc-deprecated-preferred-domain",
        "title": "Google Search Console: Preferred Domain Setting (Legacy)",
        "canonical_url": "https://developers.google.com/search/docs/historical/preferred-domain",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "DEPRECATED",
        "content": """# Preferred Domain Configuration
## Historical Note
Google Search Console previously provided a setting to select between www and non-www as the preferred domain. This setting has been retired and is no longer supported. Use server-side 301 redirects and canonical tags instead.
"""
    },
    {
        "id": "doc-deprecated-meta-keywords",
        "title": "Google Search: Meta Keywords Tag Support (Deprecated)",
        "canonical_url": "https://developers.google.com/search/docs/historical/meta-keywords",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "DEPRECATED",
        "content": """# Meta Keywords Tag
## Obsolete Tag
Google does not use the meta keywords tag in web search ranking. This tag has been completely ignored for over a decade. Sites should not spend effort adding keywords meta tags.
"""
    }
]
