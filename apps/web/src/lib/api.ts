const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? "/api/v1" : "http://localhost:8000/api/v1");

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

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Network error" }));
      throw new Error(errorData.detail || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  async getHealthLive() {
    const healthBase = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
    const response = await fetch(`${healthBase}/health/live`);
    if (!response.ok) throw new Error(`Health check failed with status ${response.status}`);
    return response.json() as Promise<{ status: string }>;
  }

  async register(data: { email: string; password: string; full_name?: string }) {
    return this.request<UserResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<{ access_token: string; refresh_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getMe() {
    return this.request<UserResponse>("/auth/me");
  }

  async getOrganizations() {
    return this.request<OrganizationResponse[]>("/organizations");
  }

  async createOrganization(data: { name: string; slug: string }) {
    return this.request<OrganizationResponse>("/organizations", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getSites(orgId: string) {
    return this.request<SiteResponse[]>(`/organizations/${orgId}/sites`);
  }

  async createSite(orgId: string, data: { name: string; primary_url: string; site_type?: string; execution_mode?: string }) {
    return this.request<SiteResponse>(`/organizations/${orgId}/sites`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
