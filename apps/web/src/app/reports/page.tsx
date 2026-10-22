"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, Download, Printer, Copy, Check, AlertTriangle, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { useSite } from "@/context/SiteContext";
import { useSiteData } from "@/hooks/useSiteData";
import { api } from "@/lib/api";
import { formatNumber, formatDateTime } from "@/lib/format";

interface ReportQuery {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

interface ReportData {
  crawlFinishedAt: string | null;
  healthScore: number | null;
  pagesEvaluated: number | null;
  issuesFound: number | null;
  topIssues: { title: string; severity: string; affected: number }[];
  clicks: number | null;
  impressions: number | null;
  topQueries: ReportQuery[];
  backlinkTotal: number | null;
  toxicBacklinks: number | null;
  resolvedCount: number | null;
  resolved: string[];
  pendingCount: number | null;
  pending: string[];
}

const DEMO_REPORT: ReportData = {
  crawlFinishedAt: null,
  healthScore: 72,
  pagesEvaluated: 140,
  issuesFound: 23,
  topIssues: [
    { title: "Eksik meta açıklama", severity: "MEDIUM", affected: 18 },
    { title: "Kırık iç bağlantı", severity: "HIGH", affected: 4 },
  ],
  clicks: 1200,
  impressions: 38000,
  topQueries: [
    { query: "örnek anahtar kelime", clicks: 120, impressions: 2400, position: 4.2 },
    { query: "örnek ürün sorgusu", clicks: 80, impressions: 3100, position: 8.7 },
  ],
  backlinkTotal: 12,
  toxicBacklinks: 1,
  resolvedCount: 2,
  resolved: ["Örnek: kırık kategori URL'si 301 ile yönlendirildi"],
  pendingCount: 3,
  pending: ["Örnek: ürün sayfalarına Product şeması eklenmesi"],
};

const settled = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === "fulfilled" ? r.value : null);

export default function ReportsPage() {
  const { site } = useSite();

  const res = useSiteData<ReportData>(
    "report",
    async ({ org, site, crawl }) => {
      const [health, gsc, backlinks, recs] = await Promise.allSettled([
        crawl ? api.getCrawlHealth(org.id, site.id, crawl.id) : Promise.reject(new Error("no crawl")),
        api.getGscMetrics(org.id, site.id),
        api.getBacklinks(org.id, site.id),
        api.getRecommendations(org.id, site.id),
      ]);
      const h = settled(health);
      const g = settled(gsc);
      const b = settled(backlinks);
      const r = settled(recs);

      const byQuery = new Map<string, { clicks: number; impressions: number; posWeighted: number }>();
      for (const row of g ?? []) {
        const cur = byQuery.get(row.query) ?? { clicks: 0, impressions: 0, posWeighted: 0 };
        cur.clicks += row.clicks;
        cur.impressions += row.impressions;
        cur.posWeighted += row.position * row.impressions;
        byQuery.set(row.query, cur);
      }
      const topQueries = [...byQuery.entries()]
        .map(([query, v]) => ({
          query,
          clicks: v.clicks,
          impressions: v.impressions,
          position: v.impressions > 0 ? v.posWeighted / v.impressions : 0,
        }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10);

      const sortedRecs = [...(r ?? [])].sort((a, b) => b.priority_score - a.priority_score);
      const resolved = sortedRecs.filter((x) => x.status === "RESOLVED");
      const pending = sortedRecs.filter((x) => x.status !== "RESOLVED" && x.status !== "REJECTED");

      return {
        crawlFinishedAt: crawl?.finished_at ?? null,
        healthScore: h?.health_score ?? null,
        pagesEvaluated: h?.total_pages_evaluated ?? null,
        issuesFound: h?.total_issues_found ?? null,
        topIssues: (h?.issues ?? [])
          .slice()
          .sort((a, b) => b.affected_url_count - a.affected_url_count)
          .slice(0, 5)
          .map((i) => ({ title: i.title, severity: i.severity, affected: i.affected_url_count })),
        clicks: g ? g.reduce((s, x) => s + x.clicks, 0) : null,
        impressions: g ? g.reduce((s, x) => s + x.impressions, 0) : null,
        topQueries,
        backlinkTotal: b ? b.length : null,
        toxicBacklinks: b ? b.filter((x) => x.is_toxic).length : null,
        resolvedCount: r ? resolved.length : null,
        resolved: resolved.slice(0, 5).map((x) => x.title),
        pendingCount: r ? pending.length : null,
        pending: pending.slice(0, 5).map((x) => x.title),
      };
    },
    DEMO_REPORT,
    { requires: "site" },
  );
  const data = res.data;
  const isLive = res.source === "live" && !res.loading;

  const [agencyName, setAgencyName] = useState("");
  const [clientName, setClientName] = useState(site?.name || site?.domain || "");
  const [reportPeriod, setReportPeriod] = useState<"HAFTALIK" | "AYLIK" | "KAPSAMLI">("HAFTALIK");
  const [customNote, setCustomNote] = useState(
    "Bu rapor sitenizin teknik SEO sağlığını, Google arama performansını ve backlink profilini özetler."
  );
  const [isCopied, setIsCopied] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (site) {
      setClientName(site.name || site.domain || "");
    }
  }, [site?.id, site?.name, site?.domain]);

  const activeClient = clientName.trim() || site?.name || site?.domain || "Müşteri";
  const activeDomain = site?.domain || site?.primary_url?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "";
  const activeUrl = site?.primary_url || (activeDomain ? `https://${activeDomain}` : "");
  const agencyLabel = agencyName.trim();

  const reportDate = new Date().toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const periodLabel =
    reportPeriod === "HAFTALIK" ? "Haftalık Performans Raporu" : reportPeriod === "AYLIK" ? "Aylık Yönetici Özeti" : "Kapsamlı SEO Denetimi";

  // Örnek veriyle hazırlanmış bir rapor müşteriye gerçekmiş gibi gidemez.
  const guardExport = (): boolean => {
    if (isLive) return true;
    setExportError("Rapor örnek veri içeriyor. Dışa aktarmak için siteyi bağlayıp canlı veri yükleyin.");
    return false;
  };

  const handlePrintPdf = () => {
    if (!guardExport()) return;
    window.print();
  };

  const handleExportCsv = () => {
    if (!guardExport()) return;
    const n = (v: number | null, digits = 0) => (v === null ? "" : digits ? v.toFixed(digits) : String(v));
    const csvRows: (string | number)[][] = [
      ["METRIK", "DEGER"],
      ["Rapor Tarihi", reportDate],
      ["Hazirlayan", agencyLabel],
      ["Musteri", activeClient],
      ["Domain", activeDomain],
      ["Son Tarama", data.crawlFinishedAt ?? ""],
      ["SEO Saglik Skoru", n(data.healthScore)],
      ["Degerlendirilen Sayfa", n(data.pagesEvaluated)],
      ["Bulunan Sorun", n(data.issuesFound)],
      ["Organik Tiklama (GSC)", n(data.clicks)],
      ["Gosterim (GSC)", n(data.impressions)],
      ["Backlink", n(data.backlinkTotal)],
      ["Toksik Backlink", n(data.toxicBacklinks)],
      ["Cozulen Oneri", n(data.resolvedCount)],
      ["Bekleyen Oneri", n(data.pendingCount)],
      [],
      ["SORGU", "TIKLAMA", "GOSTERIM", "ORT. POZISYON"],
      ...data.topQueries.map((q) => [q.query, q.clicks, q.impressions, q.position.toFixed(1)]),
    ];

    const escapeCsvCell = (val: string | number | undefined | null): string => {
      const str = String(val ?? "");
      if (/[;"\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = "﻿" + csvRows.map((row) => row.map(escapeCsvCell).join(";")).join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const sanitizedClientName =
      activeClient
        .toLowerCase()
        .replace(/[#%&{}\\<>*?/$!'":@+`|=]/g, "")
        .trim()
        .replace(/\s+/g, "_") || "musteri";
    link.setAttribute("download", `seo_raporu_${sanitizedClientName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = () => {
    if (!guardExport()) return;
    const lines = [
      `SEO YÖNETİCİ RAPORU${agencyLabel ? ` – ${agencyLabel}` : ""}`,
      `Müşteri: ${activeClient}${activeDomain ? ` (${activeDomain})` : ""}`,
      `Tarih: ${reportDate} (${periodLabel})`,
      "",
      `SEO sağlık skoru: ${data.healthScore === null ? "—" : `${data.healthScore}/100`}`,
      `Değerlendirilen sayfa / bulunan sorun: ${formatNumber(data.pagesEvaluated)} / ${formatNumber(data.issuesFound)}`,
      `Organik tıklama (GSC): ${formatNumber(data.clicks)}`,
      `Backlink / toksik: ${formatNumber(data.backlinkTotal)} / ${formatNumber(data.toxicBacklinks)}`,
      `Çözülen / bekleyen öneri: ${formatNumber(data.resolvedCount)} / ${formatNumber(data.pendingCount)}`,
      "",
      `Not: ${customNote}`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const kpis = [
    { label: "SEO Sağlık Skoru", value: data.healthScore === null ? "—" : `${data.healthScore}/100`, sub: data.pagesEvaluated === null ? "Tarama yok" : `${formatNumber(data.pagesEvaluated)} sayfa` },
    { label: "Bulunan Sorun", value: formatNumber(data.issuesFound), sub: data.crawlFinishedAt ? `Tarama: ${formatDateTime(data.crawlFinishedAt)}` : "Son tarama" },
    { label: "Organik Tıklama", value: formatNumber(data.clicks), sub: data.impressions === null ? "GSC bağlı değil" : `${formatNumber(data.impressions)} gösterim` },
    { label: "Backlink", value: formatNumber(data.backlinkTotal), sub: data.toxicBacklinks === null ? "—" : `${formatNumber(data.toxicBacklinks)} toksik` },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14 print:p-0 print:m-0 print:max-w-none">
      <div className="print:hidden space-y-3">
        <PageHeader
          icon={<FileText className="w-5 h-5 text-accent" />}
          title="Raporlar"
          description="Seçili sitenin tarama, Google Search Console, backlink ve öneri verilerinden müşteri raporu hazırlayın. PDF veya CSV olarak dışa aktarın."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="md" icon={<Copy className="w-4 h-4" />} onClick={handleCopySummary}>
                {isCopied ? "Kopyalandı!" : "Özeti Kopyala"}
              </Button>
              <Button variant="secondary" size="md" icon={<Download className="w-4 h-4" />} onClick={handleExportCsv}>
                Excel / CSV İndir
              </Button>
              <Link href="/leads">
                <Button
                  variant="secondary"
                  size="md"
                  icon={<Users className="w-4 h-4 text-evidence" />}
                  className="border-evidence/30 text-evidence hover:bg-evidence/10"
                >
                  Müşteri & CRM Köprüsü
                </Button>
              </Link>
              <Button variant="primary" size="md" icon={<Printer className="w-4 h-4" />} onClick={handlePrintPdf}>
                PDF Olarak Yazdır / Kaydet
              </Button>
            </div>
          }
        />
        <DemoBanner source={res.source} reason={res.reason} error={res.error} />
        {exportError && !isLive && (
          <div role="alert" className="px-3 py-2 rounded-sm bg-critical-soft text-critical border-l-2 border-critical text-xs">
            {exportError}
          </div>
        )}
      </div>

      <div className="print:hidden">
        <Panel title="Rapordaki marka" sub="Raporu kendi ajans adınızla verin: rapor üstünde görünecek ajans ve müşteri bilgileri">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <Label htmlFor="agency_name">Ajans / Danışman Şirket Adı</Label>
              <Input id="agency_name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Örn: Acme Digital Agency" />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="client_name">Müşteri / Marka Adı</Label>
                {site && clientName.trim() !== (site.name || site.domain) && (
                  <button
                    type="button"
                    onClick={() => setClientName(site.name || site.domain || "")}
                    className="text-xs text-accent hover:underline mb-1"
                    title="Seçili sitenin adına sıfırla"
                  >
                    Site adına sıfırla
                  </button>
                )}
              </div>
              <Input id="client_name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder={site?.name || "Örn: Marka / Müşteri Adı"} />
              {site && (
                <p className="text-xs text-muted mt-1 truncate">
                  Seçili Site: <span className="font-semibold text-ink">{site.name}</span> ({activeDomain})
                </p>
              )}
            </div>

            <div>
              <Label>Rapor Başlığı</Label>
              <div className="flex items-center gap-1.5 mt-1">
                {(["HAFTALIK", "AYLIK", "KAPSAMLI"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setReportPeriod(p)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all border ${
                      reportPeriod === p ? "bg-accent-fill text-white border-accent" : "bg-surface text-muted border-line hover:text-ink"
                    }`}
                  >
                    {p === "HAFTALIK" ? "Haftalık" : p === "AYLIK" ? "Aylık" : "Kapsamlı"}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-3">
              <Label htmlFor="custom_note">Yönetici Notu & Özel Değerlendirme</Label>
              <Input id="custom_note" value={customNote} onChange={(e) => setCustomNote(e.target.value)} placeholder="Müşteriye iletilecek özel yönetici notu..." />
            </div>
          </div>
        </Panel>
      </div>

      <div className="bg-surface border border-line rounded-lg p-8 sm:p-10 space-y-8 print:border-none print:shadow-none print:p-0 print:bg-white print:text-black">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line print:border-line-strong">
          <div>
            {agencyLabel && <h3 className="text-lg font-bold text-ink print:text-black tracking-tight">{agencyLabel}</h3>}
            <p className="text-xs text-muted print:text-muted">SEO Denetim Raporu</p>
          </div>

          <div className="sm:text-right">
            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/15 text-accent border border-accent/25 print:border-line-strong print:bg-surface-2 print:text-black mb-1">
              {periodLabel}
            </span>
            <p className="text-xs text-muted print:text-muted font-mono">Tarih: {reportDate}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-surface-subtle border border-line print:bg-surface-2 print:border-line-strong">
          <div>
            <span className="text-xs font-semibold text-muted print:text-muted uppercase tracking-wider block">Müşteri & Alan Adı</span>
            <p className="text-sm font-bold text-ink print:text-black mt-0.5">{activeClient}</p>
            <p className="text-xs font-mono text-muted print:text-muted">{activeUrl}</p>
          </div>

          <div>
            <span className="text-xs font-semibold text-muted print:text-muted uppercase tracking-wider block">Yönetici Değerlendirmesi</span>
            <p className="text-xs text-ink print:text-ink mt-0.5 leading-relaxed">"{customNote}"</p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-ink print:text-black uppercase tracking-wider mb-3">1. Temel Performans Göstergeleri</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpis.map((k) => (
              <div key={k.label} className="p-4 rounded-lg bg-surface border border-line print:border-line-strong print:bg-white">
                <span className="text-xs text-muted print:text-muted block">{k.label}</span>
                <span className="text-2xl font-extrabold text-ink print:text-black font-mono block mt-1">{k.value}</span>
                <span className="text-xs text-muted print:text-muted">{k.sub}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-bold text-ink print:text-black uppercase tracking-wider mb-3">2. En Çok Tıklanan Sorgular (Google Search Console)</h4>
          {data.topQueries.length === 0 ? (
            <p className="text-xs text-muted">Search Console verisi yok. Entegrasyonlar sayfasından Google hesabını bağlayın.</p>
          ) : (
            <div className="overflow-x-auto border border-line print:border-line-strong rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-subtle print:bg-surface-2 border-b border-line print:border-line-strong text-muted print:text-ink font-semibold uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Sorgu</th>
                    <th className="py-2.5 px-3 text-right">Tıklama</th>
                    <th className="py-2.5 px-3 text-right">Gösterim</th>
                    <th className="py-2.5 px-3 text-right">Ort. Pozisyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line print:divide-line">
                  {data.topQueries.map((q) => (
                    <tr key={q.query} className="print:text-black">
                      <td className="py-2.5 px-3 font-semibold text-ink print:text-black">{q.query}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatNumber(q.clicks)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted print:text-black">{formatNumber(q.impressions)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-muted print:text-black">{formatNumber(q.position, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-bold text-ink print:text-black uppercase tracking-wider mb-3">3. En Yaygın Teknik Sorunlar</h4>
          {data.topIssues.length === 0 ? (
            <p className="text-xs text-muted">Tamamlanmış tarama yok ya da sorun bulunmadı.</p>
          ) : (
            <ul className="text-xs text-muted print:text-ink space-y-1.5 list-disc list-inside">
              {data.topIssues.map((i) => (
                <li key={i.title}>
                  <span className="text-ink print:text-black font-semibold">{i.title}</span> ({i.severity}, {formatNumber(i.affected)} URL)
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-line print:border-line-strong">
            <h5 className="text-xs font-bold text-ink print:text-black uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-evidence" /> Çözülen Öneriler ({formatNumber(data.resolvedCount)})
            </h5>
            {data.resolved.length === 0 ? (
              <p className="text-xs text-muted">Çözüldü olarak işaretlenmiş öneri yok.</p>
            ) : (
              <ul className="text-xs text-muted print:text-ink space-y-1.5 list-disc list-inside">
                {data.resolved.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="p-4 rounded-lg border border-line print:border-line-strong">
            <h5 className="text-xs font-bold text-ink print:text-black uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-warn" /> Sıradaki Aksiyonlar ({formatNumber(data.pendingCount)})
            </h5>
            {data.pending.length === 0 ? (
              <p className="text-xs text-muted">Bekleyen öneri yok.</p>
            ) : (
              <ul className="text-xs text-muted print:text-ink space-y-1.5 list-disc list-inside">
                {data.pending.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {agencyLabel && (
          <div className="pt-4 border-t border-line print:border-line-strong text-xs text-muted print:text-muted">
            <p>
              © {new Date().getFullYear()} {agencyLabel}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
