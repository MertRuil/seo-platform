"use client";

import React, { useEffect, useState } from "react";
import { FileText, Download, Printer, Copy, Check, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { healthToIssues, gscToPerformance } from "@/lib/mappers";
import { SEVERITY_LABEL, type IssueItem, type PerformanceData } from "@/lib/demo";
import { summarizeAnswerBotAccess, type BotAccess, type ReadinessCheck } from "@/lib/geo-readiness";
import { formatNumber, formatPercent, formatDateTime } from "@/lib/format";
import { useSite } from "@/context/SiteContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { EmptyState, Notice, SkeletonRows } from "@/components/ui/States";

/**
 * Müşteri raporu: yalnızca bu platformun gerçekten ölçtüğü veriden oluşur
 * (son tarama, Search Console, AI erişim denetimi). Veri yoksa rapor bunu açıkça söyler.
 */
interface ReportData {
  health: { score: number; pages: number; issues: IssueItem[]; finishedAt: string | null } | null;
  gsc: PerformanceData | null;
  ai: { access: ReturnType<typeof summarizeAnswerBotAccess>; checks: ReadinessCheck[] } | null;
}

const csvCell = (v: string | number | null | undefined) => {
  const s = String(v ?? "");
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function ReportsPage() {
  const { org, site, crawl, status, setAddSiteOpen } = useSite();
  const [agencyName, setAgencyName] = useState("");
  const [clientName, setClientName] = useState("");
  const [note, setNote] = useState("");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (site) setClientName(site.name || site.domain);
  }, [site]);

  useEffect(() => {
    if (status !== "ready" || !org || !site) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [healthRes, gscRes, aiRes] = await Promise.allSettled([
        crawl ? api.getCrawlHealth(org.id, site.id, crawl.id) : Promise.reject(new Error("no crawl")),
        api.getGscMetrics(org.id, site.id),
        fetch("/api/v1/geo/readiness", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: site.primary_url }) }).then(async (r) => {
          if (!r.ok) throw new Error("readiness");
          return r.json() as Promise<{ bots: BotAccess[]; checks: ReadinessCheck[] }>;
        }),
      ]);
      if (cancelled) return;
      const gsc = gscRes.status === "fulfilled" && gscRes.value.length > 0 ? gscToPerformance(gscRes.value) : null;
      setData({
        health:
          healthRes.status === "fulfilled"
            ? { score: healthRes.value.health_score, pages: healthRes.value.total_pages_evaluated, issues: healthToIssues(healthRes.value), finishedAt: crawl?.finished_at ?? null }
            : null,
        gsc,
        ai:
          aiRes.status === "fulfilled"
            ? { access: summarizeAnswerBotAccess(aiRes.value.bots), checks: aiRes.value.checks }
            : null,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [status, org, site, crawl]);

  const client = clientName.trim() || site?.name || site?.domain || "";
  const reportDate = new Date().toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" });
  const urgent = data?.health?.issues.filter((i) => i.severity === "CRITICAL" || i.severity === "HIGH") ?? [];
  const aiProblems = data?.ai?.checks.filter((c) => c.status === "fail" || c.status === "warn") ?? [];

  const summaryLines = (): string[] => {
    const lines = [`SEO raporu: ${client} (${site?.domain ?? ""})`, `Tarih: ${reportDate}`];
    if (agencyName.trim()) lines.push(`Hazırlayan: ${agencyName.trim()}`);
    lines.push("");
    if (data?.health) {
      lines.push(`Teknik sağlık: ${data.health.score}/100 (${data.health.pages} sayfa tarandı)`);
      lines.push(`Acil sorun: ${urgent.length} (${urgent.slice(0, 3).map((i) => i.title).join("; ") || "yok"})`);
    } else lines.push("Teknik sağlık: tamamlanmış tarama yok");
    if (data?.gsc) lines.push(`Google: ${formatNumber(data.gsc.clicks)} tıklama, ${formatNumber(data.gsc.impressions)} gösterim, ort. sıra ${formatNumber(data.gsc.position, 1)}`);
    else lines.push("Google: Search Console bağlı değil");
    if (data?.ai) lines.push(`AI yanıt motorları: ${data.ai.access.summary}`);
    if (note.trim()) lines.push("", `Not: ${note.trim()}`);
    return lines;
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summaryLines().join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* pano izni yok */
    }
  };

  const exportCsv = () => {
    const rows: Array<Array<string | number | null>> = [
      ["Metrik", "Değer"],
      ["Rapor tarihi", reportDate],
      ["Müşteri", client],
      ["Alan adı", site?.domain ?? ""],
      ["Teknik sağlık", data?.health ? `${data.health.score}/100` : "Tarama yok"],
      ["Taranan sayfa", data?.health?.pages ?? ""],
      ["Acil sorun (kritik+yüksek)", data?.health ? urgent.length : ""],
      ["Google tıklama", data?.gsc?.clicks ?? "Search Console bağlı değil"],
      ["Google gösterim", data?.gsc?.impressions ?? ""],
      ["Ortalama sıra", data?.gsc ? formatNumber(data.gsc.position, 1) : ""],
      ["AI yanıt motorlarına erişim", data?.ai ? data.ai.access.summary : "Denetlenemedi"],
      [],
      ["Sorun", "Önem", "Etkilenen sayfa"],
      ...(data?.health?.issues ?? []).map((i) => [i.title, SEVERITY_LABEL[i.severity], i.affected ?? ""]),
    ];
    const csv = "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `seo_raporu_${(site?.domain ?? "site").replace(/[^a-z0-9.-]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (status === "ready" && !site) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <PageHeader icon={<FileText className="w-5 h-5" />} title="Raporlar" description="Sitenizin teknik sağlığı, Google performansı ve AI erişimi hakkında paylaşılabilir rapor." />
        <Panel>
          <EmptyState
            icon={<FileText className="w-8 h-8" />}
            title="Rapor için önce sitenizi ekleyin"
            description="Rapor, sitenizin taramasından ve bağladığınız kaynaklardan oluşturulur."
            action={<Button onClick={() => setAddSiteOpen(true)} icon={<Plus className="w-4 h-4" aria-hidden />}>Site ekle</Button>}
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-14 print:p-0 print:m-0 print:max-w-none">
      <div className="print:hidden space-y-5">
        <PageHeader
          icon={<FileText className="w-5 h-5" />}
          title="Raporlar"
          description="Sitenizin teknik sağlığı, Google performansı ve AI erişimi hakkında müşterinize veya yönetime paylaşabileceğiniz rapor. Yalnızca ölçülen veriler kullanılır."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" icon={copied ? <Check className="w-4 h-4" aria-hidden /> : <Copy className="w-4 h-4" aria-hidden />} onClick={copySummary} disabled={!data}>
                {copied ? "Kopyalandı" : "Özeti kopyala"}
              </Button>
              <Button variant="secondary" icon={<Download className="w-4 h-4" aria-hidden />} onClick={exportCsv} disabled={!data}>
                CSV indir
              </Button>
              <Button icon={<Printer className="w-4 h-4" aria-hidden />} onClick={() => window.print()} disabled={!data}>
                PDF olarak kaydet
              </Button>
            </div>
          }
        />
        <Panel title="Rapor bilgileri" sub="Rapor başlığında görünür. Boş bırakılan alanlar raporda yer almaz.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="agency_name" hint="(isteğe bağlı)">Hazırlayan ajans</Label>
              <Input id="agency_name" value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="Ajansınızın adı" />
            </div>
            <div>
              <Label htmlFor="client_name">Müşteri / marka</Label>
              <Input id="client_name" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder={site?.name} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="report_note" hint="(isteğe bağlı)">Not</Label>
              <Textarea id="report_note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bu dönemde yapılan çalışmalar veya sonraki adımlar" />
            </div>
          </div>
        </Panel>
      </div>

      {loading || !data ? (
        <Panel>
          <SkeletonRows rows={8} />
        </Panel>
      ) : (
        <article className="bg-surface border border-line rounded-md p-6 sm:p-8 space-y-6 print:border-0 print:p-0">
          <header className="border-b border-line pb-4">
            {agencyName.trim() && <div className="text-xs font-semibold uppercase tracking-wider text-muted">{agencyName.trim()}</div>}
            <h2 className="text-2xl font-semibold text-ink mt-1">{client} SEO raporu</h2>
            <p className="text-sm text-muted">
              {site?.domain} · {reportDate}
            </p>
          </header>

          <section>
            <h3 className="text-base font-semibold text-ink mb-2">Teknik sağlık</h3>
            {data.health ? (
              <>
                <p className="text-sm text-ink">
                  Sağlık puanı <strong>{data.health.score}/100</strong>. Son taramada {formatNumber(data.health.pages)} sayfa incelendi
                  {data.health.finishedAt ? ` (${formatDateTime(data.health.finishedAt)})` : ""}; {data.health.issues.length} sorun türü bulundu, bunların {urgent.length} tanesi acil.
                </p>
                {data.health.issues.length > 0 && (
                  <table className="w-full text-sm mt-3">
                    <caption className="sr-only">Sorunlar</caption>
                    <thead>
                      <tr className="text-left text-2xs uppercase tracking-wider text-muted border-b border-line">
                        <th scope="col" className="py-2">Sorun</th>
                        <th scope="col" className="py-2">Önem</th>
                        <th scope="col" className="py-2 text-right">Sayfa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {data.health.issues.slice(0, 10).map((i) => (
                        <tr key={i.id}>
                          <td className="py-2 pr-2 text-ink">{i.title}</td>
                          <td className="py-2 pr-2 text-muted whitespace-nowrap">{SEVERITY_LABEL[i.severity]}</td>
                          <td className="py-2 text-right tabular-nums">{i.affected ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">Tamamlanmış tarama yok; teknik sağlık bu raporda yer almıyor.</p>
            )}
          </section>

          <section>
            <h3 className="text-base font-semibold text-ink mb-2">Google arama performansı</h3>
            {data.gsc ? (
              <>
                <p className="text-sm text-ink">
                  {formatNumber(data.gsc.clicks)} tıklama, {formatNumber(data.gsc.impressions)} gösterim, tıklama oranı {formatPercent(data.gsc.ctr, 1)}, ortalama sıra {formatNumber(data.gsc.position, 1)}. Kaynak: Google Search Console.
                </p>
                <ul className="mt-2 text-sm text-ink list-disc pl-5 space-y-0.5">
                  {data.gsc.queries.slice(0, 5).map((q) => (
                    <li key={q.query}>
                      {q.query} · {formatNumber(q.clicks)} tıklama · sıra {formatNumber(q.position, 1)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted">Search Console bağlı olmadığı için tıklama ve sıralama verisi yok.</p>
            )}
          </section>

          <section>
            <h3 className="text-base font-semibold text-ink mb-2">AI yanıt motorlarına erişim</h3>
            {data.ai ? (
              <>
                <p className="text-sm text-ink">
                  {data.ai.access.summary}
                </p>
                {aiProblems.length > 0 && (
                  <ul className="mt-2 text-sm text-ink list-disc pl-5 space-y-0.5">
                    {aiProblems.map((c) => (
                      <li key={c.id}>{c.finding}</li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted mt-2">Bu bölüm erişim ve hazırlık durumunu gösterir; yanıtlarda görünürlük ölçülmemiştir.</p>
              </>
            ) : (
              <p className="text-sm text-muted">AI erişim denetimi yapılamadı.</p>
            )}
          </section>

          {note.trim() && (
            <section>
              <h3 className="text-base font-semibold text-ink mb-2">Not</h3>
              <p className="text-sm text-ink whitespace-pre-wrap">{note.trim()}</p>
            </section>
          )}
        </article>
      )}
      {data && !data.health && !data.gsc && (
        <Notice tone="info" className="print:hidden">
          Raporu zenginleştirmek için sitenizi tarayın ve Search Console'u bağlayın.
        </Notice>
      )}
    </div>
  );
}
