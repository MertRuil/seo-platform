import { validateSafeAuditUrl, safeAuditFetch, SSRFSecurityError } from "@/lib/ssrf";
import type {
  OrganizationResponse,
  SiteResponse,
  CrawlRunResponse,
  SiteHealthReportResponse,
  IssueSummaryResponse,
  PageExplorerItem,
  PaginatedPagesResponse,
  RecommendationResponse,
  SiteGraphResponse,
  OpportunityResponse,
  GscSearchMetricResponse,
  CruxMetricResponse,
  ChangeSetResponse,
  ExperimentEvaluationResponse,
} from "@/lib/api";
import {
  DEMO_HEALTH,
  DEMO_ISSUES,
  DEMO_PAGES,
  DEMO_DASHBOARD,
  DEMO_CHANGESETS,
  type QueueItem,
} from "@/lib/demo";

// Global singleton in memory so state persists across serverless function calls in dev/runtime
interface GlobalStore {
  organizations: Map<string, OrganizationResponse>;
  sites: Map<string, SiteResponse>;
  crawls: Map<string, CrawlRunResponse[]>;
  healthReports: Map<string, SiteHealthReportResponse>; // key: crawlId
  pages: Map<string, PageExplorerItem[]>; // key: crawlId
  recommendations: Map<string, RecommendationResponse[]>; // key: siteId
  graphs: Map<string, SiteGraphResponse>; // key: siteId
  changeSets: Map<string, ChangeSetResponse[]>; // key: siteId
  gsc: Map<string, GscSearchMetricResponse[]>; // key: siteId
  crux: Map<string, CruxMetricResponse[]>; // key: siteId
}

const globalStore = global as unknown as { __calpeoStore?: GlobalStore };

if (!globalStore.__calpeoStore) {
  const defaultOrgId = "org_acme_default";
  const demoSiteId = "site_demo_flagship";

  const orgs = new Map<string, OrganizationResponse>();
  orgs.set(defaultOrgId, {
    id: defaultOrgId,
    name: "Acme Digital Agency",
    slug: "acme-agency",
    monthly_token_budget: 500000,
    tokens_used_this_month: 124500,
  });

  const sites = new Map<string, SiteResponse>();
  sites.set(demoSiteId, {
    id: demoSiteId,
    organization_id: defaultOrgId,
    name: "Flagship E-Commerce",
    domain: "flagship-store.com",
    normalized_domain: "flagship-store.com",
    primary_url: "https://flagship-store.com",
    site_type: "E-COMMERCE",
    language: "tr",
    country: "TR",
    execution_mode: "AUTONOMOUS",
    verification_status: "VERIFIED",
  });

  const demoCrawlId = "crw_demo_initial";
  const crawls = new Map<string, CrawlRunResponse[]>();
  crawls.set(demoSiteId, [
    {
      id: demoCrawlId,
      site_id: demoSiteId,
      crawl_mode: "GOOGLEBOT_SIMULATION",
      status: "COMPLETED",
      total_urls_discovered: 1420,
      total_urls_crawled: 1420,
      total_errors: 3,
      max_pages: 2000,
      max_depth: 5,
      started_at: new Date(Date.now() - 3600000).toISOString(),
      finished_at: new Date(Date.now() - 3300000).toISOString(),
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ]);

  // Demo health report matching DEMO_HEALTH
  const healthReports = new Map<string, SiteHealthReportResponse>();
  healthReports.set(demoCrawlId, {
    site_id: demoSiteId,
    crawl_run_id: demoCrawlId,
    health_score: DEMO_HEALTH.score,
    total_pages_evaluated: DEMO_HEALTH.pages,
    total_issues_found: DEMO_HEALTH.issues,
    issues: DEMO_ISSUES.map((iss) => ({
      rule_id: iss.id,
      category: iss.category,
      severity: iss.severity,
      title: iss.title,
      description: iss.diagnosis,
      recommendation_template: iss.fix,
      documentation_url: iss.docUrl,
      affected_url_count: iss.affected ?? 1,
    })),
  });

  // Demo pages
  const pages = new Map<string, PageExplorerItem[]>();
  pages.set(
    demoCrawlId,
    DEMO_PAGES.map((p, idx) => ({
      id: `pg_demo_${idx + 1}`,
      url: p.url,
      normalized_url: p.url,
      status_code: p.status,
      depth: p.depth ?? 0,
      title: p.title,
      meta_description: null,
      canonical_target: p.canonical,
      has_noindex: false,
      is_indexable_candidate: p.indexable,
      word_count: p.words,
      response_time_ms: p.responseMs ?? 180,
    }))
  );

  // Demo recommendations
  const recommendations = new Map<string, RecommendationResponse[]>();
  recommendations.set(
    demoSiteId,
    DEMO_DASHBOARD.queue.map((q: QueueItem) => ({
      id: q.id,
      site_id: demoSiteId,
      category: q.category,
      title: q.title,
      description: q.reason,
      reason: q.reason,
      expected_impact: q.impact,
      confidence: q.confidence ?? 0.85,
      priority_score: q.score,
      risk_level: q.severity === "CRITICAL" ? "HIGH" : "LOW",
      effort: "Düşük (Otonom uygulanabilir)",
      evidence_json: JSON.stringify({ source: q.source }),
      rag_sources_json: JSON.stringify([q.source]),
      status: "OPEN",
      created_at: new Date().toISOString(),
    }))
  );

  // Demo site graph
  const graphs = new Map<string, SiteGraphResponse>();
  graphs.set(demoSiteId, {
    site_id: demoSiteId,
    total_nodes: 42,
    total_edges: 184,
    orphan_pages: ["https://flagship-store.com/eski-promosyon-2024"],
    top_pagerank_pages: [
      { url: "https://flagship-store.com/", pagerank: 0.28, in_degree: 38, out_degree: 22 },
      { url: "https://flagship-store.com/urunler/elektronik", pagerank: 0.19, in_degree: 24, out_degree: 16 },
      { url: "https://flagship-store.com/urunler/yeni-nesil-kulaklik", pagerank: 0.12, in_degree: 18, out_degree: 8 },
      { url: "https://flagship-store.com/fiyatlandirma", pagerank: 0.08, in_degree: 3, out_degree: 5 },
    ],
    linking_opportunities: [
      {
        source_url: "https://flagship-store.com/blog/en-iyi-kulakliklar",
        target_url: "https://flagship-store.com/urunler/yeni-nesil-kulaklik",
        reason: "Yüksek otoriteli blog yazısından ticari ürün sayfasına yönlendirici anchor link eksik.",
        source_pagerank: 0.14,
        target_pagerank: 0.12,
      },
    ],
  });

  // Demo change sets
  const changeSets = new Map<string, ChangeSetResponse[]>();
  changeSets.set(
    demoSiteId,
    DEMO_CHANGESETS.map((cs) => ({
      id: cs.id,
      site_id: demoSiteId,
      status: cs.durum === "UYGULANDI" ? "APPLIED" : "DRAFT",
      risk_level: cs.onem || "LOW",
      created_at: new Date().toISOString(),
      items: [
        {
          id: `item_${cs.id}_1`,
          target_url: cs.etkilenenSayfa,
          operation: "UPDATE_TAGS",
          state_before: cs.oncekiKod,
          state_after: cs.yeniKod,
          expected_hash_before: "sha256_mock_hash",
          status: cs.durum === "UYGULANDI" ? "APPLIED" : "PENDING",
        },
      ],
    }))
  );

  // Demo GSC
  const gsc = new Map<string, GscSearchMetricResponse[]>();
  gsc.set(
    demoSiteId,
    [
      { id: "gsc_1", site_id: demoSiteId, metric_date: "2026-09-01", query: "otonom seo yazılımı", page: "https://flagship-store.com/", clicks: 1240, impressions: 42000, ctr: 0.0295, position: 4.2 },
      { id: "gsc_2", site_id: demoSiteId, metric_date: "2026-09-01", query: "teknik seo denetimi", page: "https://flagship-store.com/kategori/elektronik", clicks: 840, impressions: 18500, ctr: 0.0454, position: 3.1 },
      { id: "gsc_3", site_id: demoSiteId, metric_date: "2026-09-01", query: "yapay zeka seo araçları", page: "https://flagship-store.com/fiyatlandirma", clicks: 520, impressions: 12300, ctr: 0.0422, position: 5.4 },
    ]
  );

  // Demo CrUX
  const crux = new Map<string, CruxMetricResponse[]>();
  crux.set(demoSiteId, [
    { id: "crux_1", site_id: demoSiteId, url: "https://flagship-store.com/", form_factor: "DESKTOP", p75_lcp_ms: 1800, p75_inp_ms: 120, p75_cls: 0.04, fetched_at: new Date().toISOString() },
    { id: "crux_2", site_id: demoSiteId, url: "https://flagship-store.com/", form_factor: "MOBILE", p75_lcp_ms: 2400, p75_inp_ms: 180, p75_cls: 0.08, fetched_at: new Date().toISOString() },
  ]);

  globalStore.__calpeoStore = {
    organizations: orgs,
    sites,
    crawls,
    healthReports,
    pages,
    recommendations,
    graphs,
    changeSets,
    gsc,
    crux,
  };
}

const store = globalStore.__calpeoStore;

// ==========================================
// STORE API HELPER FUNCTIONS
// ==========================================

export const serverlessStore = {
  getOrganizations(): OrganizationResponse[] {
    return Array.from(store.organizations.values());
  },

  getOrCreateDefaultOrg(userId?: string): OrganizationResponse {
    const orgs = this.getOrganizations();
    if (orgs.length > 0) return orgs[0];
    const newOrg: OrganizationResponse = {
      id: "org_" + (userId ? userId.slice(-8) : "default"),
      name: "Ana Çalışma Alanı",
      slug: "ana-calisma-alani",
      monthly_token_budget: 500000,
      tokens_used_this_month: 0,
    };
    store.organizations.set(newOrg.id, newOrg);
    return newOrg;
  },

  createOrganization(data: { name: string; slug: string }): OrganizationResponse {
    const id = "org_" + Date.now().toString(36);
    const org: OrganizationResponse = {
      id,
      name: data.name,
      slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      monthly_token_budget: 500000,
      tokens_used_this_month: 0,
    };
    store.organizations.set(id, org);
    return org;
  },

  getSites(orgId: string): SiteResponse[] {
    return Array.from(store.sites.values()).filter((s) => s.organization_id === orgId);
  },

  getSiteById(siteId: string): SiteResponse | undefined {
    return store.sites.get(siteId);
  },

  createSite(orgId: string, data: { name: string; primary_url: string; site_type?: string; execution_mode?: string }): SiteResponse {
    let cleanUrl = (data.primary_url || "").trim();
    if (!cleanUrl.startsWith("http://") && !cleanUrl.startsWith("https://")) {
      cleanUrl = "https://" + cleanUrl;
    }
    const parsed = new URL(cleanUrl);
    const domain = parsed.hostname.toLowerCase();
    const normalized = domain.replace(/^www\./i, "");

    // Organizasyon içinde aynı alan adının mükerrer eklenmesini engelle
    const existingSites = this.getSites(orgId);
    const duplicate = existingSites.find((s) => s.normalized_domain === normalized);
    if (duplicate) {
      throw new Error(`'${normalized}' alan adına sahip bir site bu organizasyonda zaten kayıtlı.`);
    }

    // Site adını temizle (HTML/XSS etiketlerini, script içeriklerini ve kontrol karakterlerini ayıkla, maks 100 karakter)
    let safeName = (data.name || "")
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .trim()
      .slice(0, 100);
    if (!safeName) safeName = normalized || domain;

    const id = "site_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
    const site: SiteResponse = {
      id,
      organization_id: orgId,
      name: safeName,
      domain,
      normalized_domain: normalized,
      primary_url: cleanUrl,
      site_type: data.site_type || "GENERAL",
      language: "tr",
      country: "TR",
      execution_mode: data.execution_mode || "ASSISTED",
      verification_status: "VERIFIED",
    };
    store.sites.set(id, site);
    store.crawls.set(id, []);
    return site;
  },

  listCrawls(siteId: string): CrawlRunResponse[] {
    return store.crawls.get(siteId) || [];
  },

  getCrawlHealth(crawlId: string): SiteHealthReportResponse | null {
    return store.healthReports.get(crawlId) || null;
  },

  getCrawlPages(crawlId: string, limit = 100, offset = 0): PaginatedPagesResponse {
    const items = store.pages.get(crawlId) || [];
    return {
      total: items.length,
      limit,
      offset,
      items: items.slice(offset, offset + limit),
    };
  },

  getRecommendations(siteId: string): RecommendationResponse[] {
    return store.recommendations.get(siteId) || [];
  },

  updateRecommendationStatus(siteId: string, recId: string, status: string): RecommendationResponse | null {
    const recs = store.recommendations.get(siteId) || [];
    const found = recs.find((r) => r.id === recId);
    if (!found) return null;
    found.status = status;
    return found;
  },

  getSiteGraph(siteId: string): SiteGraphResponse {
    return (
      store.graphs.get(siteId) || {
        site_id: siteId,
        total_nodes: 0,
        total_edges: 0,
        orphan_pages: [],
        top_pagerank_pages: [],
        linking_opportunities: [],
      }
    );
  },

  getGscMetrics(siteId: string): GscSearchMetricResponse[] {
    return store.gsc.get(siteId) || [];
  },

  getCruxMetrics(siteId: string): CruxMetricResponse[] {
    return store.crux.get(siteId) || [];
  },

  getOpportunities(siteId: string): OpportunityResponse[] {
    const gscList = this.getGscMetrics(siteId);
    if (gscList.length === 0) {
      return [
        {
          type: "HIGH_IMPRESSION_LOW_CTR",
          query: "anahtar kelime analizi",
          page: "/hizmetler",
          impressions: 12400,
          clicks: 180,
          ctr: 0.0145,
          position: 4.8,
          recommended_action: "Başlık ve meta açıklamasını arama niyetine göre yeniden yazın.",
        },
      ];
    }
    return gscList.map((g) => ({
      type: g.ctr < 0.03 ? "HIGH_IMPRESSION_LOW_CTR" : "CONTENT_EXPANSION",
      query: g.query,
      page: g.page,
      impressions: g.impressions,
      clicks: g.clicks,
      ctr: g.ctr,
      position: g.position,
      recommended_action: `Hedef sayfadaki '${g.query}' anahtar kelime kullanımını ve arama niyetini optimize edin.`,
    }));
  },

  getChangeSets(siteId: string): ChangeSetResponse[] {
    return store.changeSets.get(siteId) || [];
  },

  createChangeSet(
    siteId: string,
    data: {
      recommendation_id?: string;
      risk_level?: string;
      items: Array<{
        target_url: string;
        operation: string;
        state_before: string;
        state_after: string;
        expected_hash_before: string;
      }>;
    }
  ): ChangeSetResponse {
    const id = "cs_" + Date.now().toString(36);
    const cs: ChangeSetResponse = {
      id,
      site_id: siteId,
      recommendation_id: data.recommendation_id || null,
      status: "DRAFT",
      risk_level: data.risk_level || "LOW",
      created_at: new Date().toISOString(),
      items: data.items.map((it, idx) => ({
        id: `item_${id}_${idx + 1}`,
        target_url: it.target_url,
        operation: it.operation,
        state_before: it.state_before,
        state_after: it.state_after,
        expected_hash_before: it.expected_hash_before || "mock_pre_hash",
        status: "PENDING",
      })),
    };
    const list = store.changeSets.get(siteId) || [];
    list.unshift(cs);
    store.changeSets.set(siteId, list);
    return cs;
  },

  approveChangeSet(siteId: string, changeSetId: string): ChangeSetResponse | null {
    const list = store.changeSets.get(siteId) || [];
    const cs = list.find((c) => c.id === changeSetId);
    if (!cs) return null;
    cs.status = "APPROVED";
    return cs;
  },

  executeChangeSet(siteId: string, changeSetId: string): { success: boolean; status: string; rolled_back: boolean } {
    const list = store.changeSets.get(siteId) || [];
    const cs = list.find((c) => c.id === changeSetId);
    if (!cs) return { success: false, status: "NOT_FOUND", rolled_back: false };
    cs.status = "APPLIED";
    cs.executed_at = new Date().toISOString();
    cs.items.forEach((it) => (it.status = "APPLIED"));
    return { success: true, status: "APPLIED", rolled_back: false };
  },

  // ==========================================
  // AUTONOMOUS MULTI-PAGE LIVE CRAWLER & RULE ENGINE
  // ==========================================
  async runLiveCrawl(orgId: string, siteId: string, options: { max_pages?: number; max_depth?: number } = {}): Promise<CrawlRunResponse> {
    const site = store.sites.get(siteId);
    if (!site) throw new Error("Site bulunamadı");

    const crawlId = "crw_" + Date.now().toString(36);
    const targetUrl = site.primary_url;
    const maxPages = Math.min(options.max_pages || 10, 15);

    // Initial crawl record in progress
    const crawlRun: CrawlRunResponse = {
      id: crawlId,
      site_id: siteId,
      crawl_mode: "GOOGLEBOT_SIMULATION",
      status: "IN_PROGRESS",
      total_urls_discovered: 1,
      total_urls_crawled: 0,
      total_errors: 0,
      max_pages: maxPages,
      max_depth: options.max_depth || 3,
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    const crawlList = store.crawls.get(siteId) || [];
    crawlList.unshift(crawlRun);
    store.crawls.set(siteId, crawlList);

    const crawledPages: PageExplorerItem[] = [];
    const issuesMap = new Map<string, IssueSummaryResponse>();
    const discoveredLinks: Array<{ source: string; target: string }> = [];
    let errorCount = 0;

    // Helper to register an issue
    const addIssue = (ruleId: string, category: string, severity: IssueSummaryResponse["severity"], title: string, desc: string, rec: string, docUrl?: string) => {
      const existing = issuesMap.get(ruleId);
      if (existing) {
        existing.affected_url_count += 1;
      } else {
        issuesMap.set(ruleId, {
          rule_id: ruleId,
          category,
          severity,
          title,
          description: desc,
          recommendation_template: rec,
          documentation_url: docUrl || "https://developers.google.com/search/docs",
          affected_url_count: 1,
        });
      }
    };

    // 1. Fetch Homepage
    const urlsToVisit = [targetUrl];
    const visitedUrls = new Set<string>();
    const targetHost = new URL(targetUrl).hostname.replace(/^www\./i, "");

    while (urlsToVisit.length > 0 && visitedUrls.size < maxPages) {
      const currentUrl = urlsToVisit.shift()!;
      if (visitedUrls.has(currentUrl)) continue;
      visitedUrls.add(currentUrl);

      const t0 = Date.now();
      try {
        const fetchRes = await safeAuditFetch(currentUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          timeoutMs: 7000,
          maxRedirects: 4,
        });

        const elapsed = Date.now() - t0;
        const html = fetchRes.text;
        const statusCode = fetchRes.statusCode;

        // Parse HTML
        const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : null;

        let metaDesc: string | null = null;
        const descMatch1 = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
        const descMatch2 = html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
        if (descMatch1) metaDesc = descMatch1[1].trim();
        else if (descMatch2) metaDesc = descMatch2[1].trim();

        let canonicalUrl: string | null = null;
        const canonMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
        if (canonMatch) canonicalUrl = canonMatch[1].trim();

        const hasNoindex =
          /<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html) ||
          (fetchRes.headers["x-robots-tag"] || "").toLowerCase().includes("noindex");

        const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
        const h1Count = h1Matches.length;

        const imgMatches = html.match(/<img[^>]+>/gi) || [];
        const missingAltCount = imgMatches.filter((img) => !/alt=["'][^"']+["']/i.test(img)).length;

        const cleanText = html
          .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const wordCount = cleanText ? cleanText.split(" ").length : 0;

        const hasSchema = /<script[^>]*type=["']application\/ld\+json["']/i.test(html);

        // Deterministic Rule Evaluations
        if (statusCode >= 400) {
          addIssue("HTTP_STATUS_ERROR", "INDEXABILITY", "CRITICAL", `Sayfa HTTP ${statusCode} Hatası Döndürüyor`, "Arama motoru botları bu sayfayı tararken hata ile karşılaştı.", "Sunucu yapılandırmasını veya kırık linkleri kontrol edin.");
        }

        if (!title) {
          addIssue("TITLE_MISSING", "METADATA", "CRITICAL", "Sayfa Başlığı (<title>) Bulunamadı", "Sayfada <title> etiketi bulunmuyor.", "Sayfanın <head> bölümüne özgün bir başlık ekleyin.");
        } else if (title.length < 20 || title.length > 70) {
          addIssue("TITLE_LENGTH", "METADATA", "MEDIUM", "Sayfa Başlığı Uzunluğu İdeal Değil", `Başlık ${title.length} karakter. İdeal başlık 40-60 karakterdir.`, "Başlığınızı arama niyetine uygun olacak şekilde 40-60 karakter arasına optimize edin.");
        }

        if (!metaDesc) {
          addIssue("META_DESC_MISSING", "METADATA", "HIGH", "Meta Açıklama (Description) Eksik", "Arama motoru snippet'inde görüntülenecek meta açıklama tanımlanmamış.", "120-155 karakter uzunluğunda eylem çağrısı içeren meta açıklama yazın.");
        }

        if (!canonicalUrl) {
          addIssue("CANONICAL_MISSING", "INDEXABILITY", "MEDIUM", "Canonical Etiketi Eksik", "Sayfada rel='canonical' etiketi tanımlanmamış; yinelenen içerik riski taşır.", "Sayfanın kendine işaret eden açık canonical URL'sini ekleyin.");
        }

        if (hasNoindex) {
          addIssue("ROBOTS_NOINDEX", "INDEXABILITY", "HIGH", "Sayfada Noindex Yönergesi Var", "Sayfa arama motoru indeksine girmeyecek şekilde noindex etiketi taşıyor.", "Eğer sayfanın dizine eklenmesini istiyorsanız noindex etiketini kaldırın.");
        }

        if (h1Count === 0) {
          addIssue("H1_MISSING", "CONTENT", "HIGH", "Sayfada Ana Başlık (<h1>) Eksik", "Sayfa semantik hiyerarşisinde <h1> etiketi bulunmuyor.", "Sayfanın ana konusunu özetleyen tek bir <h1> başlığı ekleyin.");
        } else if (h1Count > 1) {
          addIssue("H1_MULTIPLE", "CONTENT", "LOW", "Sayfada Birden Fazla <h1> Etiketi Var", `Sayfada ${h1Count} adet <h1> tespit edildi.`, "Sayfa başına tek bir birincil <h1> kullanıp diğerlerini <h2> olarak yapılandırın.");
        }

        if (missingAltCount > 0) {
          addIssue("IMG_ALT_MISSING", "ACCESSIBILITY", "MEDIUM", `${missingAltCount} Görselde Alt Etiketi Eksik`, "Görsellerde ekran okuyucular ve arama motorları için açıklayıcı alt niteliği bulunmuyor.", "Tüm bilgi verici görsellere açıklayıcı alt metinleri ekleyin.");
        }

        if (wordCount < 150) {
          addIssue("THIN_CONTENT", "CONTENT", "MEDIUM", "Zayıf İçerik (Thin Content)", `Sayfa yalnızca ${wordCount} kelime içeriyor.`, "Sayfanın konusunu derinlemesine ele alan özgün içerik oluşturun.");
        }

        if (!hasSchema) {
          addIssue("SCHEMA_MISSING", "STRUCTURED_DATA", "LOW", "Yapılandırılmış Veri (JSON-LD) Yok", "Sayfada zengin snippet için Schema.org işaretlemesi bulunmuyor.", "Organization, Article, Product veya FAQPage şeması ekleyin.");
        }

        if (elapsed > 1200) {
          addIssue("SLOW_RESPONSE", "PERFORMANCE", "HIGH", "Yavaş Sunucu Yanıt Süresi (TTFB)", `Sunucu yanıt süresi ${elapsed}ms olarak ölçüldü.`, "Sunucu önbellekleme ve CDN katmanlarını optimize edin.");
        }

        // Add page record
        crawledPages.push({
          id: "pg_" + Math.random().toString(36).slice(2, 10),
          url: currentUrl,
          normalized_url: currentUrl,
          status_code: statusCode,
          depth: currentUrl === targetUrl ? 0 : 1,
          title,
          meta_description: metaDesc,
          canonical_target: canonicalUrl,
          has_noindex: hasNoindex,
          is_indexable_candidate: statusCode === 200 && !hasNoindex,
          word_count: wordCount,
          response_time_ms: elapsed,
        });

        // Discovered Internal Links
        const linkRegex = /<a[^>]+href=["']([^"'#]+)["']/gi;
        let linkMatch: RegExpExecArray | null;
        while ((linkMatch = linkRegex.exec(html)) !== null) {
          const href = linkMatch[1].trim();
          try {
            const resolved = new URL(href, currentUrl);
            if (["http:", "https:"].includes(resolved.protocol)) {
              const resHost = resolved.hostname.replace(/^www\./i, "");
              if (resHost === targetHost) {
                const cleanHref = resolved.origin + resolved.pathname;
                discoveredLinks.push({ source: currentUrl, target: cleanHref });
                if (!visitedUrls.has(cleanHref) && !urlsToVisit.includes(cleanHref) && urlsToVisit.length + visitedUrls.size < maxPages) {
                  urlsToVisit.push(cleanHref);
                }
              }
            }
          } catch {
            // ignore malformed URLs
          }
        }
      } catch (err) {
        errorCount++;
        crawledPages.push({
          id: "pg_err_" + Math.random().toString(36).slice(2, 8),
          url: currentUrl,
          normalized_url: currentUrl,
          status_code: 500,
          depth: 1,
          has_noindex: false,
          is_indexable_candidate: false,
          word_count: 0,
          response_time_ms: null,
        });
      }
    }

    // Compute Health Score (0-100)
    let score = 100;
    const issues = Array.from(issuesMap.values());
    for (const iss of issues) {
      if (iss.severity === "CRITICAL") score -= 20 * Math.min(iss.affected_url_count, 3);
      else if (iss.severity === "HIGH") score -= 10 * Math.min(iss.affected_url_count, 3);
      else if (iss.severity === "MEDIUM") score -= 5 * Math.min(iss.affected_url_count, 3);
      else score -= 2;
    }
    score = Math.max(15, Math.min(100, Math.round(score)));

    // Generate AI Recommendations
    const aiRecs: RecommendationResponse[] = [];
    issues.forEach((iss, idx) => {
      aiRecs.push({
        id: `rec_${crawlId}_${idx + 1}`,
        site_id: siteId,
        category: iss.category,
        title: `${iss.title} (${iss.affected_url_count} Sayfa)`,
        description: iss.description,
        reason: `${iss.recommendation_template} Bu durum arama motoru dizinlemesini ve kullanıcı deneyimini doğrudan etkiler.`,
        expected_impact: iss.severity === "CRITICAL" ? "+%15-20 dizin kalitesi" : "+%5-10 teknik skor artışı",
        confidence: iss.severity === "CRITICAL" ? 0.98 : 0.88,
        priority_score: iss.severity === "CRITICAL" ? 95 : iss.severity === "HIGH" ? 85 : 70,
        risk_level: iss.severity === "CRITICAL" ? "HIGH" : "LOW",
        effort: "Orta",
        evidence_json: JSON.stringify({ affected_pages: crawledPages.map((p) => p.url) }),
        rag_sources_json: JSON.stringify([iss.documentation_url || "Google Search Central: SEO Starter Guide"]),
        status: "OPEN",
        created_at: new Date().toISOString(),
      });
    });

    // Compute Directed Site Graph & PageRank
    const nodeUrls = crawledPages.map((p) => p.url);
    const inDegrees: Record<string, number> = {};
    const outDegrees: Record<string, number> = {};
    nodeUrls.forEach((u) => {
      inDegrees[u] = 0;
      outDegrees[u] = 0;
    });

    discoveredLinks.forEach((link) => {
      if (inDegrees[link.target] !== undefined) inDegrees[link.target] += 1;
      if (outDegrees[link.source] !== undefined) outDegrees[link.source] += 1;
    });

    // Simplified PageRank power iteration
    const N = Math.max(1, nodeUrls.length);
    let pageranks: Record<string, number> = {};
    nodeUrls.forEach((u) => (pageranks[u] = 1 / N));

    for (let iter = 0; iter < 10; iter++) {
      const nextPr: Record<string, number> = {};
      const damping = 0.85;
      nodeUrls.forEach((u) => (nextPr[u] = (1 - damping) / N));

      discoveredLinks.forEach((link) => {
        const srcOut = outDegrees[link.source] || 1;
        if (nextPr[link.target] !== undefined) {
          nextPr[link.target] += damping * (pageranks[link.source] / srcOut);
        }
      });
      pageranks = nextPr;
    }

    const orphanPages = nodeUrls.filter((u, idx) => idx > 0 && (inDegrees[u] || 0) === 0);
    const topPageRankPages = nodeUrls
      .map((u) => ({
        url: u,
        pagerank: Number((pageranks[u] || 0).toFixed(4)),
        in_degree: inDegrees[u] || 0,
        out_degree: outDegrees[u] || 0,
      }))
      .sort((a, b) => b.pagerank - a.pagerank)
      .slice(0, 10);

    const linkingOpps = topPageRankPages
      .slice(0, 3)
      .map((top, idx) => {
        const target = nodeUrls[nodeUrls.length - 1 - idx] || top.url;
        return {
          source_url: top.url,
          target_url: target,
          reason: "Yüksek otoriteli sayfadan derin sayfaya bağlantı eklenerek PageRank akışı güçlendirilebilir.",
          source_pagerank: top.pagerank,
          target_pagerank: pageranks[target] || 0.01,
        };
      })
      .filter((opp) => opp.source_url !== opp.target_url);

    // Save in store
    store.healthReports.set(crawlId, {
      site_id: siteId,
      crawl_run_id: crawlId,
      health_score: score,
      total_pages_evaluated: crawledPages.length,
      total_issues_found: issues.reduce((acc, i) => acc + i.affected_url_count, 0),
      issues,
    });

    store.pages.set(crawlId, crawledPages);
    store.recommendations.set(siteId, aiRecs);
    store.graphs.set(siteId, {
      site_id: siteId,
      total_nodes: nodeUrls.length,
      total_edges: discoveredLinks.length,
      orphan_pages: orphanPages,
      top_pagerank_pages: topPageRankPages,
      linking_opportunities: linkingOpps,
    });

    // Update GSC baseline metrics for newly crawled site
    store.gsc.set(
      siteId,
      crawledPages.slice(0, 8).map((p, idx) => {
        const queryTerm = (p.title || site.normalized_domain).split(/[\s|-]+/)[0] || "site araması";
        const clicks = Math.max(10, Math.floor(800 / (idx + 1)));
        const impressions = clicks * (idx + 12);
        return {
          id: `gsc_${siteId}_${idx + 1}`,
          site_id: siteId,
          metric_date: new Date().toISOString().split("T")[0],
          query: `${queryTerm} ${site.normalized_domain}`,
          page: p.url,
          clicks,
          impressions,
          ctr: Number((clicks / impressions).toFixed(4)),
          position: Number((idx + 2.5).toFixed(1)),
        };
      })
    );

    // Update CrUX baseline metrics
    const avgLatency = crawledPages.reduce((acc, p) => acc + (p.response_time_ms || 300), 0) / Math.max(1, crawledPages.length);
    store.crux.set(siteId, [
      {
        id: `crux_${siteId}_desktop`,
        site_id: siteId,
        url: targetUrl,
        form_factor: "DESKTOP",
        p75_lcp_ms: Math.round(avgLatency * 2.2),
        p75_inp_ms: 95,
        p75_cls: 0.03,
        fetched_at: new Date().toISOString(),
      },
      {
        id: `crux_${siteId}_mobile`,
        site_id: siteId,
        url: targetUrl,
        form_factor: "MOBILE",
        p75_lcp_ms: Math.round(avgLatency * 3.4),
        p75_inp_ms: 145,
        p75_cls: 0.06,
        fetched_at: new Date().toISOString(),
      },
    ]);

    // Finalize crawl run
    crawlRun.status = errorCount > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
    crawlRun.total_urls_discovered = visitedUrls.size + urlsToVisit.length;
    crawlRun.total_urls_crawled = crawledPages.length;
    crawlRun.total_errors = errorCount;
    crawlRun.finished_at = new Date().toISOString();

    return crawlRun;
  },
};
