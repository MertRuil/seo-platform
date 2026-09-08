# DATABASE SCHEMA SPECIFICATION
## Autonomous AI SEO Platform

### 1. Database Architecture & Storage Engine
- **Primary Relational Store:** PostgreSQL 16+
- **Vector Storage:** `pgvector` extension (HNSW index for cosine distance similarity `vector_cosine_ops`)
- **Full-Text Search:** PostgreSQL `tsvector` with Turkish & English language configurations
- **Multi-Tenancy Isolation:** Row Level Security (RLS) enforcement tied to `current_setting('app.current_org_id')` and mandatory `organization_id` foreign keys.
- **Large Objects / HTML Storage:** PostgreSQL stores relational metadata, hash digests (`raw_html_hash`, `rendered_html_hash`), and structured extracts. Raw and rendered HTML blobs, DOM trees, and screenshots are offloaded to S3-compatible Object Storage (`MinIO` / `S3`).

---

### 2. Core Enumerations (PostgreSQL ENUM types)

```sql
CREATE TYPE user_role AS ENUM ('OWNER', 'ADMIN', 'SEO_MANAGER', 'EDITOR', 'VIEWER');
CREATE TYPE site_type AS ENUM ('LOCAL_BUSINESS', 'ECOMMERCE', 'SAAS', 'BLOG', 'NEWS', 'CORPORATE', 'MARKETPLACE', 'OTHER');
CREATE TYPE verification_method AS ENUM ('DNS_TXT', 'HTML_FILE', 'META_TAG', 'GSC_OAUTH');
CREATE TYPE verification_status AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'FAILED');
CREATE TYPE crawl_mode AS ENUM ('GOOGLEBOT_SIMULATION', 'OWNER_AUDIT');
CREATE TYPE crawl_status AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE issue_severity AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE risk_level AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE execution_mode AS ENUM ('SUGGEST_ONLY', 'REVIEW_ALL', 'AUTO_LOW_RISK', 'AUTO_LOW_AND_APPROVED_MEDIUM');
CREATE TYPE change_set_status AS ENUM ('DRAFT', 'WAITING_APPROVAL', 'APPROVED', 'EXECUTING', 'SUCCESS', 'FAILED', 'ROLLED_BACK', 'CANCELLED');
CREATE TYPE connector_type AS ENUM ('WORDPRESS_REST', 'GIT_PR', 'GENERIC_WEBHOOK');
CREATE TYPE knowledge_authority AS ENUM ('LEVEL_1_OFFICIAL', 'LEVEL_2_HIGH_QUALITY', 'LEVEL_3_INDUSTRY', 'LEVEL_4_COMMUNITY');
CREATE TYPE knowledge_status AS ENUM ('ACTIVE', 'DEPRECATED', 'REMOVED', 'HISTORICAL');
```

---

### 3. Core Tables Specification (38 Entities)

#### 3.1. Identity, Tenant & Access Management
1. **`users`**
   - `id` (UUID, PK)
   - `email` (VARCHAR(255), UNIQUE, NOT NULL)
   - `hashed_password` (VARCHAR(255), NOT NULL)
   - `full_name` (VARCHAR(255))
   - `is_active` (BOOLEAN, DEFAULT true)
   - `is_platform_admin` (BOOLEAN, DEFAULT false)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

2. **`organizations`**
   - `id` (UUID, PK)
   - `name` (VARCHAR(255), NOT NULL)
   - `slug` (VARCHAR(255), UNIQUE, NOT NULL)
   - `monthly_token_budget` (INTEGER, DEFAULT 1000000)
   - `tokens_used_this_month` (INTEGER, DEFAULT 0)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

3. **`memberships`**
   - `id` (UUID, PK)
   - `user_id` (UUID, FK `users.id`, ON DELETE CASCADE)
   - `organization_id` (UUID, FK `organizations.id`, ON DELETE CASCADE)
   - `role` (`user_role`, NOT NULL)
   - UNIQUE(`user_id`, `organization_id`)

#### 3.2. Site Management & Connectors
4. **`sites`**
   - `id` (UUID, PK)
   - `organization_id` (UUID, FK `organizations.id`, INDEX)
   - `name` (VARCHAR(255), NOT NULL)
   - `domain` (VARCHAR(255), NOT NULL)
   - `normalized_domain` (VARCHAR(255), NOT NULL, INDEX)
   - `primary_url` (TEXT, NOT NULL)
   - `preferred_protocol` (VARCHAR(10), DEFAULT 'https')
   - `site_type` (`site_type`, DEFAULT 'OTHER')
   - `language` (VARCHAR(10), DEFAULT 'tr')
   - `country` (VARCHAR(10), DEFAULT 'TR')
   - `timezone` (VARCHAR(50), DEFAULT 'UTC')
   - `cms_type` (VARCHAR(50))
   - `execution_mode` (`execution_mode`, DEFAULT 'REVIEW_ALL')
   - `verification_status` (`verification_status`, DEFAULT 'UNVERIFIED')
   - `created_at`, `updated_at` (TIMESTAMPTZ)

5. **`site_verifications`**
   - `id` (UUID, PK)
   - `site_id` (UUID, FK `sites.id`, ON DELETE CASCADE)
   - `method` (`verification_method`, NOT NULL)
   - `token` (VARCHAR(255), NOT NULL)
   - `status` (`verification_status`, NOT NULL)
   - `last_checked_at` (TIMESTAMPTZ)
   - `verified_at` (TIMESTAMPTZ)

6. **`site_connectors`**
   - `id` (UUID, PK)
   - `site_id` (UUID, FK `sites.id`, ON DELETE CASCADE)
   - `connector_type` (`connector_type`, NOT NULL)
   - `encrypted_credentials` (BYTEA, NOT NULL) -- AES-256-GCM encrypted
   - `base_url` (TEXT)
   - `capabilities` (JSONB, NOT NULL) -- e.g. ["CAN_EDIT_TITLE", "CAN_EDIT_META", "CAN_EDIT_SCHEMA"]
   - `is_active` (BOOLEAN, DEFAULT true)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

7. **`integrations`**
   - `id` (UUID, PK)
   - `organization_id` (UUID, FK `organizations.id`)
   - `provider` (VARCHAR(50), NOT NULL) -- 'GOOGLE_SEARCH_CONSOLE', 'CRUX', 'LIGHTHOUSE'
   - `status` (VARCHAR(50), NOT NULL)
   - `config` (JSONB)
   - `created_at`, `updated_at` (TIMESTAMPTZ)

8. **`oauth_credentials`**
   - `id` (UUID, PK)
   - `organization_id` (UUID, FK `organizations.id`)
   - `provider` (VARCHAR(50), NOT NULL)
   - `encrypted_access_token` (BYTEA, NOT NULL)
   - `encrypted_refresh_token` (BYTEA, NOT NULL)
   - `token_expiry` (TIMESTAMPTZ, NOT NULL)
   - `scopes` (TEXT[], NOT NULL)

#### 3.3. Crawler, Pages & Graph
9. **`crawl_runs`**
   - `id` (UUID, PK)
   - `site_id` (UUID, FK `sites.id`, INDEX)
   - `crawl_mode` (`crawl_mode`, NOT NULL)
   - `status` (`crawl_status`, NOT NULL)
   - `total_urls_discovered` (INTEGER, DEFAULT 0)
   - `total_urls_crawled` (INTEGER, DEFAULT 0)
   - `total_errors` (INTEGER, DEFAULT 0)
   - `max_pages` (INTEGER, DEFAULT 1000)
   - `max_depth` (INTEGER, DEFAULT 5)
   - `started_at`, `finished_at` (TIMESTAMPTZ)

10. **`crawl_pages`**
    - `id` (UUID, PK)
    - `crawl_run_id` (UUID, FK `crawl_runs.id`, INDEX)
    - `site_id` (UUID, FK `sites.id`, INDEX)
    - `url` (TEXT, NOT NULL)
    - `normalized_url` (TEXT, NOT NULL, INDEX)
    - `depth` (INTEGER, NOT NULL)
    - `status_code` (INTEGER, NOT NULL)
    - `content_type` (VARCHAR(100))
    - `response_time_ms` (INTEGER)
    - `is_fetchable` (BOOLEAN, NOT NULL)
    - `is_crawlable_by_google` (BOOLEAN, NOT NULL)
    - `has_noindex` (BOOLEAN, NOT NULL)
    - `is_indexable_candidate` (BOOLEAN, NOT NULL)
    - `canonical_target` (TEXT)
    - `is_canonical` (BOOLEAN)
    - `in_sitemap` (BOOLEAN, DEFAULT false)
    - `title` (TEXT)
    - `meta_description` (TEXT)
    - `h1_tags` (TEXT[])
    - `word_count` (INTEGER)
    - `raw_html_hash` (CHAR(64))
    - `main_content_hash` (CHAR(64))
    - `s3_raw_html_key` (TEXT)
    - `s3_rendered_html_key` (TEXT)
    - `created_at` (TIMESTAMPTZ)

11. **`page_snapshots`**
    - `id` (UUID, PK)
    - `site_id` (UUID, FK `sites.id`, INDEX)
    - `normalized_url` (TEXT, NOT NULL, INDEX)
    - `crawl_run_id` (UUID, FK `crawl_runs.id`)
    - `snapshot_hash` (CHAR(64), NOT NULL)
    - `metadata_snapshot` (JSONB, NOT NULL)
    - `created_at` (TIMESTAMPTZ)

12. **`redirects`**
    - `id` (UUID, PK)
    - `crawl_run_id` (UUID, FK `crawl_runs.id`)
    - `source_url` (TEXT, NOT NULL)
    - `target_url` (TEXT, NOT NULL)
    - `status_code` (INTEGER, NOT NULL)
    - `is_chain` (BOOLEAN, DEFAULT false)
    - `is_loop` (BOOLEAN, DEFAULT false)
    - `chain_depth` (INTEGER, DEFAULT 1)

13. **`links` (Directed Graph Edges)**
    - `id` (UUID, PK)
    - `crawl_run_id` (UUID, FK `crawl_runs.id`)
    - `site_id` (UUID, FK `sites.id`, INDEX)
    - `source_page_id` (UUID, FK `crawl_pages.id`, INDEX)
    - `target_url` (TEXT, NOT NULL)
    - `target_page_id` (UUID, FK `crawl_pages.id`, NULLABLE, INDEX)
    - `anchor_text` (TEXT)
    - `rel` (VARCHAR(100))
    - `is_internal` (BOOLEAN, NOT NULL)
    - `is_follow` (BOOLEAN, DEFAULT true)

14. **`images`**
    - `id` (UUID, PK)
    - `crawl_page_id` (UUID, FK `crawl_pages.id`)
    - `src` (TEXT, NOT NULL)
    - `alt` (TEXT)
    - `loading` (VARCHAR(20))
    - `width` (INTEGER), `height` (INTEGER)

15. **`structured_data_items`**
    - `id` (UUID, PK)
    - `crawl_page_id` (UUID, FK `crawl_pages.id`)
    - `format` (VARCHAR(20)) -- 'JSON-LD', 'MICRODATA', 'RDFA'
    - `schema_type` (VARCHAR(100), NOT NULL)
    - `raw_json` (JSONB, NOT NULL)
    - `is_valid` (BOOLEAN, NOT NULL)
    - `validation_errors` (TEXT[])

16. **`sitemaps`**
    - `id` (UUID, PK)
    - `site_id` (UUID, FK `sites.id`)
    - `url` (TEXT, NOT NULL)
    - `is_index` (BOOLEAN, DEFAULT false)
    - `total_urls` (INTEGER, DEFAULT 0)
    - `last_parsed_at` (TIMESTAMPTZ)

17. **`sitemap_urls`**
    - `id` (UUID, PK)
    - `sitemap_id` (UUID, FK `sitemaps.id`, ON DELETE CASCADE)
    - `loc` (TEXT, NOT NULL, INDEX)
    - `lastmod` (TIMESTAMPTZ)
    - `changefreq` (VARCHAR(20))
    - `priority` (NUMERIC(3,2))

#### 3.4. Deterministic SEO Rules & Issues
18. **`seo_rules`**
    - `id` (VARCHAR(100), PK) -- e.g. 'RULE_CANONICAL_TO_404'
    - `name` (VARCHAR(255), NOT NULL)
    - `category` (VARCHAR(100), NOT NULL, INDEX)
    - `description` (TEXT, NOT NULL)
    - `default_severity` (`issue_severity`, NOT NULL)
    - `documentation_url` (TEXT)
    - `version` (INTEGER, DEFAULT 1)

19. **`issues`**
    - `id` (UUID, PK)
    - `site_id` (UUID, FK `sites.id`, INDEX)
    - `rule_id` (VARCHAR(100), FK `seo_rules.id`)
    - `rule_version` (INTEGER, NOT NULL)
    - `category` (VARCHAR(100), NOT NULL)
    - `severity` (`issue_severity`, NOT NULL)
    - `title` (TEXT, NOT NULL)
    - `description` (TEXT, NOT NULL)
    - `status` (VARCHAR(50), DEFAULT 'OPEN') -- 'OPEN', 'RESOLVED', 'IGNORED'
    - `created_at`, `updated_at` (TIMESTAMPTZ)

20. **`issue_occurrences`**
    - `id` (UUID, PK)
    - `issue_id` (UUID, FK `issues.id`, ON DELETE CASCADE)
    - `crawl_page_id` (UUID, FK `crawl_pages.id`)
    - `url` (TEXT, NOT NULL, INDEX)
    - `evidence` (JSONB, NOT NULL) -- Raw code / header proof
    - `created_at` (TIMESTAMPTZ)

#### 3.5. Recommendations, ChangeSets & Execution
21. **`recommendations`**
    - `id` (UUID, PK)
    - `site_id` (UUID, FK `sites.id`, INDEX)
    - `issue_id` (UUID, FK `issues.id`, NULLABLE)
    - `category` (VARCHAR(100), NOT NULL)
    - `title` (TEXT, NOT NULL)
    - `description` (TEXT, NOT NULL)
    - `reason` (TEXT, NOT NULL)
    - `expected_impact` (TEXT)
    - `confidence` (NUMERIC(3,2), NOT NULL)
    - `priority_score` (NUMERIC(5,2), NOT NULL, INDEX)
    - `risk_level` (`risk_level`, NOT NULL)
    - `effort` (VARCHAR(20)) -- 'LOW', 'MEDIUM', 'HIGH'
    - `evidence` (JSONB, NOT NULL)
    - `rag_sources` (JSONB) -- References to knowledge_chunks
    - `status` (VARCHAR(50), DEFAULT 'PENDING')
    - `created_at` (TIMESTAMPTZ)

22. **`action_plans`**
    - `id` (UUID, PK)
    - `site_id` (UUID, FK `sites.id`)
    - `title` (VARCHAR(255), NOT NULL)
    - `horizon` (VARCHAR(20)) -- '30_DAY', '60_DAY', '90_DAY'
    - `items` (JSONB, NOT NULL)
    - `created_at` (TIMESTAMPTZ)

23. **`change_sets`**
    - `id` (UUID, PK)
    - `site_id` (UUID, FK `sites.id`, INDEX)
    - `recommendation_id` (UUID, FK `recommendations.id`)
    - `status` (`change_set_status`, DEFAULT 'DRAFT')
    - `risk_level` (`risk_level`, NOT NULL)
    - `created_by` (UUID, FK `users.id`)
    - `approved_by` (UUID, FK `users.id`, NULLABLE)
    - `created_at`, `approved_at`, `executed_at` (TIMESTAMPTZ)

24. **`change_items`**
    - `id` (UUID, PK)
    - `change_set_id` (UUID, FK `change_sets.id`, ON DELETE CASCADE)
    - `target_url` (TEXT, NOT NULL)
    - `operation` (VARCHAR(50), NOT NULL) -- 'UPDATE_TITLE', 'UPDATE_CANONICAL', etc.
    - `state_before` (JSONB, NOT NULL)
    - `state_after` (JSONB, NOT NULL)
    - `expected_hash_before` (CHAR(64), NOT NULL) -- Optimistic concurrency check
    - `status` (VARCHAR(50), DEFAULT 'PENDING')

25. **`executions`**
    - `id` (UUID, PK)
    - `change_set_id` (UUID, FK `change_sets.id`)
    - `connector_id` (UUID, FK `site_connectors.id`)
    - `backup_snapshot_key` (TEXT, NOT NULL) -- Pre-change state key in S3
    - `started_at`, `completed_at` (TIMESTAMPTZ)
    - `status` (VARCHAR(50), NOT NULL)
    - `post_validation_result` (JSONB)
    - `error_message` (TEXT)

26. **`rollbacks`**
    - `id` (UUID, PK)
    - `execution_id` (UUID, FK `executions.id`)
    - `triggered_by` (UUID, FK `users.id`, NULLABLE)
    - `reason` (TEXT, NOT NULL)
    - `status` (VARCHAR(50), NOT NULL)
    - `executed_at` (TIMESTAMPTZ)

#### 3.6. Performance & Integrations (GSC, CrUX, Lighthouse)
27. **`gsc_properties`**
    - `id` (UUID, PK)
    - `site_id` (UUID, FK `sites.id`, UNIQUE)
    - `property_url` (TEXT, NOT NULL)
    - `permission_level` (VARCHAR(50), NOT NULL)

28. **`gsc_search_metrics`**
    - `id` (UUID, PK)
    - `site_id` (UUID, FK `sites.id`, INDEX)
    - `date` (DATE, NOT NULL, INDEX)
    - `query` (TEXT, NOT NULL, INDEX)
    - `page` (TEXT, NOT NULL, INDEX)
    - `country` (VARCHAR(10))
    - `device` (VARCHAR(20))
    - `search_appearance` (VARCHAR(50))
    - `clicks` (INTEGER, NOT NULL)
    - `impressions` (INTEGER, NOT NULL)
    - `ctr` (NUMERIC(6,5), NOT NULL)
    - `position` (NUMERIC(5,2), NOT NULL)

29. **`gsc_url_inspections`**
    - `id` (UUID, PK)
    - `site_id` (UUID, FK `sites.id`, INDEX)
    - `url` (TEXT, NOT NULL)
    - `coverage_state` (TEXT)
    - `verdict` (TEXT)
    - `google_canonical` (TEXT)
    - `user_canonical` (TEXT)
    - `last_crawl_time` (TIMESTAMPTZ)
    - `inspected_at` (TIMESTAMPTZ, NOT NULL)

30. **`crux_metrics`**
    - `id` (UUID, PK)
    - `site_id` (UUID, FK `sites.id`, INDEX)
    - `url` (TEXT, NOT NULL)
    - `form_factor` (VARCHAR(20)) -- 'DESKTOP', 'PHONE'
    - `collection_period` (DATERANGE)
    - `p75_lcp_ms` (INTEGER)
    - `p75_inp_ms` (INTEGER)
    - `p75_cls` (NUMERIC(4,3))
    - `fetched_at` (TIMESTAMPTZ)

31. **`lighthouse_runs`**
    - `id` (UUID, PK)
    - `site_id` (UUID, FK `sites.id`)
    - `url` (TEXT, NOT NULL)
    - `score_performance` (INTEGER)
    - `score_accessibility` (INTEGER)
    - `score_best_practices` (INTEGER)
    - `score_seo` (INTEGER)
    - `report_json` (JSONB)
    - `audited_at` (TIMESTAMPTZ)

#### 3.7. Knowledge Brain & RAG
32. **`knowledge_sources`**
    - `id` (UUID, PK)
    - `name` (VARCHAR(255), NOT NULL)
    - `authority_level` (`knowledge_authority`, NOT NULL)
    - `base_url` (TEXT, NOT NULL)
    - `last_synced_at` (TIMESTAMPTZ)

33. **`knowledge_documents`**
    - `id` (UUID, PK)
    - `source_id` (UUID, FK `knowledge_sources.id`)
    - `title` (VARCHAR(255), NOT NULL)
    - `canonical_url` (TEXT, NOT NULL)
    - `content_hash` (CHAR(64), NOT NULL)
    - `status` (`knowledge_status`, DEFAULT 'ACTIVE')
    - `published_at`, `updated_at`, `retrieved_at` (TIMESTAMPTZ)
    - `version` (INTEGER, DEFAULT 1)

34. **`knowledge_chunks`**
    - `id` (UUID, PK)
    - `document_id` (UUID, FK `knowledge_documents.id`, ON DELETE CASCADE)
    - `heading_path` (TEXT[])
    - `content` (TEXT, NOT NULL)
    - `tsv_content` (TSVECTOR) -- PostgreSQL full-text index
    - `token_count` (INTEGER, NOT NULL)
    - `created_at` (TIMESTAMPTZ)

35. **`knowledge_embeddings`**
    - `id` (UUID, PK)
    - `chunk_id` (UUID, FK `knowledge_chunks.id`, ON DELETE CASCADE)
    - `model_name` (VARCHAR(100), NOT NULL)
    - `embedding` (VECTOR(1536), NOT NULL) -- pgvector column

36. **`retrieval_events`**
    - `id` (UUID, PK)
    - `query` (TEXT, NOT NULL)
    - `retrieved_chunk_ids` (UUID[], NOT NULL)
    - `reranked_scores` (FLOAT[], NOT NULL)
    - `created_at` (TIMESTAMPTZ)

#### 3.8. AI Agent Orchestration, Experiments & Audit Trail
37. **`agent_runs`**
    - `id` (UUID, PK)
    - `site_id` (UUID, FK `sites.id`)
    - `agent_type` (VARCHAR(50), NOT NULL) -- 'TECHNICAL', 'CONTENT', 'INTERNAL_LINK', 'STRATEGY'
    - `prompt_version` (VARCHAR(50), NOT NULL)
    - `model_name` (VARCHAR(100), NOT NULL)
    - `input_hash` (CHAR(64), NOT NULL)
    - `output_json` (JSONB, NOT NULL)
    - `tokens_prompt` (INTEGER)
    - `tokens_completion` (INTEGER)
    - `created_at` (TIMESTAMPTZ)

38. **`experiments`**
    - `id` (UUID, PK)
    - `site_id` (UUID, FK `sites.id`, INDEX)
    - `change_set_id` (UUID, FK `change_sets.id`)
    - `name` (VARCHAR(255), NOT NULL)
    - `baseline_start_date` (DATE, NOT NULL)
    - `baseline_end_date` (DATE, NOT NULL)
    - `experiment_start_date` (DATE, NOT NULL)
    - `status` (VARCHAR(50), DEFAULT 'ACTIVE')
    - `created_at` (TIMESTAMPTZ)

39. **`experiment_pages`**
    - `id` (UUID, PK)
    - `experiment_id` (UUID, FK `experiments.id`, ON DELETE CASCADE)
    - `url` (TEXT, NOT NULL)
    - `cohort` (VARCHAR(20), NOT NULL) -- 'VARIANT' or 'CONTROL'

40. **`audit_logs`**
    - `id` (UUID, PK)
    - `organization_id` (UUID, FK `organizations.id`, INDEX)
    - `user_id` (UUID, FK `users.id`, NULLABLE)
    - `site_id` (UUID, FK `sites.id`, NULLABLE, INDEX)
    - `action` (VARCHAR(100), NOT NULL)
    - `resource_type` (VARCHAR(50), NOT NULL)
    - `resource_id` (TEXT, NOT NULL)
    - `state_before` (JSONB)
    - `state_after` (JSONB)
    - `ip_address` (INET)
    - `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT clock_timestamp())
