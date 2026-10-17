"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, CheckCircle2, ExternalLink, Download, Copy, FilePlus2, Check } from "lucide-react";
import { SEVERITY_LABEL, type IssueItem, type Severity } from "@/lib/demo";
import { issueGuide } from "@/lib/issueGuide";
import { addChangeSet, newChangeSetId, readChangeSets } from "@/lib/changesets";
import { useIssues } from "@/hooks/useIssues";
import { useDensity } from "@/context/DensityContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/Input";
import { SeverityBadge, severityStripeClass } from "@/components/ui/Badge";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { EmptyState, Notice, SkeletonRows } from "@/components/ui/States";
import { cn } from "@/lib/cn";

type Filter = "ALL" | Severity;

const PREVIEW_URLS = 5;

function affectedUrls(issue: IssueItem): string[] {
  return issue.urls && issue.urls.length > 0 ? issue.urls : issue.url ? [issue.url] : [];
}

function downloadCsv(issue: IssueItem) {
  const rows = ["url", ...affectedUrls(issue).map((u) => `"${u.replace(/"/g, '""')}"`)];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(issue.ruleId || issue.id).toLowerCase()}-sayfalar.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function IssueCard({ issue, expert, drafted, onDraft }: { issue: IssueItem; expert: boolean; drafted: boolean; onDraft: (i: IssueItem) => void }) {
  const [open, setOpen] = useState(issue.severity === "CRITICAL");
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const guide = issueGuide(issue.category, issue.ruleId);
  const urls = affectedUrls(issue);
  const count = issue.affected ?? urls.length;
  const share = issue.totalPages && count ? Math.round((count / issue.totalPages) * 100) : null;
  const visible = showAll ? urls : urls.slice(0, PREVIEW_URLS);
  const bodyId = `issue-body-${issue.id}`;

  const copyUrls = async () => {
    try {
      await navigator.clipboard.writeText(urls.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* pano izni yok */
    }
  };

  return (
    <li className="bg-surface border border-line rounded-md grid grid-cols-[4px_1fr] overflow-hidden">
      <span className={cn("block", severityStripeClass(issue.severity))} aria-hidden />
      <div className="min-w-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="w-full text-left p-4 sm:p-5 flex items-start justify-between gap-3 cursor-pointer hover:bg-surface-2/60"
        >
          <span className="min-w-0 space-y-1.5">
            <span className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={issue.severity} />
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{guide.label}</span>
            </span>
            <span className="block text-base font-semibold text-ink">{issue.title}</span>
            <span className="block text-xs text-muted">
              {count > 0 ? `${count} sayfada` : "Site genelinde"}
              {share !== null && ` · taranan sayfaların %${share}'i`}
            </span>
          </span>
          <ChevronDown className={cn("w-4 h-4 text-muted shrink-0 mt-1 transition-transform", open && "rotate-180")} aria-hidden />
        </button>

        {open && (
          <div id={bodyId} className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <h3 className="text-xs font-semibold text-ink mb-0.5">Ne oldu?</h3>
                <p className="text-muted">{issue.diagnosis}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-ink mb-0.5">Neden önemli?</h3>
                <p className="text-muted">{guide.why}</p>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-evidence mb-0.5">Nasıl düzeltilir?</h3>
                <p className="text-muted">{issue.fix}</p>
                {issue.docUrl && (
                  <a href={issue.docUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-accent-ink hover:underline">
                    Google belgesi <ExternalLink className="w-3 h-3" aria-hidden />
                  </a>
                )}
              </div>
            </div>

            {urls.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-ink mb-1.5">Etkilenen sayfalar</h3>
                <ul className="rounded-sm border border-line divide-y divide-line">
                  {visible.map((u) => (
                    <li key={u} className="px-3 py-2 font-mono text-xs text-ink break-all">
                      <a href={u} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-accent-ink">
                        {u}
                      </a>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted">
                  {urls.length > PREVIEW_URLS && (
                    <button type="button" onClick={() => setShowAll((v) => !v)} className="font-medium text-accent-ink hover:underline cursor-pointer min-h-[32px]">
                      {showAll ? "Daha az göster" : `Tümünü göster (${urls.length})`}
                    </button>
                  )}
                  {count > urls.length && <span>İlk {urls.length} sayfa listeleniyor; toplam {count}.</span>}
                </div>
              </div>
            )}

            {expert && issue.before && issue.after && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                <div>
                  <div className="text-2xs font-sans font-semibold text-critical mb-1">Şu an</div>
                  <pre className="whitespace-pre-wrap bg-critical-soft text-critical border-l-2 border-critical rounded-sm p-3 overflow-x-auto">{issue.before}</pre>
                </div>
                <div>
                  <div className="text-2xs font-sans font-semibold text-evidence mb-1">Önerilen</div>
                  <pre className="whitespace-pre-wrap bg-evidence-soft text-evidence border-l-2 border-evidence rounded-sm p-3 overflow-x-auto">{issue.after}</pre>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-line flex flex-wrap items-center gap-2">
              {urls.length > 0 && (
                <>
                  <Button size="sm" variant="secondary" icon={<Download className="w-3.5 h-3.5" aria-hidden />} onClick={() => downloadCsv(issue)}>
                    Sayfa listesini indir (CSV)
                  </Button>
                  <Button size="sm" variant="ghost" icon={copied ? <Check className="w-3.5 h-3.5" aria-hidden /> : <Copy className="w-3.5 h-3.5" aria-hidden />} onClick={copyUrls}>
                    {copied ? "Kopyalandı" : "Adresleri kopyala"}
                  </Button>
                </>
              )}
              {issue.before && issue.after && (
                <Button size="sm" variant={drafted ? "ghost" : "secondary"} icon={drafted ? <CheckCircle2 className="w-3.5 h-3.5 text-evidence" aria-hidden /> : <FilePlus2 className="w-3.5 h-3.5" aria-hidden />} onClick={() => onDraft(issue)}>
                  {drafted ? "Taslak hazır · incele" : "Değişiklik taslağı oluştur"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

export default function SorunlarPage() {
  const router = useRouter();
  const { density } = useDensity();
  const res = useIssues();

  const [filter, setFilter] = useState<Filter>("ALL");
  const [drafted, setDrafted] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDrafted(readChangeSets().map((s) => s.sorunId).filter((x): x is string => !!x));
  }, []);

  // Taslak yalnızca gerçek önce/sonra kodu olan bulgular için oluşturulur ve siteye uygulanmış sayılmaz.
  const handleDraft = (issue: IssueItem) => {
    if (drafted.includes(issue.id)) {
      router.push("/changes");
      return;
    }
    const id = newChangeSetId();
    addChangeSet({
      id,
      sorunId: issue.id,
      baslik: issue.title,
      onem: issue.severity,
      etkilenenSayfa: issue.url,
      kategori: issue.category,
      oneri: issue.fix,
      durum: "BEKLİYOR",
      oncekiKod: issue.before ?? "",
      yeniKod: issue.after ?? "",
      olusturulmaTarihi: new Date().toLocaleTimeString("tr-TR"),
    });
    setDrafted((prev) => [...prev, issue.id]);
    setNotice(`Değişiklik taslağı ${id} oluşturuldu. Siteye henüz uygulanmadı; Değişiklikler sayfasında inceleyip onaylayabilirsiniz.`);
  };

  const counts = useMemo(() => res.data.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.severity]: (acc[i.severity] ?? 0) + 1 }), {}), [res.data]);
  const list = filter === "ALL" ? res.data : res.data.filter((i) => i.severity === filter);
  const urgent = (counts.CRITICAL ?? 0) + (counts.HIGH ?? 0);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={res.source} reason={res.reason} error={res.error} />
      <PageHeader
        icon={<AlertTriangle className="w-5 h-5" />}
        title="Sorunlar"
        description="Son taramada bulunan sorunlar, önem düzeyine ve etkilenen sayfa sayısına göre sıralı. Her sorunda nerede olduğunu, neden önemli olduğunu ve nasıl düzeltileceğini görebilirsiniz."
      />

      {!res.loading && res.data.length > 0 && (
        <p className="text-sm text-ink">
          {urgent > 0 ? (
            <>
              <strong>{urgent} acil sorun</strong> var ({counts.CRITICAL ?? 0} kritik, {counts.HIGH ?? 0} yüksek). En üstteki sorundan başlayın.
            </>
          ) : (
            <>Kritik veya yüksek önemde sorun yok. Kalan {res.data.length} bulgu iyileştirme fırsatıdır.</>
          )}
        </p>
      )}

      <FilterChips<Filter>
        label="Önem filtresi"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "ALL", label: `Tümü (${res.data.length})` },
          ...(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as Severity[]).map((s) => ({ value: s, label: `${SEVERITY_LABEL[s]} (${counts[s] ?? 0})` })),
        ]}
      />

      {notice && (
        <Notice tone="success" onClose={() => setNotice(null)} action={<Button size="sm" variant="secondary" onClick={() => router.push("/changes")}>Taslakları gör</Button>}>
          {notice}
        </Notice>
      )}

      {res.loading ? (
        <Panel>
          <SkeletonRows rows={6} />
        </Panel>
      ) : list.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<CheckCircle2 className="w-8 h-8 text-evidence" />}
            title={filter === "ALL" ? "Bu taramada sorun bulunmadı" : `${SEVERITY_LABEL[filter as Severity]} önemde sorun yok`}
            description={filter === "ALL" ? "Kural motoru hiçbir ihlal bulmadı. Sitede değişiklik yaptıktan sonra yeni tarama başlatarak tekrar kontrol edebilirsiniz." : "Diğer önem düzeylerine bakmak için filtreyi değiştirin."}
            action={filter !== "ALL" ? <Button size="sm" variant="secondary" onClick={() => setFilter("ALL")}>Tüm sorunları göster</Button> : undefined}
          />
        </Panel>
      ) : (
        <ul className="space-y-3">
          {list.map((issue) => (
            <IssueCard key={issue.id} issue={issue} expert={density === "expert"} drafted={drafted.includes(issue.id)} onDraft={handleDraft} />
          ))}
        </ul>
      )}
    </div>
  );
}
