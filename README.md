# Autonomous AI SEO Platform (SEO Operating System)

A production-grade autonomous SEO operating system that crawls websites, deterministically detects technical SEO violations, prioritizes issues with Google Search Console data, grounds AI recommendations with official Level-1 documentation using hybrid RAG, safely applies changes via CMS/Git connectors, and continuously learns from empirical search outcomes.

---

## 1. Core Architecture & Intelligence Hierarchy

The platform strictly separates **deterministic technical verification** from **probabilistic AI reasoning**:

1. **Facts:** HTTP status codes, headers, robots directives, canonical tags, and DOM structure are verified exclusively via deterministic Python code.
2. **Deterministic SEO Rule Engine:** Evaluates 13 deterministic rules (canonical, robots/noindex, HTTP status, redirects, title/meta/H1, thin content, schema syntax) without AI involvement.
3. **Performance Signals:** Google Search Console API, CrUX p75 field data, Lighthouse audits.
4. **Trusted Knowledge:** Level-1 official documentation (Google Search Central, schema.org, W3C, RFCs).
5. **Hybrid RAG:** Dense pgvector embeddings + lexical full-text matching + Reciprocal Rank Fusion (RRF) + cross-encoder reranking.
6. **Specialist AI Agents:** Technical SEO, Content Quality, Internal Link Graph, Structured Data, and Strategy agents running under an Orchestrator.
7. **Safe Site Execution:** Reversible mutations with optimistic concurrency, pre-write backups, and immediate rollback triggers.

---

## 2. Directory Structure

```text
autonomous-ai-seo-platform/
├── apps/
│   ├── api/          # FastAPI async REST API (/api/v1)
│   ├── web/          # Next.js 14 App Router dashboard frontend
│   └── worker/       # Arq / Redis background worker
├── services/
│   ├── crawler/      # High-performance crawler, URL normalizer, SSRF guard
│   ├── seo_engine/   # Deterministic rule engine & health score calculator
│   ├── site_graph/   # NetworkX directed hyperlink graph & PageRank engine
│   ├── rag/          # Hybrid RAG, semantic chunker, deprecation engine
│   ├── agents/       # AI orchestrator & specialist agents (Technical, Content, Link)
│   ├── integrations/ # Google Search Console, CrUX, and Opportunity Engine
│   ├── executor/     # Site connectors (WordPress, Webhook) & Rollback engine
│   ├── experiments/  # Difference-in-Differences causal lift estimator & learning dataset
│   └── security/     # SSRF defense, AES-256-GCM encryption, Argon2id hashing
├── packages/
│   ├── config/       # Pydantic Settings
│   ├── contracts/    # Pydantic shared request/response models
│   └── shared/       # SQLAlchemy 2.0 database engine & 38 entity models
├── docs/             # 10 core specification documents & ADRs
│   └── decisions/    # Architecture Decision Records (ADR-001 through ADR-005)
├── tests/            # Pytest test suites (Unit, Integration, Security, Golden SEO)
└── infra/docker/     # Docker compose for local Postgres, Redis, MinIO, API & Web
```

---

## 3. Quick Start & Local Development

### 3.1. Prerequisites
- Python 3.12+
- Node.js 20+
- Docker & Docker Compose (optional for containerized setup)

### 3.2. Setup & Virtual Environment
```bash
# Clone or navigate to the project directory
cd autonomous-ai-seo-platform

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate  # On Windows
source .venv/bin/activate  # On Linux/macOS

# Install backend dependencies
pip install -r requirements.txt
pip install aiosqlite "pydantic[email]" email-validator
```

### 3.3. Initialize Database & Seed Knowledge Brain
```bash
# Initialize database schema and pre-load official Level-1 SEO guidelines & demo admin
python scripts/init_db.py

# Or force local SQLite database for quick development:
python scripts/init_db.py --sqlite
```
Default credentials created:
- **Email:** `admin@seo-platform.local`
- **Password:** `AdminPass123!`
- **Organization:** `Acme Digital Agency`

### 3.4. Run Tests
```bash
# Execute full automated test suite (84 unit, security, RAG, integration, and golden tests)
pytest -v
```

### 3.5. Run Local API Server
```bash
uvicorn apps.api.main:app --reload --port 8000
```
API Documentation will be accessible at: `http://localhost:8000/docs`

### 3.6. Run Next.js Frontend
```bash
cd apps/web
npm run dev
```
Dashboard will be accessible at: `http://localhost:3000` (including Knowledge Brain at `/knowledge`)

### 3.7. Run Autonomous RAG Curator
```bash
# Run continuous or simulated multi-day curation & fact verification
python scripts/run_rag_curator.py --days 3 --seed
```

### 3.8. Run with Docker Compose
```bash
# Single-command root execution:
docker compose up --build
```
This boots:
- PostgreSQL 16 with pgvector on port `5432`
- Redis 7 on port `6379`
- MinIO Object Storage on port `9000` (Console on `9001`)
- FastAPI Backend on port `8000`
- Next.js Web Application on port `3000`

---

## 4. Security & Isolation Highlights

- **SSRF & DNS Rebinding Protection:** The crawler automatically blocks requests to RFC 1918 private subnets, loopback addresses (`127.0.0.0/8`, `::1`), and cloud instance metadata services (`169.254.169.254`).
- **Prompt Injection Defense:** Untrusted crawled page contents are wrapped in explicit boundary demarcations and air-gapped from execution tools.
- **Safe Site Execution:** Mutations enforce pre-change content hash comparison, automatic pre-write snapshots, and atomic rollback on post-validation failures.
- **Envelope Encryption:** OAuth refresh tokens and CMS credentials are encrypted at rest using AES-256-GCM.

---

## 5. License & Standards
Built strictly in accordance with Google Search Central guidelines, RFC 9309 (Robots Exclusion Protocol), and W3C web standards.
