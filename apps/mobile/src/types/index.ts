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
  type: "CRITICAL_ALERT" | "CRAWL_COMPLETE" | "AI_RECOMMENDATION" | "BILLING_UPDATE" | "KEYWORD_ALERT" | "GEO_ALERT";
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
  traffic?: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
    change_pct: number;
  };
  geo_score?: number;
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

// ----------------------------------------------------------------------
// Gelişmiş SEO & GEO Mobil Veri Modelleri (65 Bölümlük Şartname)
// ----------------------------------------------------------------------

export type SearchIntent = "INFORMATIONAL" | "COMMERCIAL" | "TRANSACTIONAL" | "NAVIGATIONAL";

export interface KeywordItem {
  id: string;
  keyword: string;
  current_pos: number;
  prev_pos: number;
  change: number; // e.g. +3, -1
  volume: number;
  difficulty: number; // 0-100
  cpc: number;
  intent: SearchIntent;
  target_url: string;
  trend_7d: number[];
  checked_at: string;
}

export interface KeywordResearchItem {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  intent: SearchIntent;
  type: "RELATED" | "QUESTION" | "LONG_TAIL" | "PAA";
  has_ai_overview: boolean;
}

export interface CompetitorItem {
  id: string;
  name: string;
  domain: string;
  seo_score: number;
  organic_traffic: number;
  ranked_keywords: number;
  backlinks: number;
  geo_visibility: number;
  top_keywords: string[];
}

export interface CompetitorGapItem {
  keyword: string;
  volume: number;
  my_position: number | null;
  competitor_positions: Record<string, number>;
  opportunity_score: number;
}

export interface AiChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  sources?: string[];
  suggested_actions?: Array<{
    label: string;
    action_type: "APPLY_FIX" | "CREATE_TASK" | "GENERATE_CONTENT" | "CRAWL";
    payload?: any;
  }>;
}

export interface ContentOptimizationResult {
  url: string;
  content_score: number;
  geo_score: number;
  readability_score: number;
  word_count: number;
  target_keyword: string;
  keyword_density: number;
  missing_entities: string[];
  missing_headings: string[];
  ai_suggestions: string[];
}

export interface GeneratedContentResult {
  type: "META_TITLE" | "META_DESCRIPTION" | "FAQ" | "BLOG_OUTLINE" | "PRODUCT_DESC";
  title: string;
  content: string;
  tokens_used: number;
}

export interface GeoPlatformScore {
  platform: "ChatGPT" | "Google AI Overview" | "Gemini" | "Perplexity" | "Claude";
  score: number; // 0-100
  mentions: number;
  citations: number;
  status: "DOMINANT" | "VISIBLE" | "RARE" | "ABSENT";
}

export interface GeoPromptItem {
  id: string;
  prompt: string;
  frequency: string;
  brand_mentioned: boolean;
  citation_rank: number | null;
  platform_results: Record<string, { mentioned: boolean; snippet: string }>;
  top_competitor_cited?: string;
}

export type TaskStatus = "TODO" | "IN_PROGRESS" | "REVIEW" | "COMPLETED";
export type TaskPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface SeoTaskItem {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  estimated_impact: "HIGH" | "MEDIUM" | "LOW";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  category: "TECHNICAL" | "CONTENT" | "GEO" | "LINKING";
  due_date?: string;
  affected_url?: string;
  created_at: string;
}

export interface SeoReportSummary {
  id: string;
  period_label: "GÜNLÜK" | "HAFTALIK" | "AYLIK";
  date_range: string;
  overall_score: number;
  score_change: number;
  organic_clicks: number;
  clicks_change_pct: number;
  top_keywords_gained: number;
  top_keywords_lost: number;
  issues_resolved: number;
  geo_score: number;
  executive_summary: string;
}

export interface OnboardingState {
  is_completed: boolean;
  user_type?: "FREELANCER" | "AGENCY" | "BUSINESS_OWNER" | "SEO_SPECIALIST" | "ECOMMERCE";
  skill_level?: "BEGINNER" | "INTERMEDIATE" | "EXPERT";
  primary_goal?: "TRAFFIC" | "RANKINGS" | "GEO_VISIBILITY" | "TECHNICAL_SEO" | "COMPETITOR";
}

export interface AppSettings {
  theme: "DARK" | "LIGHT" | "SYSTEM";
  biometric_enabled: boolean;
  push_alerts: boolean;
  morning_brief_enabled: boolean;
  weekly_report_email: boolean;
  strict_live_backend: boolean;
  connected_integrations: Array<{
    id: string;
    name: string;
    icon: string;
    is_connected: boolean;
    last_synced?: string;
  }>;
}

export interface SeoOpportunityCard {
  id: string;
  type: "KEYWORD_WIN" | "CANONICAL_FIX" | "THIN_CONTENT" | "GEO_BOOST" | "PAGE_SPEED";
  badge: string;
  title: string;
  subtitle: string;
  potential: string;
  difficulty: "KOLAY" | "ORTA" | "İLERİ";
  action_label: string;
}

export type ComplianceSector =
  | "HEALTH_MEDICAL"
  | "FOOD_SUPPLEMENT"
  | "LEGAL_SERVICES"
  | "FINANCIAL_SERVICES"
  | "SUPERLATIVE_COMMERCIAL"
  | "ILLEGAL_BETTING_TOBACCO";

export interface ComplianceViolation {
  rule_id: string;
  sector: ComplianceSector;
  title: string;
  explanation?: string;
  matched_pattern: string;
  matched_term?: string;
  context_snippet: string;
  legal_basis: string;
  legal_reference?: string;
  penalty_risk: string;
  fine_risk?: string;
  suggested_fix: string;
  suggested_replacement?: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export type EuComplianceSector =
  | "HEALTH_PHARMA"
  | "FOOD_SUPPLEMENT"
  | "GREEN_CLAIMS"
  | "CONSUMER_ECOMMERCE"
  | "FINANCIAL_SERVICES"
  | "LEGAL_SERVICES"
  | "TOBACCO_NICOTINE";

export interface EuComplianceViolation {
  rule_id: string;
  sector: EuComplianceSector;
  title: string;
  explanation?: string;
  matched_pattern: string;
  matched_term?: string;
  context_snippet: string;
  legal_basis: string;
  legal_reference?: string;
  penalty_risk: string;
  fine_risk?: string;
  suggested_fix: string;
  suggested_replacement?: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export type ComplianceJurisdiction = "TR" | "EU" | "US";

export type UsComplianceSector =
  | "HEALTH_FDA"
  | "SUPPLEMENTS_WEIGHTLOSS"
  | "FTC_COMMERCIAL_DECEPTIVE"
  | "FINANCIAL_SEC_CFPB"
  | "GREEN_GUIDES_FTC"
  | "LEGAL_ABA"
  | "TOBACCO_PACT";

export interface UsComplianceViolation {
  rule_id: string;
  sector: UsComplianceSector;
  title: string;
  explanation?: string;
  matched_pattern: string;
  matched_term?: string;
  context_snippet: string;
  legal_basis: string;
  legal_reference?: string;
  penalty_risk: string;
  fine_risk?: string;
  suggested_fix: string;
  suggested_replacement?: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}



