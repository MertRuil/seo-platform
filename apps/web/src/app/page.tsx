"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, ArrowUpRight } from "lucide-react";
import { useDensity } from "@/context/DensityContext";
import { useSite } from "@/context/SiteContext";
import { useSiteData } from "@/hooks/useSiteData";
import { useQueue } from "@/hooks/useQueue";
import { api } from "@/lib/api";
import { DEMO_DASHBOARD, type DashboardData } from "@/lib/demo";
import { gscToPerformance, gscToWeeklySeries } from "@/lib/mappers";
import { formatCompact, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { Panel, Inset } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge, BetaBadge, severityStripeClass } from "@/components/ui/Badge";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { TrendChart, ChartLegend } from "@/components/ui/TrendChart";
import { EmptyState, Notice, SkeletonRows } from "@/components/ui/States";
import { cn } from "@/lib/cn";

interface Overview {
  series: DashboardData["series"];
  markers: DashboardData["markers"];
  googleScore: number;
  aiScore?: number;
  visibilityDelta: number;
  health: DashboardData["health"];
  search: DashboardData["search"];
  impact: DashboardData["impact"];
}

const DEMO_OVERVIEW: Overview = {
  series: DEMO_DASHBOARD.series,
  markers: DEMO_DASHBOARD.markers,
  googleScore: DEMO_DASHBOARD.googleScore,
  aiScore: DEMO_DASHBOARD.aiScore,
  visibilityDelta: DEMO_DASHBOARD.visibilityDelta,
  health: DEMO_DASHBOARD.health,
  search: DEMO_DASHBOARD.search,
  impact: DEMO_DASHBOARD.impact,
};

export default function GenelGorunumPage() {
  const { density } = useDensity();
  const { site, crawl, period } = useSite();
  const queue = useQueue();

  // Canlı: sağlık raporu + GSC haftalık tıklama serisi. AI kolu ölçüm gelene kadar yalnızca örnek veride (Beta).
  const overview = useSiteData<Overview>(
    "overview",
    async ({ org, site: s, crawl: c }) => {
      const [health, gsc] = await Promise.all([api.getCrawlHealth(org.id, s.id, c!.id), api.getGscMetrics(org.id, s.id).catch(() => [])]);
      const weekly = gscToWeeklySeries(gsc);
      const perf = gscToPerformance(gsc);
      const critical = health.issues.filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH").length;
      const first = weekly.values[0] ?? 0;
      const last = weekly.values[weekly.values.length - 1] ?? 0;
      return {
        series: { labels: weekly.labels, google: weekly.values },
        markers: [],
        googleScore: health.health_score,
        visibilityDelta: first > 0 ? ((last - first) / first) * 100 : 0,
        health: { score: health.health_score, pages: health.total_pages_evaluated, critical, delta: 0 },
        search: { clicks: perf.clicks, ctr: perf.ctr, position: perf.position },
        impact: { lift: 0, confidence: 0, experiments: 0 },
      };
    },
    DEMO_OVERVIEW
  );

  const d = overview.data;
  const isDemo = overview.source === "demo";
  const topQueue = queue.data.slice(0, 4);
  const criticalCount = queue.critical;
  const trendUp = d.visibilityDelta >= 0;
  const hasSeries = d.series.google.length > 1;

  // Hızlı denetim
  const [auditUrl, setAuditUrl] = useState("");
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<{ score: number; url: string; total: number; critical: number } | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  const handleQuickAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditUrl.trim()) return;
    setIsAuditing(true);
    setAuditError(null);
    setAuditResult(null);
    try {
      const formatted = /^https?:\/\//.test(auditUrl) ? auditUrl : `https://${auditUrl}`;
      const res = await fetch("/api/v1/audit/quick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: formatted }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Denetim gerçekleştirilemedi.");
      const issues = (data.issues || []) as Array<{ severity: string }>;
      setAuditResult({ score: data.overall_score ?? data.health_score ?? 0, url: data.metadata?.url || formatted, total: issues.length, critical: issues.filter((i) => i.severity === "CRITICAL").length });
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : "Analiz sırasında bir hata oluştu.");
    } finally {
      setIsAuditing(false);
    }
  };

  const headline = useMemo(() => {
    const first = trendUp ? "Görünürlük artıyor" : "Görünürlük geriliyor";
    const second = criticalCount > 0 ? `${criticalCount} kritik iş karar bekliyor.` : "karar bekleyen kritik iş yok.";
    return { first, second };
  }, [trendUp, criticalCount]);

  const chartSeries = [
    { name: "Google", values: d.series.google, tone: "accent" as const },
    ...(d.series.ai ? [{ name: "AI atıf (beta)", values: d.series.ai, tone: "evidence" as const, dashed: true }] : []),
  ];

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={overview.source} reason={overview.reason} error={overview.error} />

      {/* Sayfa başlığı: durum cümlesi + hızlı denetim */}
      <section className="flex flex-col xl:flex-row xl:items-end justify-between gap-5 border-b border-line pb-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-wider text-muted">
            <span className="calpeo-mark" aria-hidden />
            <span className="truncate">
              Genel görünüm · {site ? site.name : "Acme Türkiye"} · son {period} gün
            </span>
          </div>
          <h1 className="font-editorial text-3xl sm:text-4xl font-normal tracking-tight text-ink leading-[1.1] mt-2 text-balance">
            {headline.first}, <span className={criticalCount > 0 ? "text-critical" : "text-evidence"}>{headline.second}</span>
          </h1>
          <p className="text-sm text-muted mt-2">
            Google organik {d.series.ai ? "+ AI yanıt motorları (beta)" : ""} · {crawl ? `son tarama ${formatRelative(crawl.finished_at ?? crawl.created_at)}` : "son tarama 12 Eyl 14:00 (örnek)"} ·{" "}
            {formatNumber(d.health.pages)} URL
          </p>
        </div>

        <form onSubmit={handleQuickAudit} className="w-full xl:w-[420px] shrink-0" aria-label="Hızlı URL denetimi">
          <div className="flex gap-2">
            <Input icon={<Search className="w-4 h-4" />} type="text" value={auditUrl} onChange={(e) => setAuditUrl(e.target.value)} placeholder="Herhangi bir URL'yi hızlı denetle" aria-label="Denetlenecek URL" />
            <Button type="submit" loading={isAuditing} className="shrink-0">
              Denetle
            </Button>
          </div>
          {auditError && (
            <Notice tone="error" className="mt-2">
              {auditError}
            </Notice>
          )}
          {auditResult && (
            <div className="mt-2 flex items-center justify-between gap-3 p-3 bg-surface border border-line rounded-sm text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-ink truncate">{auditResult.url}</span>
                  <Badge tone="evidence" mono>
                    Skor {auditResult.score}/100
                  </Badge>
                </div>
                <p className="text-muted mt-0.5">
                  {auditResult.total} tespit, {auditResult.critical} kritik.
                </p>
              </div>
              <Link href="/crawls" className="text-accent-ink font-semibold hover:underline inline-flex items-center gap-1 shrink-0">
                Detay <ChevronRight className="w-3.5 h-3.5" aria-hidden />
              </Link>
            </div>
          )}
        </form>
      </section>

      {/* Çalışma alanı: görünürlük eğrisi + karar kuyruğu */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <Panel
          className="xl:col-span-8"
          title="Görünürlük"
          sub={d.series.ai ? "Google organik ve AI atıf, tek eğri ve kırılım · dağıtımlar işaretli" : "Google organik tıklamalar (GSC) · dağıtımlar işaretli"}
          actions={
            <Badge tone={trendUp ? "evidence" : "critical"} mono>
              {trendUp ? "+" : ""}
              {formatNumber(d.visibilityDelta, 1)} % · {period} gün
            </Badge>
          }
        >
          {overview.loading ? (
            <SkeletonRows rows={5} />
          ) : hasSeries ? (
            <>
              <TrendChart labels={d.series.labels} series={chartSeries} markers={d.markers.map((m) => ({ ...m, windowPoints: 2 }))} height={230} ariaLabel="Görünürlük zaman serisi" format={(n) => formatCompact(n)} />
              <ChartLegend
                items={[
                  { label: `Google · ${d.googleScore}`, tone: "accent" },
                  ...(d.series.ai
                    ? [
                        {
                          label: (
                            <span className="inline-flex items-center gap-1.5">
                              AI atıf · {d.aiScore ?? "—"} <BetaBadge />
                            </span>
                          ),
                          tone: "evidence" as const,
                          dashed: true,
                        },
                      ]
                    : []),
                  { label: "Dağıtım işareti · etki penceresi", tone: "warn" },
                ]}
              />
            </>
          ) : (
            <EmptyState
              title="Henüz zaman serisi yok"
              description="Google Search Console bağlandığında ve en az iki haftalık veri biriktiğinde eğri burada oluşur."
              action={
                <Link href="/integrations" className="text-sm font-semibold text-accent-ink hover:underline">
                  Search Console'u bağla →
                </Link>
              }
            />
          )}
        </Panel>

        <Panel className="xl:col-span-4" title="Bu hafta karar bekleyen" sub="Etki · güven · kanıt" actions={<Badge tone="neutral" mono>{topQueue.length} / {queue.pending}</Badge>}>
          {queue.loading ? (
            <SkeletonRows rows={4} />
          ) : topQueue.length === 0 ? (
            <EmptyState title="Karar bekleyen iş yok" description="Yeni tarama sonrası öneriler burada sıralanır." />
          ) : (
            <ul className="space-y-2">
              {topQueue.map((q) => (
                <li key={q.id}>
                  <Link href={q.href} className="grid grid-cols-[4px_1fr_auto] gap-3 items-center p-2.5 rounded-sm border border-line bg-surface hover:bg-surface-2 hover:border-line-strong transition-colors">
                    <span className={cn("w-1 self-stretch rounded-full", severityStripeClass(q.severity))} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink truncate">{q.title}</span>
                      <span className="block font-mono text-2xs text-muted truncate">
                        {q.impact ?? "—"} · güven {q.confidence !== undefined ? `%${Math.round(q.confidence * 100)}` : "—"} · {q.source}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-accent-ink inline-flex items-center gap-0.5 whitespace-nowrap">
                      {q.actionLabel} <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 pt-3 border-t border-line">
            <Link href="/opportunities" className="text-xs font-semibold text-accent-ink hover:underline inline-flex items-center gap-1">
              Tüm kuyruğu gör ({queue.pending}) <ChevronRight className="w-3.5 h-3.5" aria-hidden />
            </Link>
          </div>
        </Panel>
      </section>

      {/* Bağlam şeridi */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link href="/health" className="block bg-surface border border-line rounded-md px-5 py-4 hover:bg-surface-2 transition-colors">
          <div className="text-xs text-muted">Teknik sağlık</div>
          <div className="font-editorial text-2xl text-ink mt-1 tabular-nums">
            {d.health.score} <span className="font-mono text-2xs text-muted">/ 100</span>
          </div>
          <div className="text-xs text-muted mt-1">
            {formatNumber(d.health.pages)} URL · <span className={d.health.critical > 0 ? "text-critical font-semibold" : "text-evidence"}>{d.health.critical} kritik</span>
            {d.health.delta ? ` · +${formatNumber(d.health.delta, 1)}` : ""}
          </div>
        </Link>
        <Link href="/performance" className="block bg-surface border border-line rounded-md px-5 py-4 hover:bg-surface-2 transition-colors">
          <div className="text-xs text-muted">Arama performansı</div>
          <div className="font-editorial text-2xl text-ink mt-1 tabular-nums">
            {formatCompact(d.search.clicks)} <span className="font-mono text-2xs text-muted">tıklama</span>
          </div>
          <div className="text-xs text-muted mt-1">
            GSC {period} gün · TO {formatPercent(d.search.ctr)} · poz. {formatNumber(d.search.position, 1)}
          </div>
        </Link>
        <Link href="/experiments" className="block bg-surface border border-line rounded-md px-5 py-4 hover:bg-surface-2 transition-colors">
          <div className="text-xs text-muted">Ölçülen etki</div>
          <div className={cn("font-editorial text-2xl mt-1 tabular-nums", d.impact.experiments > 0 ? "text-evidence" : "text-muted")}>
            {d.impact.experiments > 0 ? `+${formatNumber(d.impact.lift, 1)} %` : "—"}
          </div>
          <div className="text-xs text-muted mt-1">
            {d.impact.experiments > 0 ? `DiD · dizin kapsamı · güven %${Math.round(d.impact.confidence * 100)} · ${d.impact.experiments} deney` : "Henüz tamamlanmış deney yok"}
          </div>
        </Link>
      </section>

      {/* Uzman yoğunluğu: model kırılımı ve derin telemetri (ölçüm gelene kadar örnek, Beta) */}
      {density === "expert" && (
        <section className="space-y-5 animate-fade-in">
          <Panel
            title={
              <span className="inline-flex items-center gap-2">
                Model ve arama motoru kırılımı <BetaBadge />
              </span>
            }
            sub="AI motoru atıf ölçümü henüz canlı değil; değerler örnek. Ölçüm katmanı geldiğinde burada gerçek prompt takibi görünür."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {DEMO_DASHBOARD.engines.map((m) => (
                <Inset key={m.name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink truncate">{m.name}</span>
                    <span className="text-evidence font-mono font-semibold inline-flex items-center gap-0.5">
                      <ArrowUpRight className="w-3 h-3" aria-hidden />
                      {m.trend}
                    </span>
                  </div>
                  <div className="text-xl font-mono font-semibold text-ink mt-1 tabular-nums">{m.score}</div>
                  <div className="text-2xs text-muted">{m.status}</div>
                </Inset>
              ))}
            </div>
          </Panel>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Panel>
              <div className="font-mono text-2xs uppercase tracking-wider text-muted">Dizinlenebilirlik</div>
              <div className="text-xl font-mono font-semibold text-ink mt-1">{isDemo ? DEMO_DASHBOARD.technical.indexability : `${formatNumber(((d.health.pages - d.health.critical) / Math.max(1, d.health.pages)) * 100, 1)} %`}</div>
              <p className="text-xs text-muted mt-1">robots.txt ve canonical uyumlu URL oranı</p>
            </Panel>
            <Panel>
              <div className="font-mono text-2xs uppercase tracking-wider text-muted">Ortalama yanıt (TTFB)</div>
              <div className="text-xl font-mono font-semibold text-evidence mt-1">{DEMO_DASHBOARD.technical.ttfb}</div>
              <p className="text-xs text-muted mt-1">p75 · örnek değer</p>
            </Panel>
            <Panel>
              <div className="font-mono text-2xs uppercase tracking-wider text-muted">Şema kapsamı</div>
              <div className="text-xl font-mono font-semibold text-ink mt-1">{DEMO_DASHBOARD.technical.schemaCoverage}</div>
              <p className="text-xs text-muted mt-1">Organization, BreadcrumbList, FAQPage · örnek değer</p>
            </Panel>
          </div>
        </section>
      )}

    </div>
  );
}
