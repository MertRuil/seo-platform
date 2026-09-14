"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, ArrowUpRight, Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Zap, Users, Activity, HelpCircle } from "lucide-react";
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
  const { density, setDensity } = useDensity();
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

      {density === "summary" ? (
        /* ================= SADE & BAŞLANGIÇ MODU ================= */
        <div className="space-y-6 animate-fade-in">
          {/* 1. Üst Durum Kartı (Hero Banner) */}
          <div className="relative overflow-hidden rounded-xl border border-line bg-gradient-to-br from-surface via-surface to-surface-2 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-evidence/15 text-evidence-ink">
                    🌱 Sade Mod · {site ? site.name : "Siteniz"}
                  </span>
                  <span className="text-2xs text-muted">Son {period} gün</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-ink">
                  {d.health.score >= 80 ? "Sitenizin Durumu Harika! 🎉" : "Sitenizde Büyüme Fırsatları Var 🚀"}
                </h1>
                <p className="text-sm text-muted leading-relaxed">
                  Google aramalarında bulunabilirliğiniz güçlü. Yapay zekamız, arama sonuçlarında daha çok kişiye ulaşmanız için sitenizde hemen uygulayabileceğiniz {topQueue.length} kritik fırsat belirledi.
                </p>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-center p-4 rounded-xl bg-surface border border-line shadow-sm min-w-[120px]">
                  <div className="text-2xs uppercase tracking-wider text-muted font-bold">Sağlık Puanı</div>
                  <div className="text-3xl font-bold text-evidence mt-1">
                    {d.health.score} <span className="text-xs text-muted font-normal">/ 100</span>
                  </div>
                  <div className="text-2xs text-muted mt-0.5">{d.health.critical > 0 ? `${d.health.critical} acil işlem` : "Kusursuz"}</div>
                </div>

                <Link
                  href="/changes"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-accent hover:bg-accent-strong text-accent-contrast font-semibold text-sm shadow-sm transition-colors"
                >
                  <Zap className="w-4 h-4" />
                  <span>Önerileri Uygula</span>
                </Link>
              </div>
            </div>
          </div>

          {/* 2. Üç Sade Anahtar Gösterge */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-xl border border-line bg-surface flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-muted mb-2">
                  <span>Google Ziyaretçileri</span>
                  <Users className="w-4 h-4 text-accent" />
                </div>
                <div className="text-2xl font-bold text-ink">
                  {formatCompact(d.search.clicks)} <span className="text-xs font-normal text-muted">kişi</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-line/60 text-xs text-muted flex items-center justify-between">
                <span>Son {period} günde Google'dan</span>
                <span className={trendUp ? "text-evidence font-semibold" : "text-critical font-semibold"}>
                  {trendUp ? "+" : ""}
                  {formatNumber(d.visibilityDelta, 1)}%
                </span>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-line bg-surface flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-muted mb-2">
                  <span>İncelenen Sayfa</span>
                  <Activity className="w-4 h-4 text-evidence" />
                </div>
                <div className="text-2xl font-bold text-ink">
                  {formatNumber(d.health.pages)} <span className="text-xs font-normal text-muted">sayfa</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-line/60 text-xs text-muted flex items-center justify-between">
                <span>Teknik engel</span>
                <span className={d.health.critical > 0 ? "text-critical font-semibold" : "text-evidence font-semibold"}>
                  {d.health.critical > 0 ? `${d.health.critical} kritik sorun` : "Sıfır kritik hata"}
                </span>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-line bg-surface flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs text-muted mb-2">
                  <span>Yapay Zeka Hazırlığı</span>
                  <Sparkles className="w-4 h-4 text-warn" />
                </div>
                <div className="text-2xl font-bold text-ink">
                  {topQueue.length} <span className="text-xs font-normal text-muted">hazır görev</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-line/60 text-xs text-muted flex items-center justify-between">
                <span>Otomasyon durumu</span>
                <span className="text-accent font-semibold">1-tıkla onay bekliyor</span>
              </div>
            </div>
          </div>

          {/* 3. Yapay Zeka Öncelikli Yapılacaklar (1-Tıkla Aksiyon Listesi) */}
          <div className="rounded-xl border border-line bg-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-ink flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <span>Sitenizi Büyütecek Öncelikli Görevler</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Karmaşık kodlarla uğraşmanıza gerek yok. Aşağıdaki görevleri tek tıkla sitenize uygulayabilirsiniz:
                </p>
              </div>
              <Link href="/opportunities" className="text-xs font-semibold text-accent-ink hover:underline">
                Tümünü Gör ({queue.pending}) →
              </Link>
            </div>

            <div className="space-y-3">
              {topQueue.length === 0 ? (
                <div className="text-center py-8 text-muted text-sm">
                  Tebrikler! Şu an için yapılması gereken acil bir işlem bulunmuyor.
                </div>
              ) : (
                topQueue.map((q, idx) => (
                  <div
                    key={q.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-line bg-surface-2/50 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-ink">{q.title}</div>
                        <p className="text-xs text-muted mt-0.5">
                          {q.impact ? `Beklenen fayda: ${q.impact} artış` : "Arama sonuçlarında üst sıralara taşır"} · {q.source}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={q.href}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-accent hover:bg-accent-strong text-accent-contrast text-xs font-semibold shrink-0 transition-colors"
                    >
                      <span>{q.actionLabel || "Hemen Uygula"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 4. Sade Trafik Özeti Grafiği */}
          <Panel
            title="Google Ziyaretçi Akışı"
            sub="Son dönemde sitenize Google aramalarından gelen kullanıcı sayısı"
            actions={
              <Badge tone={trendUp ? "evidence" : "critical"} mono>
                {trendUp ? "Artış Eğiliminde" : "Düşüş Eğiliminde"}
              </Badge>
            }
          >
            {hasSeries ? (
              <div className="py-2">
                <TrendChart
                  labels={d.series.labels}
                  series={[{ name: "Google Ziyaretçileri", values: d.series.google, tone: "accent" as const }]}
                  markers={[]}
                  height={180}
                  ariaLabel="Ziyaretçi akışı"
                  format={(n) => formatCompact(n)}
                />
              </div>
            ) : (
              <EmptyState title="Veri Bekleniyor" description="Search Console verileri biriktikçe ziyaretçi grafiğiniz burada oluşur." />
            )}
          </Panel>

          {/* 5. Uzman Moduna Geçiş Çubuğu */}
          <div className="p-4 rounded-xl border border-line bg-surface-2/60 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface border border-line flex items-center justify-center text-lg">
                ⚡
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-ink">Daha detaylı teknik analizler mi arıyorsunuz?</div>
                <div className="text-2xs text-muted">
                  TTFB hızları, şema işaretlemeleri, yapay zeka model kırılımları ve tarama logları için dilediğiniz an Uzman Modu'na geçebilirsiniz.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDensity("expert")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-surface border border-line hover:border-line-strong text-ink text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm"
            >
              <span>⚡ Uzman Modunu Aç</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* ================= UZMAN & AJANS MODU ================= */
        <div className="space-y-5 animate-fade-in">
          {/* Uzman Modu Bildirim Şeridi */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-accent/20 bg-accent/5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-accent">⚡ Uzman Modu Aktif</span>
              <span className="text-muted hidden sm:inline">· Tüm teknik telemetri, model kırılımları ve denetim araçları devrede.</span>
            </div>
            <button
              type="button"
              onClick={() => setDensity("summary")}
              className="text-xs font-semibold text-accent-ink hover:underline cursor-pointer"
            >
              🌱 Sade Moda Geç
            </button>
          </div>

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

          {/* Model kırılımı ve derin telemetri */}
          <section className="space-y-5">
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
        </div>
      )}
    </div>
  );
}
