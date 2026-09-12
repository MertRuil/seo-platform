const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? "/api/v1" : "http://localhost:8000/api/v1");

export const STORAGE_KEY_TOKEN = "seo_auth_token";

export interface UserResponse {
  id: string;
  email: string;
  full_name?: string | null;
  is_active: boolean;
  is_platform_admin: boolean;
}

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  monthly_token_budget: number;
  tokens_used_this_month: number;
}

export interface SiteResponse {
  id: string;
  organization_id: string;
  name: string;
  domain: string;
  normalized_domain: string;
  primary_url: string;
  site_type: string;
  language: string;
  country: string;
  execution_mode: string;
  verification_status: string;
}

export interface CrawlRunResponse {
  id: string;
  site_id: string;
  crawl_mode: string;
  status: string;
  total_urls_discovered: number;
  total_urls_crawled: number;
  total_errors: number;
  max_pages: number;
  max_depth: number;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
}

export interface IssueSummaryResponse {
  rule_id: string;
  category: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  recommendation_template: string;
  documentation_url?: string | null;
  affected_url_count: number;
}

export interface SiteHealthReportResponse {
  site_id: string;
  crawl_run_id: string;
  health_score: number;
  total_pages_evaluated: number;
  total_issues_found: number;
  issues: IssueSummaryResponse[];
}

export interface PageExplorerItem {
  id: string;
  url: string;
  normalized_url: string;
  status_code: number;
  depth: number;
  title?: string | null;
  meta_description?: string | null;
  canonical_target?: string | null;
  has_noindex: boolean;
  is_indexable_candidate: boolean;
  word_count: number;
  response_time_ms?: number | null;
}

export interface PaginatedPagesResponse {
  total: number;
  limit: number;
  offset: number;
  items: PageExplorerItem[];
}

export interface RecommendationResponse {
  id: string;
  site_id: string;
  issue_id?: string | null;
  category: string;
  title: string;
  description: string;
  reason: string;
  expected_impact?: string | null;
  confidence: number;
  priority_score: number;
  risk_level: string;
  effort: string;
  evidence_json: string;
  rag_sources_json: string;
  status: string;
  created_at: string;
}

export interface GscSearchMetricResponse {
  id: string;
  site_id: string;
  metric_date: string;
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface CruxMetricResponse {
  id: string;
  site_id: string;
  url: string;
  form_factor: string;
  p75_lcp_ms?: number | null;
  p75_inp_ms?: number | null;
  p75_cls?: number | null;
  fetched_at: string;
}

export interface OpportunityResponse {
  type: string;
  query?: string | null;
  page?: string | null;
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  recommended_action: string;
}

export interface SiteGraphResponse {
  site_id: string;
  total_nodes: number;
  total_edges: number;
  orphan_pages: string[];
  top_pagerank_pages: Array<{ url?: string; pagerank?: number; in_degree?: number; out_degree?: number; [k: string]: unknown }>;
  linking_opportunities: Array<{ source_url: string; target_url: string; reason: string; target_pagerank: number; source_pagerank: number }>;
}

export interface ChangeSetResponse {
  id: string;
  site_id: string;
  recommendation_id?: string | null;
  status: string;
  risk_level: string;
  created_at: string;
  executed_at?: string | null;
  items: Array<{ id: string; target_url: string; operation: string; state_before: string; state_after: string; expected_hash_before: string; status: string }>;
}

export interface ExperimentEvaluationResponse {
  experiment_name: string;
  diff_in_diff_lift: number;
  variant_relative_lift_percent: number;
  is_statistically_significant: boolean;
  conclusion: string;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const activeToken = this.token || (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY_TOKEN) : null);
    if (activeToken) {
      headers["Authorization"] = `Bearer ${activeToken}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    } catch (e) {
      throw new ApiError(0, "Arka uca ulaşılamıyor");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "İstek başarısız" }));
      const detail = typeof errorData.detail === "string" ? errorData.detail : `İstek ${response.status} ile başarısız oldu`;
      throw new ApiError(response.status, detail);
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  async getHealthLive() {
    const healthBase = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
    const response = await fetch(`${healthBase}/health/live`);
    if (!response.ok) throw new ApiError(response.status, "Sağlık denetimi başarısız");
    return response.json() as Promise<{ status: string }>;
  }

  // Kimlik
  register(data: { email: string; password: string; full_name?: string }) {
    return this.request<UserResponse>("/auth/register", { method: "POST", body: JSON.stringify(data) });
  }
  login(data: { email: string; password: string }) {
    return this.request<{ access_token: string; refresh_token: string }>("/auth/login", { method: "POST", body: JSON.stringify(data) });
  }
  getMe() {
    return this.request<UserResponse>("/auth/me");
  }

  // Organizasyon & site
  getOrganizations() {
    return this.request<OrganizationResponse[]>("/organizations");
  }
  createOrganization(data: { name: string; slug: string }) {
    return this.request<OrganizationResponse>("/organizations", { method: "POST", body: JSON.stringify(data) });
  }
  getSites(orgId: string) {
    return this.request<SiteResponse[]>(`/organizations/${orgId}/sites`);
  }
  createSite(orgId: string, data: { name: string; primary_url: string; site_type?: string; execution_mode?: string }) {
    return this.request<SiteResponse>(`/organizations/${orgId}/sites`, { method: "POST", body: JSON.stringify(data) });
  }

  // Taramalar
  listCrawls(orgId: string, siteId: string) {
    return this.request<CrawlRunResponse[]>(`/organizations/${orgId}/sites/${siteId}/crawls`);
  }
  triggerCrawl(orgId: string, siteId: string, data: { crawl_mode?: string; max_pages?: number; max_depth?: number } = {}) {
    return this.request<CrawlRunResponse>(`/organizations/${orgId}/sites/${siteId}/crawls`, {
      method: "POST",
      body: JSON.stringify({ crawl_mode: "GOOGLEBOT_SIMULATION", max_pages: 100, max_depth: 5, ...data }),
    });
  }
  getCrawlHealth(orgId: string, siteId: string, crawlId: string) {
    return this.request<SiteHealthReportResponse>(`/organizations/${orgId}/sites/${siteId}/crawls/${crawlId}/health`);
  }
  getCrawlPages(orgId: string, siteId: string, crawlId: string, params: { limit?: number; offset?: number } = {}) {
    const q = new URLSearchParams({ limit: String(params.limit ?? 100), offset: String(params.offset ?? 0) });
    return this.request<PaginatedPagesResponse>(`/organizations/${orgId}/sites/${siteId}/crawls/${crawlId}/pages?${q}`);
  }

  // Öneriler & fırsatlar
  getRecommendations(orgId: string, siteId: string) {
    return this.request<RecommendationResponse[]>(`/organizations/${orgId}/sites/${siteId}/recommendations`);
  }
  updateRecommendationStatus(orgId: string, siteId: string, recId: string, status: "APPROVED" | "REJECTED" | "IN_PROGRESS" | "RESOLVED") {
    return this.request<RecommendationResponse>(`/organizations/${orgId}/sites/${siteId}/recommendations/${recId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }
  getOpportunities(orgId: string, siteId: string) {
    return this.request<OpportunityResponse[]>(`/organizations/${orgId}/sites/${siteId}/integrations/opportunities`);
  }
  getGscMetrics(orgId: string, siteId: string) {
    return this.request<GscSearchMetricResponse[]>(`/organizations/${orgId}/sites/${siteId}/integrations/gsc`);
  }
  getCruxMetrics(orgId: string, siteId: string) {
    return this.request<CruxMetricResponse[]>(`/organizations/${orgId}/sites/${siteId}/integrations/crux`);
  }
  getSiteGraph(orgId: string, siteId: string) {
    return this.request<SiteGraphResponse>(`/organizations/${orgId}/sites/${siteId}/graph`);
  }

  // Güvenli uygulama
  createChangeSet(orgId: string, siteId: string, data: { recommendation_id?: string; risk_level?: string; items: Array<{ target_url: string; operation: string; state_before: string; state_after: string; expected_hash_before: string }> }) {
    return this.request<ChangeSetResponse>(`/organizations/${orgId}/sites/${siteId}/change-sets`, { method: "POST", body: JSON.stringify(data) });
  }
  approveChangeSet(orgId: string, siteId: string, changeSetId: string) {
    return this.request<ChangeSetResponse>(`/organizations/${orgId}/sites/${siteId}/change-sets/${changeSetId}/approve`, { method: "POST" });
  }
  executeChangeSet(orgId: string, siteId: string, changeSetId: string) {
    return this.request<{ success: boolean; status: string; error_message?: string | null; rolled_back: boolean }>(
      `/organizations/${orgId}/sites/${siteId}/change-sets/${changeSetId}/execute`,
      { method: "POST" }
    );
  }
  evaluateExperiment(orgId: string, siteId: string, data: { name: string; variant_pages: string[]; control_pages: string[] }) {
    return this.request<ExperimentEvaluationResponse>(`/organizations/${orgId}/sites/${siteId}/experiments`, { method: "POST", body: JSON.stringify(data) });
  }
}

export const api = new ApiClient();
export { API_BASE_URL };
