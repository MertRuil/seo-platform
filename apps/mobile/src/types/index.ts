export type IssueSeverity = "CRITICAL" | "WARNING" | "INFO";

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role?: string;
  organization_id?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "CRITICAL_ALERT" | "CRAWL_COMPLETE" | "AI_RECOMMENDATION" | "BILLING_UPDATE";
  is_read: boolean;
  created_at: string;
  action_link?: string;
}

export interface CrawlRunItem {
  id: string;
  site_id: string;
  crawl_mode: "FAST" | "DEEP" | "CUSTOM";
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  max_pages: number;
  pages_crawled: number;
  issues_found: number;
  started_at: string;
  completed_at?: string;
  current_url?: string;
  discovered_urls?: string[];
}

export interface DiscoveredPagesResult {
  url: string;
  domain: string;
  total_pages: number;
  has_sitemap: boolean;
  sitemap_url?: string | null;
  discovered_urls: string[];
  source: "SITEMAP" | "INTERNAL_LINKS" | "ESTIMATED";
}

export interface SiteIssueItem {
  rule_id: string;
  category: string;
  severity: IssueSeverity;
  title: string;
  description: string;
  recommendation_template: string;
  documentation_url?: string;
  affected_url_count: number;
  affected_urls?: string[];
}

export interface SiteSummary {
  id: string;
  name: string;
  domain: string;
  primary_url: string;
  health_score: number;
  last_crawled_at?: string;
  execution_mode: "MANUAL" | "AUTO_LOW_RISK" | "AUTONOMOUS";
  total_pages?: number;
  has_completed_crawl?: boolean;
  cwv?: { lcp: string; cls: string; inp: string };
}

export interface CoreWebVitalsSummary {
  lcp_p75_ms: number;
  lcp_status: "GOOD" | "NEEDS_IMPROVEMENT" | "POOR";
  cls_p75: number;
  cls_status: "GOOD" | "NEEDS_IMPROVEMENT" | "POOR";
  inp_p75_ms: number;
  inp_status: "GOOD" | "NEEDS_IMPROVEMENT" | "POOR";
}

export interface RecommendationItem {
  id: string;
  site_id: string;
  category: "TECHNICAL" | "CONTENT" | "SCHEMA" | "INTERNAL_LINKING" | "STRATEGY";
  title: string;
  description: string;
  risk_level: "LOW" | "MEDIUM" | "HIGH";
  effort: "LOW" | "MEDIUM" | "HIGH";
  estimated_impact: number;
  status: "PENDING" | "APPROVED" | "EXECUTED" | "DISMISSED";
  change_set_id?: string;
  created_at: string;
}

export interface QuickAuditResult {
  url: string;
  health_score: number;
  status_code: number;
  load_time_ms: number;
  title: string;
  meta_description: string;
  has_canonical: boolean;
  canonical_url?: string;
  has_schema: boolean;
  robots_txt_status: "ALLOWED" | "BLOCKED" | "NOT_FOUND";
  core_web_vitals: CoreWebVitalsSummary;
  checks: Array<{
    id: string;
    title: string;
    passed: boolean;
    severity: IssueSeverity;
    detail: string;
  }>;
}

export interface KnowledgeChunk {
  chunk_id: string;
  document_title: string;
  heading_path: string[];
  content: string;
  score: number;
  canonical_url: string;
  authority_level: "LEVEL_1_OFFICIAL" | "LEVEL_2_AUTHORITATIVE" | "LEVEL_3_COMMUNITY";
  verification_status: "VERIFIED" | "DEPRECATED" | "REJECTED";
}

export interface BillingSummary {
  plan_name: "STARTER" | "GROWTH" | "SCALE" | "ENTERPRISE";
  status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED";
  crawls_used: number;
  crawls_limit: number;
  pages_used: number;
  pages_limit: number;
  ai_tokens_used: number;
  ai_tokens_limit: number;
  renews_at: string;
}
