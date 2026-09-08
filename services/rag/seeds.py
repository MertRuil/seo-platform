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
        "id": "doc-xml-sitemaps",
        "title": "Google Search Central: XML Sitemaps Protocol",
        "canonical_url": "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "ACTIVE",
        "content": """# XML Sitemaps Protocol and Architecture
## Sitemap Purpose and Limits
A sitemap tells search engines which pages and files you think are important on your site, and provides valuable information about these files.
A single sitemap file cannot exceed 50,000 URLs and must not be larger than 50 MB uncompressed. Use a sitemap index file if your site exceeds these limits.

## Inclusion Guidelines
Include only canonical, indexable URLs that return HTTP 200 OK. Never include URLs returning 4xx, 5xx, 3xx redirects, or pages with noindex directives.
Keep the 'lastmod' attribute accurate. Do not update lastmod timestamps without substantial content changes.
"""
    },
    {
        "id": "doc-hreflang-internationalization",
        "title": "Google Search Central: International & Multilingual SEO (Hreflang)",
        "canonical_url": "https://developers.google.com/search/docs/specialty/international/localized-versions",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "ACTIVE",
        "content": """# Managing Multi-Regional and Multilingual Sites (Hreflang)
## Bidirectional Linking Requirement
Every language alternate URL must reciprocally link back to all other language versions, including a self-referential hreflang link. If Page A links to Page B, Page B must link to Page A.

## x-default Fallback
Use 'x-default' for unlocalized fallback pages (such as country selector pages or global homepages).

## ISO Language and Region Codes
Language codes must follow ISO 639-1 format, and optional country/region codes must follow ISO 3166-1 Alpha 2 format. Script codes must follow ISO 15924.
"""
    },
    {
        "id": "doc-javascript-seo",
        "title": "Google Search Central: JavaScript SEO & Rendering Basics",
        "canonical_url": "https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "ACTIVE",
        "content": """# JavaScript SEO & Rendering Pipeline
## Two-Stage Processing Pipeline
Googlebot processes JavaScript web applications in two stages: crawling and rendering. If rendering fails or times out, Googlebot cannot see links, images, or text injected solely by clientside JS.

## Server-Side Rendering (SSR) & Static Generation
Server-Side Rendering (SSR) or Static Site Generation (SSG) is strongly recommended for critical content and hyperlinks. Ensure that critical metadata (titles, canonicals, robots tags) is delivered in the initial HTTP response HTML.

## Dynamic Rendering Deprecation
Dynamic rendering is no longer recommended by Google as a long-term solution. Sites should adopt modern SSR or Hydration frameworks.
"""
    },
    {
        "id": "doc-http-status-codes",
        "title": "Google Search Central: HTTP Status Codes & Redirects",
        "canonical_url": "https://developers.google.com/search/docs/crawling-indexing/http-network-errors",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "ACTIVE",
        "content": """# HTTP Status Codes for Search Crawling and Indexing
## 301 vs 302 Redirects
A 301 (Moved Permanently) redirect signals permanent movement and passes ranking signals (PageRank) to the destination. A 302 (Found) signals temporary movement and retains ranking signals on the source URL.
Use 308 for permanent redirects preserving HTTP methods, and 307 for temporary redirects.

## 404 Not Found vs 410 Gone
Both 404 and 410 drop URLs from the index. A 410 explicitly confirms intentional permanent removal and may result in faster removal from search indices than repeated 404s.

## 503 Service Unavailable
Use 503 with a 'Retry-After' header when performing server maintenance to tell Googlebot to return later without de-indexing URLs.
"""
    },
    {
        "id": "doc-crawl-budget-optimization",
        "title": "Google Search Central: Large Site Crawl Budget Management",
        "canonical_url": "https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "ACTIVE",
        "content": """# Managing Crawl Budget on Enterprise Websites
## Crawl Capacity vs Crawl Demand
Crawl budget is determined by host load capacity (server speed and stability) and crawl demand (page popularity and update frequency).

## Preventing Crawl Traps
Faceted navigation, infinite calendars, session IDs in URLs, and internal search result pages waste crawl budget.
Block infinite parameter combinations in robots.txt or consolidate via canonical tags and URL parameter configurations.
"""
    },
    {
        "id": "doc-helpful-content-eeat",
        "title": "Google Search Central: Creating Helpful, Reliable, People-First Content",
        "canonical_url": "https://developers.google.com/search/docs/fundamentals/creating-helpful-content",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "ACTIVE",
        "content": """# Creating Helpful Content and E-E-A-T
## Experience, Expertise, Authoritativeness, and Trust (E-E-A-T)
Trust is the most critical component of E-E-A-T. Content must demonstrate first-hand experience, clear author attribution, transparent sourcing, and genuine editorial accuracy.

## Avoiding Search-Engine-First Content
Do not produce content primarily for search engines or use automation to generate content on various unrelated topics without real human expertise.
Avoid thin doorway pages designed solely to capture search traffic without delivering comprehensive answers.
"""
    },
    {
        "id": "doc-internal-linking-architecture",
        "title": "Google Search Central: Crawlable Links & Information Architecture",
        "canonical_url": "https://developers.google.com/search/docs/crawling-indexing/links-crawlable",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "ACTIVE",
        "content": """# Making Links Crawlable and Link Architecture
## Crawlable <a> href Elements
Googlebot can follow links only if they are an <a> tag with an href attribute containing a valid, crawlable URL. Links created via Javascript onClick events without href attributes cannot be crawled reliably.

## Descriptive Anchor Text
Use concise, specific, descriptive anchor text that provides context about the destination page. Avoid generic terms like 'click here' or 'read more'.

## Preventing Orphan Pages
Every important page on a website should be discoverable through internal hyperlinks within a reasonable click depth (ideally 3 clicks from the homepage).
"""
    },
    {
        "id": "doc-mobile-first-indexing",
        "title": "Google Search Central: Mobile-First Indexing Best Practices",
        "canonical_url": "https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "ACTIVE",
        "content": """# Mobile-First Indexing Standards
## DOM Parity Between Mobile and Desktop
Google predominantly uses the mobile version of a page's content for indexing and ranking. Ensure that the mobile page contains the same content, headings, structured data, and metadata as the desktop version.

## Responsive Web Design Preferred
Use responsive web design (RWD) with a properly configured viewport meta tag (<meta name="viewport" content="width=device-width, initial-scale=1">). Avoid separate m-dot subdomains whenever possible.
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
    },
    {
        "id": "doc-deprecated-rel-next-prev",
        "title": "Google Search: rel=next and rel=prev Pagination Annotations (Deprecated)",
        "canonical_url": "https://developers.google.com/search/docs/historical/rel-next-prev",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "DEPRECATED",
        "content": """# Pagination with rel=next and rel=prev
## Obsolete Directive
Google officially retired rel=next and rel=prev as an indexing signal in spring 2019. Google now treats paginated pages as standalone pages and relies on standard internal links.
"""
    },
    {
        "id": "doc-deprecated-amp-requirement",
        "title": "Google Search: AMP Requirement for Top Stories (Retired)",
        "canonical_url": "https://developers.google.com/search/docs/historical/amp-top-stories",
        "authority_level": "LEVEL_1_OFFICIAL",
        "status": "DEPRECATED",
        "content": """# AMP Requirement for Top Stories Carousel
## Policy Change
Google previously required Accelerated Mobile Pages (AMP) format for articles to appear in the mobile Top Stories carousel. This requirement was removed in 2021 with the Page Experience update; any page meeting Core Web Vitals and general search guidelines is eligible.
"""
    }
]
