-- Supabase PostgreSQL Initial Schema Migration
-- Generated from packages.shared.models Base.metadata

CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

CREATE TABLE users (
	id VARCHAR(36) NOT NULL, 
	email VARCHAR(255) NOT NULL, 
	hashed_password VARCHAR(255) NOT NULL, 
	full_name VARCHAR(255), 
	is_active BOOLEAN NOT NULL, 
	is_platform_admin BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE organizations (
	id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	slug VARCHAR(255) NOT NULL, 
	monthly_token_budget INTEGER NOT NULL, 
	tokens_used_this_month INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_organizations_slug ON organizations (slug);

CREATE TABLE knowledge_sources (
	id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	authority_level VARCHAR(50) NOT NULL, 
	base_url TEXT NOT NULL, 
	last_synced_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id)
);

CREATE TABLE plans (
	id VARCHAR(36) NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	name VARCHAR(100) NOT NULL, 
	description TEXT, 
	is_public BOOLEAN NOT NULL, 
	sort_order INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_plans_code ON plans (code);

CREATE TABLE billing_events (
	id VARCHAR(36) NOT NULL, 
	provider VARCHAR(50) NOT NULL, 
	external_event_id VARCHAR(255) NOT NULL, 
	event_type VARCHAR(100) NOT NULL, 
	payload_json TEXT NOT NULL, 
	processed_at TIMESTAMP WITH TIME ZONE, 
	error TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_billing_events_external_event_id ON billing_events (external_event_id);

CREATE TABLE memberships (
	id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36) NOT NULL, 
	organization_id VARCHAR(36) NOT NULL, 
	role VARCHAR(50) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_user_organization UNIQUE (user_id, organization_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE INDEX ix_memberships_organization_id ON memberships (organization_id);

CREATE INDEX ix_memberships_user_id ON memberships (user_id);

CREATE TABLE sites (
	id VARCHAR(36) NOT NULL, 
	organization_id VARCHAR(36) NOT NULL, 
	name VARCHAR(255) NOT NULL, 
	domain VARCHAR(255) NOT NULL, 
	normalized_domain VARCHAR(255) NOT NULL, 
	primary_url TEXT NOT NULL, 
	preferred_protocol VARCHAR(10) NOT NULL, 
	site_type VARCHAR(50) NOT NULL, 
	language VARCHAR(10) NOT NULL, 
	country VARCHAR(10) NOT NULL, 
	timezone VARCHAR(50) NOT NULL, 
	cms_type VARCHAR(50), 
	execution_mode VARCHAR(50) NOT NULL, 
	verification_status VARCHAR(50) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE INDEX ix_sites_normalized_domain ON sites (normalized_domain);

CREATE INDEX ix_sites_organization_id ON sites (organization_id);

CREATE TABLE oauth_credentials (
	id VARCHAR(36) NOT NULL, 
	organization_id VARCHAR(36) NOT NULL, 
	provider VARCHAR(50) NOT NULL, 
	encrypted_access_token TEXT NOT NULL, 
	encrypted_refresh_token TEXT NOT NULL, 
	token_expiry TIMESTAMP WITH TIME ZONE NOT NULL, 
	scopes TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE INDEX ix_oauth_credentials_organization_id ON oauth_credentials (organization_id);

CREATE TABLE knowledge_documents (
	id VARCHAR(100) NOT NULL, 
	source_id VARCHAR(36), 
	title VARCHAR(255) NOT NULL, 
	canonical_url TEXT NOT NULL, 
	authority_level VARCHAR(50) NOT NULL, 
	content_hash VARCHAR(64), 
	source_hash VARCHAR(64), 
	status VARCHAR(50) NOT NULL, 
	version INTEGER NOT NULL, 
	published_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(source_id) REFERENCES knowledge_sources (id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX ix_knowledge_documents_canonical_url ON knowledge_documents (canonical_url);

CREATE INDEX ix_knowledge_documents_source_id ON knowledge_documents (source_id);

CREATE TABLE plan_prices (
	id VARCHAR(36) NOT NULL, 
	plan_id VARCHAR(36) NOT NULL, 
	interval VARCHAR(20) NOT NULL, 
	currency VARCHAR(10) NOT NULL, 
	amount_minor INTEGER NOT NULL, 
	external_price_id VARCHAR(100), 
	region VARCHAR(50), 
	active BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(plan_id) REFERENCES plans (id) ON DELETE CASCADE
);

CREATE INDEX ix_plan_prices_plan_id ON plan_prices (plan_id);

CREATE TABLE plan_limits (
	id VARCHAR(36) NOT NULL, 
	plan_id VARCHAR(36) NOT NULL, 
	metric VARCHAR(50) NOT NULL, 
	hard_limit INTEGER NOT NULL, 
	soft_limit INTEGER, 
	overage_unit INTEGER, 
	overage_price_minor INTEGER, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_plan_limit_metric UNIQUE (plan_id, metric), 
	FOREIGN KEY(plan_id) REFERENCES plans (id) ON DELETE CASCADE
);

CREATE INDEX ix_plan_limits_plan_id ON plan_limits (plan_id);

CREATE TABLE plan_features (
	id VARCHAR(36) NOT NULL, 
	plan_id VARCHAR(36) NOT NULL, 
	feature_key VARCHAR(100) NOT NULL, 
	enabled BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_plan_feature_key UNIQUE (plan_id, feature_key), 
	FOREIGN KEY(plan_id) REFERENCES plans (id) ON DELETE CASCADE
);

CREATE INDEX ix_plan_features_plan_id ON plan_features (plan_id);

CREATE TABLE subscriptions (
	id VARCHAR(36) NOT NULL, 
	organization_id VARCHAR(36) NOT NULL, 
	plan_id VARCHAR(36) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	provider VARCHAR(50) NOT NULL, 
	external_subscription_id VARCHAR(255), 
	external_customer_id VARCHAR(255), 
	current_period_start TIMESTAMP WITH TIME ZONE NOT NULL, 
	current_period_end TIMESTAMP WITH TIME ZONE, 
	trial_ends_at TIMESTAMP WITH TIME ZONE, 
	cancel_at_period_end BOOLEAN NOT NULL, 
	canceled_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE, 
	FOREIGN KEY(plan_id) REFERENCES plans (id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX ix_subscriptions_organization_id ON subscriptions (organization_id);

CREATE INDEX ix_subscriptions_external_customer_id ON subscriptions (external_customer_id);

CREATE INDEX ix_subscriptions_plan_id ON subscriptions (plan_id);

CREATE INDEX ix_subscriptions_external_subscription_id ON subscriptions (external_subscription_id);

CREATE TABLE usage_counters (
	id VARCHAR(36) NOT NULL, 
	organization_id VARCHAR(36) NOT NULL, 
	metric VARCHAR(50) NOT NULL, 
	period_start TIMESTAMP WITH TIME ZONE NOT NULL, 
	period_end TIMESTAMP WITH TIME ZONE NOT NULL, 
	used INTEGER NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_org_metric_period UNIQUE (organization_id, metric, period_start), 
	FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE INDEX ix_usage_counters_organization_id ON usage_counters (organization_id);

CREATE TABLE usage_events (
	id VARCHAR(36) NOT NULL, 
	organization_id VARCHAR(36) NOT NULL, 
	metric VARCHAR(50) NOT NULL, 
	quantity INTEGER NOT NULL, 
	ref_type VARCHAR(50), 
	ref_id VARCHAR(255), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE INDEX ix_usage_events_organization_id ON usage_events (organization_id);

CREATE TABLE credit_ledger (
	id VARCHAR(36) NOT NULL, 
	organization_id VARCHAR(36) NOT NULL, 
	delta INTEGER NOT NULL, 
	reason VARCHAR(50) NOT NULL, 
	balance_after INTEGER NOT NULL, 
	ref_id VARCHAR(255), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE INDEX ix_credit_ledger_organization_id ON credit_ledger (organization_id);

CREATE TABLE invoices (
	id VARCHAR(36) NOT NULL, 
	organization_id VARCHAR(36) NOT NULL, 
	external_invoice_id VARCHAR(255), 
	number VARCHAR(100), 
	status VARCHAR(50) NOT NULL, 
	currency VARCHAR(10) NOT NULL, 
	subtotal_minor INTEGER NOT NULL, 
	tax_minor INTEGER NOT NULL, 
	total_minor INTEGER NOT NULL, 
	pdf_url TEXT, 
	issued_at TIMESTAMP WITH TIME ZONE, 
	paid_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE
);

CREATE INDEX ix_invoices_organization_id ON invoices (organization_id);

CREATE INDEX ix_invoices_external_invoice_id ON invoices (external_invoice_id);

CREATE TABLE site_verifications (
	id VARCHAR(36) NOT NULL, 
	site_id VARCHAR(36) NOT NULL, 
	method VARCHAR(50) NOT NULL, 
	token VARCHAR(255) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	last_checked_at TIMESTAMP WITH TIME ZONE, 
	verified_at TIMESTAMP WITH TIME ZONE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
);

CREATE INDEX ix_site_verifications_site_id ON site_verifications (site_id);

CREATE TABLE site_connectors (
	id VARCHAR(36) NOT NULL, 
	site_id VARCHAR(36) NOT NULL, 
	connector_type VARCHAR(50) NOT NULL, 
	encrypted_credentials TEXT NOT NULL, 
	base_url TEXT, 
	capabilities TEXT NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
);

CREATE INDEX ix_site_connectors_site_id ON site_connectors (site_id);

CREATE TABLE crawl_runs (
	id VARCHAR(36) NOT NULL, 
	site_id VARCHAR(36) NOT NULL, 
	crawl_mode VARCHAR(50) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	total_urls_discovered INTEGER NOT NULL, 
	total_urls_crawled INTEGER NOT NULL, 
	total_errors INTEGER NOT NULL, 
	max_pages INTEGER NOT NULL, 
	max_depth INTEGER NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE, 
	finished_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
);

CREATE INDEX ix_crawl_runs_site_id ON crawl_runs (site_id);

CREATE TABLE gsc_search_metrics (
	id VARCHAR(36) NOT NULL, 
	site_id VARCHAR(36) NOT NULL, 
	metric_date DATE NOT NULL, 
	query VARCHAR(500) NOT NULL, 
	page TEXT NOT NULL, 
	country VARCHAR(10), 
	device VARCHAR(20), 
	clicks INTEGER NOT NULL, 
	impressions INTEGER NOT NULL, 
	ctr NUMERIC(6, 5) NOT NULL, 
	position NUMERIC(5, 2) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
);

CREATE INDEX ix_gsc_search_metrics_site_id ON gsc_search_metrics (site_id);

CREATE INDEX ix_gsc_search_metrics_metric_date ON gsc_search_metrics (metric_date);

CREATE INDEX ix_gsc_search_metrics_page ON gsc_search_metrics (page);

CREATE INDEX ix_gsc_search_metrics_query ON gsc_search_metrics (query);

CREATE TABLE crux_metrics (
	id VARCHAR(36) NOT NULL, 
	site_id VARCHAR(36) NOT NULL, 
	url TEXT NOT NULL, 
	form_factor VARCHAR(20), 
	p75_lcp_ms INTEGER, 
	p75_inp_ms INTEGER, 
	p75_cls NUMERIC(4, 3), 
	fetched_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
);

CREATE INDEX ix_crux_metrics_site_id ON crux_metrics (site_id);

CREATE TABLE lighthouse_runs (
	id VARCHAR(36) NOT NULL, 
	site_id VARCHAR(36) NOT NULL, 
	url TEXT NOT NULL, 
	score_performance INTEGER NOT NULL, 
	score_accessibility INTEGER NOT NULL, 
	score_best_practices INTEGER NOT NULL, 
	score_seo INTEGER NOT NULL, 
	report_json TEXT, 
	audited_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
);

CREATE INDEX ix_lighthouse_runs_site_id ON lighthouse_runs (site_id);

CREATE TABLE knowledge_chunks (
	id VARCHAR(150) NOT NULL, 
	document_id VARCHAR(100) NOT NULL, 
	document_title VARCHAR(255), 
	heading_path TEXT NOT NULL, 
	content TEXT NOT NULL, 
	canonical_url TEXT, 
	authority_level VARCHAR(50) NOT NULL, 
	verification_status VARCHAR(50) NOT NULL, 
	verified_claims TEXT NOT NULL, 
	verification_confidence NUMERIC(4, 2) NOT NULL, 
	token_count INTEGER NOT NULL, 
	embedding_json TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(document_id) REFERENCES knowledge_documents (id) ON DELETE CASCADE
);

CREATE INDEX ix_knowledge_chunks_document_id ON knowledge_chunks (document_id);

CREATE TABLE recommendations (
	id VARCHAR(36) NOT NULL, 
	site_id VARCHAR(36) NOT NULL, 
	issue_id VARCHAR(100), 
	category VARCHAR(100) NOT NULL, 
	title VARCHAR(255) NOT NULL, 
	description TEXT NOT NULL, 
	reason TEXT NOT NULL, 
	expected_impact TEXT, 
	confidence NUMERIC(3, 2) NOT NULL, 
	priority_score NUMERIC(5, 2) NOT NULL, 
	risk_level VARCHAR(50) NOT NULL, 
	effort VARCHAR(20) NOT NULL, 
	evidence_json TEXT NOT NULL, 
	rag_sources_json TEXT NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
);

CREATE INDEX ix_recommendations_priority_score ON recommendations (priority_score);

CREATE INDEX ix_recommendations_site_id ON recommendations (site_id);

CREATE TABLE audit_logs (
	id VARCHAR(36) NOT NULL, 
	organization_id VARCHAR(36) NOT NULL, 
	user_id VARCHAR(36), 
	site_id VARCHAR(36), 
	action VARCHAR(100) NOT NULL, 
	resource_type VARCHAR(50) NOT NULL, 
	resource_id VARCHAR(255) NOT NULL, 
	state_before TEXT, 
	state_after TEXT, 
	ip_address VARCHAR(45), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(organization_id) REFERENCES organizations (id) ON DELETE CASCADE, 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
);

CREATE INDEX ix_audit_logs_site_id ON audit_logs (site_id);

CREATE INDEX ix_audit_logs_organization_id ON audit_logs (organization_id);

CREATE TABLE subscription_addons (
	id VARCHAR(36) NOT NULL, 
	subscription_id VARCHAR(36) NOT NULL, 
	metric VARCHAR(50) NOT NULL, 
	quantity INTEGER NOT NULL, 
	external_item_id VARCHAR(255), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(subscription_id) REFERENCES subscriptions (id) ON DELETE CASCADE
);

CREATE INDEX ix_subscription_addons_subscription_id ON subscription_addons (subscription_id);

CREATE TABLE crawl_pages (
	id VARCHAR(36) NOT NULL, 
	crawl_run_id VARCHAR(36) NOT NULL, 
	site_id VARCHAR(36) NOT NULL, 
	url TEXT NOT NULL, 
	normalized_url TEXT NOT NULL, 
	depth INTEGER NOT NULL, 
	status_code INTEGER NOT NULL, 
	content_type VARCHAR(100), 
	response_time_ms INTEGER, 
	is_fetchable BOOLEAN NOT NULL, 
	is_crawlable_by_google BOOLEAN NOT NULL, 
	has_noindex BOOLEAN NOT NULL, 
	is_indexable_candidate BOOLEAN NOT NULL, 
	canonical_target TEXT, 
	is_canonical BOOLEAN, 
	in_sitemap BOOLEAN NOT NULL, 
	title TEXT, 
	meta_description TEXT, 
	h1 TEXT, 
	word_count INTEGER NOT NULL, 
	raw_html_hash VARCHAR(64), 
	main_content_hash VARCHAR(64), 
	canonical_seo_hash VARCHAR(64), 
	internal_links_json TEXT, 
	structured_data_json TEXT, 
	html_lang VARCHAR(50), 
	hreflangs_json TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(crawl_run_id) REFERENCES crawl_runs (id) ON DELETE CASCADE, 
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE
);

CREATE INDEX ix_crawl_pages_normalized_url ON crawl_pages (normalized_url);

CREATE INDEX ix_crawl_pages_site_id ON crawl_pages (site_id);

CREATE INDEX ix_crawl_pages_crawl_run_id ON crawl_pages (crawl_run_id);

CREATE TABLE change_sets (
	id VARCHAR(36) NOT NULL, 
	site_id VARCHAR(36) NOT NULL, 
	recommendation_id VARCHAR(36), 
	status VARCHAR(50) NOT NULL, 
	risk_level VARCHAR(50) NOT NULL, 
	created_by VARCHAR(36), 
	approved_by VARCHAR(36), 
	approved_at TIMESTAMP WITH TIME ZONE, 
	executed_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(site_id) REFERENCES sites (id) ON DELETE CASCADE, 
	FOREIGN KEY(recommendation_id) REFERENCES recommendations (id) ON DELETE SET NULL, 
	FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL, 
	FOREIGN KEY(approved_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_change_sets_site_id ON change_sets (site_id);

CREATE TABLE change_items (
	id VARCHAR(36) NOT NULL, 
	change_set_id VARCHAR(36) NOT NULL, 
	target_url TEXT NOT NULL, 
	operation VARCHAR(50) NOT NULL, 
	state_before TEXT NOT NULL, 
	state_after TEXT NOT NULL, 
	expected_hash_before VARCHAR(64) NOT NULL, 
	status VARCHAR(50) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(change_set_id) REFERENCES change_sets (id) ON DELETE CASCADE
);

CREATE INDEX ix_change_items_change_set_id ON change_items (change_set_id);

INSERT INTO alembic_version (version_num) VALUES ('8eebae4cd92e') ON CONFLICT DO NOTHING;
