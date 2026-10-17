import { safeAuditFetch } from "@/lib/ssrf";
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
} from "@/lib/api";

/**
 * Arka uca (FastAPI) ulaşılamadığında kullanılan bellek içi depo.
 * Yalnızca kullanıcının kendi eklediği siteleri ve gerçekten taranan verileri tutar:
 * örnek site tohumlanmaz, Search Console/CrUX verisi uydurulmaz. Ekranlardaki örnek
 * veriler istemci tarafında DemoBanner ile işaretlenerek gösterilir.
 */
type ConnectorRecord = Record<string, unknown> & { id: string; tur?: string; durum?: string };

interface GlobalStore {
  organizations: Map<string, OrganizationResponse>;
  orgMembers: Map<string, Set<string>>; // key: orgId -> userId'ler
  sites: Map<string, SiteResponse>;
  crawls: Map<string, CrawlRunResponse[]>;
  healthReports: Map<string, SiteHealthReportResponse>; // key: crawlId
  pages: Map<string, PageExplorerItem[]>; // key: crawlId
  recommendations: Map<string, RecommendationResponse[]>; // key: siteId
  graphs: Map<string, SiteGraphResponse>; // key: siteId
  changeSets: Map<string, ChangeSetResponse[]>; // key: siteId
  gsc: Map<string, GscSearchMetricResponse[]>; // key: siteId (yalnızca gerçek GSC senkronu doldurur)
  crux: Map<string, CruxMetricResponse[]>; // key: siteId (yalnızca gerçek CrUX çağrısı doldurur)
  connectors: Map<string, ConnectorRecord[]>; // key: siteId
}

const globalStore = global as unknown as { __calpeoStoreV2?: GlobalStore };

if (!globalStore.__calpeoStoreV2) {
  globalStore.__calpeoStoreV2 = {
    organizations: new Map(),
    orgMembers: new Map(),
    sites: new Map(),
    crawls: new Map(),
    healthReports: new Map(),
    pages: new Map(),
    recommendations: new Map(),
    graphs: new Map(),
    changeSets: new Map(),
    gsc: new Map(),
    crux: new Map(),
    connectors: new Map(),
  };
}

const store = globalStore.__calpeoStoreV2;

// ==========================================
// STORE API HELPER FUNCTIONS
// ==========================================

export const serverlessStore = {
  getOrganizationsForUser(userId: string): OrganizationResponse[] {
    return Array.from(store.organizations.values()).filter((o) => store.orgMembers.get(o.id)?.has(userId));
  },

  isOrgMember(orgId: string, userId: string): boolean {
    return Boolean(store.orgMembers.get(orgId)?.has(userId));
  },

  /** Kullanıcının çalışma alanı yoksa kişisel bir tane açar (arka uçtaki kayıt akışıyla aynı sonuç). */
  getOrCreateDefaultOrg(userId: string): OrganizationResponse {
    const own = this.getOrganizationsForUser(userId);
    if (own.length > 0) return own[0];
    return this.createOrganization({ name: "Çalışma alanım", slug: "calisma-alanim" }, userId);
  },

  createOrganization(data: { name: string; slug: string }, ownerId: string): OrganizationResponse {
    const id = "org_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const org: OrganizationResponse = {
      id,
      name: data.name,
      slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      monthly_token_budget: 500000,
      tokens_used_this_month: 0,
    };
    store.organizations.set(id, org);
    store.orgMembers.set(id, new Set([ownerId]));
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
    if (gscList.length === 0) return [];
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

  /**
   * Yerel modda siteye yazabilecek bir bağlayıcı çalışmaz; değişiklik uygulanmış gibi gösterilmez.
   * Gerçek yayın arka uçtaki WordPress/Cloudflare/Git bağlayıcılarıyla yapılır.
   */
  executeChangeSet(siteId: string, changeSetId: string): { success: boolean; status: string; rolled_back: boolean; detail?: string } {
    const list = store.changeSets.get(siteId) || [];
    const cs = list.find((c) => c.id === changeSetId);
    if (!cs) return { success: false, status: "NOT_FOUND", rolled_back: false, detail: "Değişiklik seti bulunamadı." };
    return {
      success: false,
      status: "NO_CONNECTOR",
      rolled_back: false,
      detail: "Siteye yazabilecek bağlı bir bağlayıcı yok. Değişikliği kopyalayıp sitenize elle uygulayabilir veya Bağlayıcılar sayfasından WordPress/Git bağlantısı kurabilirsiniz.",
    };
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
    const issuesByPage = new Map<string, IssueSummaryResponse["severity"][]>();
    const addIssue = (ruleId: string, category: string, severity: IssueSummaryResponse["severity"], title: string, desc: string, rec: string, docUrl?: string, pageUrl?: string) => {
      if (pageUrl) issuesByPage.set(pageUrl, [...(issuesByPage.get(pageUrl) ?? []), severity]);
      const existing = issuesMap.get(ruleId);
      if (existing) {
        existing.affected_url_count += 1;
        if (pageUrl && existing.affected_urls && !existing.affected_urls.includes(pageUrl)) existing.affected_urls.push(pageUrl);
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
          affected_urls: pageUrl ? [pageUrl] : [],
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
          addIssue("HTTP_STATUS_ERROR", "INDEXABILITY", "CRITICAL", "Sayfa hata kodu döndürüyor (4xx/5xx)", "Arama motorları bu sayfayı açmaya çalıştığında hata aldı; sayfa arama sonuçlarından düşebilir.", "Sayfa kalıcı olarak kaldırıldıysa ona verilen iç bağlantıları güncelleyin; olması gerekiyorsa sunucu hatasını giderin.", undefined, currentUrl);
        }

        if (!title) {
          addIssue("TITLE_MISSING", "METADATA", "CRITICAL", "Sayfa başlığı (<title>) eksik", "Arama sonuçlarında gösterilecek başlık yok; Google başlığı sayfa içeriğinden kendisi üretir.", "Sayfanın <head> bölümüne özgün bir başlık ekleyin.", undefined, currentUrl);
        } else if (title.length < 20 || title.length > 70) {
          addIssue("TITLE_LENGTH", "METADATA", "MEDIUM", "Sayfa başlığı çok kısa veya çok uzun", "Başlık 20 karakterden kısa ya da 70 karakterden uzun; uzun başlıklar arama sonuçlarında kesilir.", "Başlığınızı arama niyetine uygun olacak şekilde 40-60 karakter arasına optimize edin.", undefined, currentUrl);
        }

        if (!metaDesc) {
          addIssue("META_DESC_MISSING", "METADATA", "HIGH", "Meta açıklama eksik", "Arama sonucunda başlığın altında görünecek açıklama tanımlanmamış; Google sayfadan rastgele bir metin seçer.", "120-155 karakter uzunluğunda eylem çağrısı içeren meta açıklama yazın.", undefined, currentUrl);
        }

        if (!canonicalUrl) {
          addIssue("CANONICAL_MISSING", "INDEXABILITY", "MEDIUM", "Canonical etiketi eksik", "Sayfanın asıl adresi belirtilmemiş; parametreli veya kopya adresler ayrı sayfa gibi değerlendirilebilir.", "Sayfanın kendine işaret eden açık canonical URL'sini ekleyin.", undefined, currentUrl);
        }

        if (hasNoindex) {
          addIssue("ROBOTS_NOINDEX", "INDEXABILITY", "HIGH", "Sayfa arama dizininden hariç tutulmuş (noindex)", "Sayfa noindex yönergesi taşıyor; Google bu sayfayı arama sonuçlarında göstermez.", "Eğer sayfanın dizine eklenmesini istiyorsanız noindex etiketini kaldırın.", undefined, currentUrl);
        }

        if (h1Count === 0) {
          addIssue("H1_MISSING", "CONTENT", "HIGH", "Ana başlık (<h1>) eksik", "Sayfanın konusunu belirten ana başlık yok; hem kullanıcılar hem arama motorları için konu belirsizleşir.", "Sayfanın ana konusunu özetleyen tek bir <h1> başlığı ekleyin.", undefined, currentUrl);
        } else if (h1Count > 1) {
          addIssue("H1_MULTIPLE", "CONTENT", "LOW", "Birden fazla ana başlık (<h1>)", "Sayfada birden fazla <h1> var; ana konu tek bir başlıkla daha net anlatılır.", "Sayfa başına tek bir birincil <h1> kullanıp diğerlerini <h2> olarak yapılandırın.", undefined, currentUrl);
        }

        if (missingAltCount > 0) {
          addIssue("IMG_ALT_MISSING", "ACCESSIBILITY", "MEDIUM", "Görsellerde alt metni eksik", "Bazı görsellerde ekran okuyucular ve görsel arama için açıklayıcı alt metni yok.", "Tüm bilgi verici görsellere açıklayıcı alt metinleri ekleyin.", undefined, currentUrl);
        }

        if (wordCount < 150) {
          addIssue("THIN_CONTENT", "CONTENT", "MEDIUM", "Az içerikli sayfa", "Sayfada 150 kelimeden az metin var; arama motorları sayfanın konusunu anlamakta zorlanabilir.", "Sayfanın konusunu derinlemesine ele alan özgün içerik oluşturun.", undefined, currentUrl);
        }

        if (!hasSchema) {
          addIssue("SCHEMA_MISSING", "STRUCTURED_DATA", "LOW", "Yapılandırılmış veri (JSON-LD) yok", "Sayfada Schema.org işaretlemesi yok; zengin sonuçlar ve AI yanıt motorları sayfayı daha zor yorumlar.", "Organization, Article, Product veya FAQPage şeması ekleyin.", undefined, currentUrl);
        }

        if (elapsed > 1200) {
          addIssue("SLOW_RESPONSE", "PERFORMANCE", "HIGH", "Sunucu yavaş yanıt veriyor", "Tarama sırasında sayfanın yanıtı 1,2 saniyeden uzun sürdü (kullanıcı ölçümü değildir).", "Sunucu önbellekleme ve CDN katmanlarını optimize edin.", undefined, currentUrl);
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
      } catch {
        errorCount++;
        addIssue("PAGE_FETCH_ERROR", "CRAWLABILITY", "CRITICAL", "Sayfaya ulaşılamadı", "Tarama sırasında sayfadan yanıt alınamadı; içerik kontrol edilemedi.", "Site adresini, DNS ve sunucu bağlantısını kontrol edip taramayı yeniden başlatın.", undefined, currentUrl);
        // Sayfaya hiç ulaşılamadı: sunucu 500 döndürmüş gibi gösterilmez (0 = yanıt yok).
        crawledPages.push({
          id: "pg_err_" + Math.random().toString(36).slice(2, 8),
          url: currentUrl,
          normalized_url: currentUrl,
          status_code: 0,
          depth: 1,
          has_noindex: false,
          is_indexable_candidate: false,
          word_count: 0,
          response_time_ms: null,
        });
      }
    }

    // Sağlık puanı: Python kural motoruyla aynı yöntem. Her sayfa 100'den başlar;
    // kritik -15, yüksek -8, orta -4, düşük -1. Site puanı sayfa puanlarının ortalamasıdır.
    const issues = Array.from(issuesMap.values());
    const penalty: Record<string, number> = { CRITICAL: 15, HIGH: 8, MEDIUM: 4, LOW: 1, INFO: 0 };
    // Yanıt alınamayan sayfalara içerik puanı atanmaz; hiçbir sayfa okunamadıysa sağlıklı sayılmaz.
    const pageScores = crawledPages.filter((p) => p.status_code > 0).map((p) => Math.max(0, 100 - (issuesByPage.get(p.url) ?? []).reduce((acc, sev) => acc + (penalty[sev] ?? 0), 0)));
    const score = pageScores.length ? Math.round(pageScores.reduce((a, b) => a + b, 0) / pageScores.length) : 0;

    // Generate AI Recommendations
    const aiRecs: RecommendationResponse[] = [];
    issues.forEach((iss, idx) => {
      aiRecs.push({
        id: `rec_${crawlId}_${idx + 1}`,
        site_id: siteId,
        category: iss.category,
        title: `${iss.title} (${iss.affected_url_count} sayfa)`,
        description: iss.description,
        reason: iss.recommendation_template,
        expected_impact: null,
        confidence: 1,
        priority_score: iss.severity === "CRITICAL" ? 95 : iss.severity === "HIGH" ? 85 : iss.severity === "MEDIUM" ? 70 : 50,
        risk_level: iss.severity === "CRITICAL" ? "HIGH" : "LOW",
        effort: "Orta",
        evidence_json: JSON.stringify({ affected_pages: iss.affected_urls ?? [] }),
        rag_sources_json: JSON.stringify([{ document_title: iss.documentation_url || "Google Search Central" }]),
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

    // Finalize crawl run
    crawlRun.status = errorCount > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
    crawlRun.total_urls_discovered = visitedUrls.size + urlsToVisit.length;
    crawlRun.total_urls_crawled = crawledPages.length;
    crawlRun.total_errors = errorCount;
    crawlRun.finished_at = new Date().toISOString();

    return crawlRun;
  },

  listConnectors(siteId: string): ConnectorRecord[] {
    return store.connectors.get(siteId) ?? [];
  },

  saveConnector(siteId: string, connector: ConnectorRecord & Record<string, string | undefined>) {
    const list = this.listConnectors(siteId);
    const existingIdx = list.findIndex((c) => c.id === connector.id || (connector.connector_type && c.tur === connector.connector_type));
    let updated;
    if (existingIdx >= 0) {
      list[existingIdx] = {
        ...list[existingIdx],
        ...connector,
        durum: connector.durum || list[existingIdx].durum || "Test Edilmedi",
      };
      updated = list[existingIdx];
    } else {
      const newConn = {
        id: connector.id || `conn_${Date.now()}`,
        ad: connector.ad || connector.connector_type || "Yeni Bağlayıcı",
        tur: connector.tur || connector.connector_type || "Özel",
        durum: connector.durum || "Test Edilmedi",
        aciklama: connector.aciklama || "Bağlayıcı eklendi (Henüz test edilmedi).",
        endpoint: connector.endpoint || connector.base_url || "",
        tokenMasked: connector.tokenMasked || "••••••••••••",
      };
      list.push(newConn);
      updated = newConn;
    }
    store.connectors.set(siteId, list);
    return updated;
  },

  deleteConnector(siteId: string, connectorId: string) {
    const list = this.listConnectors(siteId);
    const next = list.filter((c) => c.id !== connectorId);
    store.connectors.set(siteId, next);
    return true;
  },
};
