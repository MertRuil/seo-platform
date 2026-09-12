/**
 * Arka uç yanıtlarını ekran görünüm modellerine çevirir.
 * Ekranlar yalnızca görünüm modelini bilir; canlı ve örnek veri aynı şekle iner.
 */
import type {
  CrawlRunResponse,
  CruxMetricResponse,
  GscSearchMetricResponse,
  OpportunityResponse,
  PaginatedPagesResponse,
  RecommendationResponse,
  SiteGraphResponse,
  SiteHealthReportResponse,
} from "@/lib/api";
import type { CrawlRow, CwvData, HealthData, HealthRule, IssueItem, LinksData, OpportunityItem, PageRow, PerformanceData, QueueItem, Severity } from "@/lib/demo";
import { formatDateTime, formatPercent } from "@/lib/format";

const SEVERITIES: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

export function toSeverity(s: string | null | undefined): Severity {
  const u = String(s ?? "").toUpperCase() as Severity;
  return SEVERITIES.includes(u) ? u : "INFO";
}

function hrefForCategory(category: string): string {
  const c = category.toUpperCase();
  if (c.includes("SCHEMA") || c.includes("STRUCTURED")) return "/schema";
  if (c.includes("LINK") || c.includes("ORPHAN") || c.includes("ANCHOR")) return "/links";
  if (c.includes("CONTENT") || c.includes("TITLE") || c.includes("META") || c.includes("CTR")) return "/opportunities";
  return "/changes";
}

function firstSourceTitle(ragSourcesJson: string): string {
  try {
    const arr = JSON.parse(ragSourcesJson) as Array<{ document_title?: string }>;
    return arr[0]?.document_title || "Resmi kaynak";
  } catch {
    return "Resmi kaynak";
  }
}

export function recommendationsToQueue(recs: RecommendationResponse[]): QueueItem[] {
  return recs
    .filter((r) => r.status !== "RESOLVED" && r.status !== "REJECTED")
    .map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      severity: toSeverity(r.risk_level),
      score: Math.round(r.priority_score <= 1 ? r.priority_score * 100 : r.priority_score),
      reason: r.description,
      source: firstSourceTitle(r.rag_sources_json),
      impact: r.expected_impact ?? undefined,
      confidence: r.confidence,
      href: hrefForCategory(r.category),
      actionLabel: "İncele",
    }));
}

const RULE_LABELS: Record<string, string> = {
  RULE_CANONICAL_TO_404: "Canonical hedefi 404",
  RULE_CANONICAL_LOOP: "Canonical döngüsü",
  RULE_NOINDEX_BLOCKED_BY_ROBOTS: "Robots ile engellenen noindex",
  RULE_HTTP_5XX_ERROR: "5xx sunucu hatası",
  RULE_HTTP_4XX_CLIENT_ERROR: "4xx istemci hatası",
  RULE_REDIRECT_CHAIN: "Yönlendirme zinciri",
  RULE_REDIRECT_LOOP: "Yönlendirme döngüsü",
  RULE_TITLE_MISSING: "Başlık etiketi eksik",
  RULE_TITLE_EMPTY: "Başlık etiketi boş",
  RULE_META_DESC_MISSING: "Meta açıklaması eksik",
  RULE_H1_MISSING: "H1 eksik",
  RULE_THIN_CONTENT_PROBABLE: "Olası ince içerik",
  RULE_SCHEMA_SYNTAX_ERROR: "Şema sözdizimi hatası",
};

export function healthToView(h: SiteHealthReportResponse): HealthData {
  const bySeverity = (sev: Severity) => h.issues.filter((i) => toSeverity(i.severity) === sev).length;
  const rules: HealthRule[] = Object.entries(RULE_LABELS).map(([ruleId, label]) => {
    const hit = h.issues.find((i) => i.rule_id === ruleId);
    if (!hit) return { rule: label, status: "Mükemmel", score: "100/100", note: "İhlal bulunmadı." };
    const sev = toSeverity(hit.severity);
    const status: HealthRule["status"] = sev === "CRITICAL" || sev === "HIGH" ? "Kritik" : sev === "MEDIUM" ? "Uyarı" : "İyi";
    const penalty = sev === "CRITICAL" ? 40 : sev === "HIGH" ? 25 : sev === "MEDIUM" ? 15 : 5;
    return { rule: label, status, score: `${Math.max(0, 100 - penalty)}/100`, note: `${hit.affected_url_count} URL etkilendi: ${hit.description}` };
  });
  const critical = bySeverity("CRITICAL") + bySeverity("HIGH");
  const medium = bySeverity("MEDIUM");
  return {
    score: h.health_score,
    pages: h.total_pages_evaluated,
    issues: h.total_issues_found,
    breakdown: [
      { label: "Dizinlenebilirlik & taranabilirlik", pct: Math.max(0, 100 - critical * 15) },
      { label: "Meta veri & içerik uyumu", pct: Math.max(0, 100 - medium * 8) },
      { label: "Yönlendirmeler & HTTP durumu", pct: Math.max(0, 100 - h.issues.filter((i) => i.rule_id.includes("REDIRECT") || i.rule_id.includes("HTTP")).length * 12) },
    ],
    rules,
  };
}

export function healthToIssues(h: SiteHealthReportResponse): IssueItem[] {
  return h.issues.map((i, idx) => ({
    id: `${i.rule_id}-${idx}`,
    title: i.title,
    category: i.category,
    severity: toSeverity(i.severity),
    url: `${i.affected_url_count} URL etkilendi`,
    diagnosis: i.description,
    fix: i.recommendation_template,
    before: `<!-- ${i.rule_id}: ${i.affected_url_count} URL -->`,
    after: `<!-- Öneri: ${i.recommendation_template} -->`,
    docUrl: i.documentation_url ?? undefined,
    affected: i.affected_url_count,
  }));
}

export function pagesToRows(p: PaginatedPagesResponse): PageRow[] {
  return p.items.map((it) => {
    const canonicalBroken = !!it.canonical_target && it.canonical_target !== it.normalized_url && it.status_code >= 400;
    return {
      url: it.url,
      status: it.status_code,
      title: it.title || "(başlık yok)",
      canonical: !it.canonical_target ? "—" : it.canonical_target === it.normalized_url || it.canonical_target === it.url ? "Kendisi" : it.canonical_target,
      canonicalBroken,
      indexable: it.is_indexable_candidate && !it.has_noindex,
      words: it.word_count,
      depth: it.depth,
      responseMs: it.response_time_ms ?? null,
    };
  });
}

export function gscToPerformance(rows: GscSearchMetricResponse[]): PerformanceData {
  const byQuery = new Map<string, { clicks: number; impressions: number; posSum: number; n: number }>();
  let clicks = 0;
  let impressions = 0;
  let posSum = 0;
  for (const r of rows) {
    clicks += r.clicks;
    impressions += r.impressions;
    posSum += r.position;
    const q = byQuery.get(r.query) ?? { clicks: 0, impressions: 0, posSum: 0, n: 0 };
    q.clicks += r.clicks;
    q.impressions += r.impressions;
    q.posSum += r.position;
    q.n += 1;
    byQuery.set(r.query, q);
  }
  const queries = Array.from(byQuery.entries())
    .map(([query, q]) => ({ query, clicks: q.clicks, impressions: q.impressions, ctr: q.impressions ? q.clicks / q.impressions : 0, position: q.n ? q.posSum / q.n : 0 }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 25);
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: rows.length ? posSum / rows.length : 0,
    deltas: { clicks: "", impressions: "", position: "" },
    queries,
  };
}

/** GSC satırlarını haftalık tıklama serisine indirger (görünürlük eğrisinin Google kolu). */
export function gscToWeeklySeries(rows: GscSearchMetricResponse[]): { labels: string[]; values: number[] } {
  const byWeek = new Map<string, number>();
  for (const r of rows) {
    const d = new Date(r.metric_date);
    if (Number.isNaN(d.getTime())) continue;
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    byWeek.set(key, (byWeek.get(key) ?? 0) + r.clicks);
  }
  const keys = Array.from(byWeek.keys()).sort();
  return { labels: keys.map((k) => new Date(k).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })), values: keys.map((k) => byWeek.get(k) ?? 0) };
}

export function opportunitiesToView(ops: OpportunityResponse[]): OpportunityItem[] {
  return ops.map((o) => ({
    category: o.type.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    query: o.query ?? "—",
    page: o.page ?? "—",
    impressions: o.impressions,
    clicks: o.clicks,
    ctr: o.ctr,
    targetCtr: Math.min(0.2, o.ctr * 2.5 || 0.03),
    potential: `+${Math.round(o.impressions * Math.max(0, Math.min(0.2, o.ctr * 2.5 || 0.03) - o.ctr))} tıklama/ay`,
    action: o.recommended_action,
    before: `<!-- ${o.page ?? ""} mevcut başlık/meta -->`,
    after: `<!-- ${o.recommended_action} -->`,
  }));
}

export function graphToLinks(g: SiteGraphResponse): LinksData {
  const top = g.top_pagerank_pages.map((p) => {
    const inbound = Number(p.in_degree ?? 0);
    return {
      url: String(p.url ?? ""),
      pagerank: Number(p.pagerank ?? 0),
      inbound,
      outbound: Number(p.out_degree ?? 0),
      status: inbound === 0 ? "Yetim" : inbound < 5 ? "Zayıf" : "Güçlü",
      weak: inbound < 5,
    };
  });
  return {
    nodes: g.total_nodes,
    edges: g.total_edges,
    orphans: g.orphan_pages.length,
    avgDepth: "—",
    top,
    opportunities: g.linking_opportunities.map((o) => ({ source: o.source_url, target: o.target_url, reason: o.reason })),
  };
}

export function cruxToView(rows: CruxMetricResponse[]): CwvData {
  const phone = rows.find((r) => r.form_factor === "PHONE") ?? rows[0];
  if (!phone) return { lcpMs: null, inpMs: null, cls: null };
  return { lcpMs: phone.p75_lcp_ms ?? null, inpMs: phone.p75_inp_ms ?? null, cls: phone.p75_cls ?? null, formFactor: phone.form_factor, fetchedAt: phone.fetched_at };
}

export function crawlsToRows(crawls: CrawlRunResponse[]): CrawlRow[] {
  return [...crawls]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((c) => {
      const start = c.started_at ? new Date(c.started_at).getTime() : null;
      const end = c.finished_at ? new Date(c.finished_at).getTime() : null;
      const duration = start && end ? `${Math.max(1, Math.round((end - start) / 1000))} sn` : "—";
      return {
        id: c.id.slice(0, 8).toUpperCase(),
        mode: c.crawl_mode === "OWNER_AUDIT" ? "Site sahibi tam denetimi" : "Googlebot simülasyonu",
        status: c.status,
        pages: c.total_urls_crawled,
        errors: c.total_errors,
        duration,
        date: formatDateTime(c.finished_at ?? c.created_at),
      };
    });
}

export const pct = formatPercent;
