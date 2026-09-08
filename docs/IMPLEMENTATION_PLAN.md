# PROJECT IMPLEMENTATION PLAN
## Autonomous AI SEO Platform

### 1. Overview & Phased Roadmap
This document governs the engineering milestones for building the Autonomous AI SEO Platform. Every phase establishes strict architectural foundations, passes mandatory automated tests, and satisfies specific Definition of Done criteria before the subsequent phase commences.

```mermaid
gantt
    title Autonomous AI SEO Platform Implementation
    dateFormat  YYYY-MM-DD
    section Architectural Core
    Phase 0: Specifications & ADRs           :done, 2026-09-08, 1d
    Phase 1: Monorepo, DB, Auth & Tenant     :active, 2026-09-09, 3d
    Phase 2: Crawler & SSRF Defense          :2026-09-12, 3d
    section SEO Engine & Integrations
    Phase 3: Deterministic Rule Engine       :2026-09-15, 3d
    Phase 4: GSC, CrUX & Lighthouse          :2026-09-18, 3d
    Phase 5: Knowledge Brain & Hybrid RAG    :2026-09-21, 4d
    section AI & Site Graph
    Phase 6: AI Orchestrator & Agents        :2026-09-25, 3d
    Phase 7: Site Graph & Internal Linking   :2026-09-28, 2d
    section Execution & Production
    Phase 8: Connectors, Execution & Rollback:2026-09-30, 3d
    Phase 9: Experiments & Learning Dataset  :2026-10-03, 2d
    Phase 10: Observability, Hardening & CI  :2026-10-05, 3d
```

---

### 2. Phase Breakdown & Deliverables

#### Phase 0: Architecture, Data Models & Security Specifications (Completed)
- [x] Create 10 core specification documents.
- [x] Create 5 Architecture Decision Records (ADRs).
- [x] Define multi-tenant relational schemas and database indexes.
- [x] Define SSRF and prompt injection mitigation boundaries.

#### Phase 1: Monorepo Foundation, Database, Auth & Multi-Tenancy
- **Components:**
  - Setup Python 3.12+ project with Poetry/UV, FastAPI backend in `apps/api`.
  - Next.js 14+ App Router frontend scaffolding in `apps/web`.
  - SQLAlchemy 2.0 async models for all 38 tables, Alembic migration scripts.
  - JWT authentication, password hashing (Argon2), user registration and login endpoints.
  - Multi-tenant Organization and Membership RBAC endpoints.
  - Site onboarding, domain normalization, and site verification endpoints.
- **Verification Gate:**
  - Backend and frontend startup tests.
  - Alembic migrations execute cleanly up and down.
  - Tenant isolation unit and integration tests passing.

#### Phase 2: Production Crawler, URL Normalization & SSRF Defense
- **Components:**
  - `SafeHttpClient` with DNS pre-resolution and IP blacklist filtering.
  - URL Normalizer module handling queries, tracking params, and schemes.
  - XML Sitemap and Sitemap Index stream parser.
  - `robots.txt` parser compliant with Googlebot specifications.
  - HTML extraction engine (`selectolax`) extracting titles, meta, canonicals, headings, links, and schemas.
  - Playwright fallback renderer for SPA / hydration targets.
  - MinIO / S3 object storage integration for HTML snapshots.
- **Verification Gate:**
  - SSRF test suite: attempts against `127.0.0.1`, `169.254.169.254`, `10.0.0.1`, and DNS rebinding simulations correctly blocked.
  - Crawler extracts accurate DOM structures from local test fixtures.

#### Phase 3: Deterministic SEO Rule Engine & Page Explorer
- **Components:**
  - `SeoRule` abstract base class and 21 rule category implementations.
  - Deterministic evaluation pipeline outputting structured `Issue` and `Evidence` objects.
  - Page Explorer API providing granular crawl metrics and issue occurrences.
- **Verification Gate:**
  - 100% test coverage against SEO Golden Test fixtures (canonical loops, redirect chains, broken links, robots blocks).

#### Phase 4: Integrations (Google Search Console, CrUX, Lighthouse)
- **Components:**
  - Google OAuth2 flow with encrypted token persistence at rest.
  - GSC Search Analytics synchronization worker.
  - GSC URL Inspection API quota manager and sampling engine.
  - CrUX API client for 75th percentile Core Web Vitals (LCP, INP, CLS).
  - Lighthouse headless audit runner.
  - GSC Opportunity Engine (high impressions + low CTR, keyword cannibalization detection).
- **Verification Gate:**
  - Mocked integration tests asserting data ingestion and opportunity generation.

#### Phase 5: SEO Knowledge Brain & Hybrid RAG Engine
- **Components:**
  - Ingestion pipeline for Level 1 official guidelines (Google Search Central, schema.org).
  - Semantic heading-based chunker with hierarchical context paths.
  - `pgvector` dense embedding store + PostgreSQL `tsvector` full-text index.
  - Reciprocal Rank Fusion (RRF) candidate merger.
  - Cross-encoder reranker.
  - Freshness checking cron and deprecation engine.
- **Verification Gate:**
  - RAG evaluation suite: Recall@5 >= 0.85, MRR >= 0.90, zero citations of deprecated guidance.

#### Phase 6: AI Orchestrator & Specialist Agents
- **Components:**
  - LLM Provider Abstraction layer (`LLMProvider`).
  - Orchestrator managing Technical, Content, InternalLink, StructuredData, and Strategy specialists.
  - Pydantic structured output validation and automatic retry mechanism.
  - Multi-factor priority scoring engine ($0-100$).
  - Prompt injection air-gap isolation.
- **Verification Gate:**
  - Adversarial prompt injection tests: malicious web page text fails to alter agent behavior or trigger actions.

#### Phase 7: Site Graph & Internal Linking Engine
- **Components:**
  - NetworkX directed graph representation of site hyperlinks.
  - Graph algorithms: PageRank, click depth calculation, hub detection, isolated cluster identification.
  - Internal link opportunity generator matching high-authority pages to orphan targets.
- **Verification Gate:**
  - Graph unit tests verifying correct PageRank and click depth on synthetic link matrices.

#### Phase 8: Connectors, Safe Execution & Rollback Engine
- **Components:**
  - `SiteConnector` interface.
  - `WordPressConnector`, `GitBasedConnector`, and `GenericWebhookConnector`.
  - Optimistic concurrency control (pre-execution content hash verification).
  - Pre-write S3 snapshot backup system.
  - Post-write automated validation and instant atomic rollback trigger.
- **Verification Gate:**
  - End-to-end mutation test: Apply -> Validate -> Rollback -> Verify state perfectly restored.

#### Phase 9: Experiment Engine & Learning Dataset
- **Components:**
  - Cohort assignment (Variant vs Control pages).
  - 28/56/90-day baseline comparison module.
  - Causal impact estimator discounting algorithmic updates and seasonality.
  - Event-sourced Learning Dataset logging empirical outcome records.
- **Verification Gate:**
  - Statistical testing assertions verifying difference-in-differences calculations.

#### Phase 10: Observability, Security Hardening & Production Readiness
- **Components:**
  - Structured JSON logging with correlation IDs (`crawl_id`, `site_id`, `request_id`).
  - OpenTelemetry tracing instrumentation.
  - Synthetic load testing (10,000+ page crawls).
  - Degraded mode fallbacks (system runs if LLM or GSC is offline).
  - GitHub Actions CI/CD workflow.
  - Comprehensive README and operational manual.
- **Verification Gate:**
  - Complete checklist against the 175 Definition of Done requirements.
