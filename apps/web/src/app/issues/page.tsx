"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, CheckCircle2, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { DEMO_ISSUES, type IssueItem, type Severity } from "@/lib/demo";
import { healthToIssues } from "@/lib/mappers";
import { addChangeSet, newChangeSetId, readChangeSets } from "@/lib/changesets";
import { useSiteData } from "@/hooks/useSiteData";
import { useDensity } from "@/context/DensityContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, Inset } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { FilterChips } from "@/components/ui/Input";
import { Badge, SeverityBadge, severityStripeClass } from "@/components/ui/Badge";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { EmptyState, Notice, SkeletonRows } from "@/components/ui/States";
import { cn } from "@/lib/cn";

type Filter = "ALL" | Severity;

export default function SorunlarPage() {
  const router = useRouter();
  const { density } = useDensity();
  const res = useSiteData<IssueItem[]>("issues", async ({ org, site, crawl }) => healthToIssues(await api.getCrawlHealth(org.id, site.id, crawl!.id)), DEMO_ISSUES);

  const [filter, setFilter] = useState<Filter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [created, setCreated] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setCreated(readChangeSets().map((s) => s.sorunId).filter((x): x is string => !!x));
  }, []);

  const handleCreateSet = async (issue: IssueItem) => {
    setBusyId(issue.id);
    setNotice(null);
    await new Promise((r) => setTimeout(r, 500));
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
      oncekiKod: issue.before,
      yeniKod: issue.after,
      olusturulmaTarihi: new Date().toLocaleTimeString("tr-TR"),
    });
    setCreated((prev) => [...prev, issue.id]);
    setBusyId(null);
    setNotice(`Düzeltme seti #${id} hazırlandı; diff sayfasına yönlendiriliyorsunuz.`);
    setTimeout(() => router.push("/changes"), 900);
  };

  const list = filter === "ALL" ? res.data : res.data.filter((i) => i.severity === filter);
  const counts = res.data.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.severity]: (acc[i.severity] ?? 0) + 1 }), {});

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={res.source} reason={res.reason} error={res.error} />
      <PageHeader
        icon={<AlertTriangle className="w-5 h-5" />}
        title="Tespit edilen sorunlar"
        description="Taramada saptanan teknik ve içerik bulguları. Her bulgu için düzeltme seti oluşturup diff'i inceleyebilir, sonra uygulayabilirsiniz."
        actions={
          <FilterChips<Filter>
            label="Önem filtresi"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "ALL", label: `Tümü (${res.data.length})` },
              { value: "CRITICAL", label: `Kritik (${counts.CRITICAL ?? 0})` },
              { value: "HIGH", label: `Yüksek (${counts.HIGH ?? 0})` },
              { value: "MEDIUM", label: `Orta (${counts.MEDIUM ?? 0})` },
              { value: "LOW", label: `Düşük (${counts.LOW ?? 0})` },
            ]}
          />
        }
      />

      {notice && (
        <Notice tone="success" onClose={() => setNotice(null)} action={<Button size="sm" variant="evidence" onClick={() => router.push("/changes")}>Diff'e git</Button>}>
          {notice}
        </Notice>
      )}

      {res.loading ? (
        <Panel>
          <SkeletonRows rows={6} />
        </Panel>
      ) : list.length === 0 ? (
        <Panel>
          <EmptyState icon={<CheckCircle2 className="w-8 h-8 text-evidence" />} title={filter === "ALL" ? "Bu taramada sorun bulunmadı" : "Bu önem düzeyinde sorun yok"} description="Kural motoru hiçbir ihlal raporlamadı. Yeni tarama sonrası liste güncellenir." />
        </Panel>
      ) : (
        <ul className="space-y-3">
          {list.map((issue) => {
            const done = created.includes(issue.id);
            const busy = busyId === issue.id;
            return (
              <li key={issue.id} className="bg-surface border border-line rounded-md grid grid-cols-[4px_1fr] overflow-hidden">
                <span className={cn("block", severityStripeClass(issue.severity))} aria-hidden />
                <div className="p-4 sm:p-5 space-y-3 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <SeverityBadge severity={issue.severity} />
                      <Badge tone="neutral" mono>
                        {issue.category}
                      </Badge>
                      <span className="text-base font-semibold text-ink">{issue.title}</span>
                    </div>
                    <span className="font-mono text-2xs text-muted shrink-0">{issue.id}</span>
                  </div>

                  <Inset className="font-mono text-xs text-accent-ink truncate">Etkilenen: {issue.url}</Inset>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs font-semibold text-ink mb-0.5">Teşhis</div>
                      <p className="text-muted">{issue.diagnosis}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-evidence mb-0.5">Önerilen çözüm</div>
                      <p className="text-muted">{issue.fix}</p>
                    </div>
                  </div>

                  {density === "expert" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                      <pre className="whitespace-pre-wrap bg-critical-soft text-critical border-l-2 border-critical rounded-sm p-3 overflow-x-auto">{issue.before}</pre>
                      <pre className="whitespace-pre-wrap bg-evidence-soft text-evidence border-l-2 border-evidence rounded-sm p-3 overflow-x-auto">{issue.after}</pre>
                    </div>
                  )}

                  <div className="pt-3 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs text-muted inline-flex items-center gap-3">
                      {issue.docUrl ? (
                        <a href={issue.docUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent-ink hover:underline">
                          Resmi belge <ExternalLink className="w-3 h-3" aria-hidden />
                        </a>
                      ) : (
                        <span>Kaynak: kural motoru</span>
                      )}
                      {issue.affected !== undefined && <span>{issue.affected} URL</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {done && (
                        <Button size="sm" variant="secondary" icon={<CheckCircle2 className="w-3.5 h-3.5 text-evidence" />} onClick={() => router.push("/changes")}>
                          Set hazır · incele
                        </Button>
                      )}
                      <Button size="sm" loading={busy} onClick={() => handleCreateSet(issue)} icon={busy ? undefined : <ChevronRight className="w-3.5 h-3.5" />}>
                        {busy ? "Hazırlanıyor" : "Düzeltme seti oluştur"}
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
