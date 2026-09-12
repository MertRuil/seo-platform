"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lightbulb, ArrowRight, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { DEMO_OPPORTUNITIES, type OpportunityItem } from "@/lib/demo";
import { opportunitiesToView } from "@/lib/mappers";
import { addChangeSet, newChangeSetId } from "@/lib/changesets";
import { formatNumber, formatPercent } from "@/lib/format";
import { useSiteData } from "@/hooks/useSiteData";
import { useQueue } from "@/hooks/useQueue";
import { useDensity } from "@/context/DensityContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, Inset } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, SeverityBadge, severityStripeClass } from "@/components/ui/Badge";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { EmptyState, Notice, SkeletonRows } from "@/components/ui/States";
import { cn } from "@/lib/cn";

export default function OncelikliIslerPage() {
  const router = useRouter();
  const { density } = useDensity();
  const queue = useQueue();
  const ops = useSiteData<OpportunityItem[]>("opportunities", async ({ org, site }) => opportunitiesToView(await api.getOpportunities(org.id, site.id)), DEMO_OPPORTUNITIES, { requires: "site" });

  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleCreate = async (f: OpportunityItem, idx: number) => {
    setBusy(idx);
    setNotice(null);
    await new Promise((r) => setTimeout(r, 500));
    const id = newChangeSetId("CS-OPP");
    addChangeSet({
      id,
      baslik: `Büyüme fırsatı: "${f.query}"`,
      onem: "HIGH",
      etkilenenSayfa: f.page,
      kategori: "BÜYÜME FIRSATI",
      oneri: f.action,
      durum: "BEKLİYOR",
      oncekiKod: f.before,
      yeniKod: f.after,
      olusturulmaTarihi: new Date().toLocaleTimeString("tr-TR"),
    });
    setBusy(null);
    setNotice(`"${f.query}" için optimizasyon seti #${id} oluşturuldu; diff sayfasına yönlendiriliyorsunuz.`);
    setTimeout(() => router.push("/changes"), 900);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={queue.source} reason={queue.reason} error={queue.error} />
      <PageHeader
        icon={<Lightbulb className="w-5 h-5" />}
        title="Öncelikli işler"
        description="Etki sırasına dizilmiş karar kuyruğu: her satırda önem, beklenen etki, güven ve kanıt kaynağı. Altta Search Console'dan türeyen büyüme fırsatları."
      />

      {notice && (
        <Notice tone="success" onClose={() => setNotice(null)} action={<Button size="sm" variant="evidence" onClick={() => router.push("/changes")}>Diff'e git</Button>}>
          {notice}
        </Notice>
      )}

      <Panel flush title="Karar kuyruğu" sub="Resmi belgeler ve site grafı formülleriyle önceliklendirilmiş" actions={<Badge tone="neutral" mono>{queue.pending} iş</Badge>}>
        {queue.loading ? (
          <div className="p-5">
            <SkeletonRows rows={4} />
          </div>
        ) : queue.data.length === 0 ? (
          <EmptyState title="Karar bekleyen iş yok" description="Tarama ve AI denetimi sonrası öneriler burada sıralanır." />
        ) : (
          <ul className="divide-y divide-line">
            {queue.data.map((q) => (
              <li key={q.id} className="grid grid-cols-[4px_1fr] hover:bg-surface-2 transition-colors">
                <span className={cn("block", severityStripeClass(q.severity))} aria-hidden />
                <div className="px-4 sm:px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={q.severity} />
                      <Badge tone="neutral" mono>
                        {q.category}
                      </Badge>
                      <span className="text-sm font-semibold text-ink">{q.title}</span>
                    </div>
                    <p className="text-sm text-muted">{q.reason}</p>
                    <div className="font-mono text-2xs text-muted flex flex-wrap gap-x-3">
                      <span>
                        Kanıt: <span className="text-evidence">{q.source}</span>
                      </span>
                      {q.impact && <span>Etki: {q.impact}</span>}
                      {q.confidence !== undefined && <span>Güven: %{Math.round(q.confidence * 100)}</span>}
                    </div>
                  </div>
                  <div className="flex md:flex-col items-center md:items-end justify-between gap-2 shrink-0">
                    <span className="font-mono text-xs text-muted">
                      Öncelik <b className="text-ink text-sm tabular-nums">{q.score}</b> / 100
                    </span>
                    <Link href={q.href} className="inline-flex items-center gap-1 h-8 px-3 rounded-sm border border-line bg-surface text-xs font-semibold text-ink hover:bg-surface-2 hover:border-line-strong transition-colors">
                      {q.actionLabel} <ChevronRight className="w-3.5 h-3.5 text-accent" aria-hidden />
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div>
        <h2 className="text-lg font-semibold text-ink">Büyüme fırsatları</h2>
        <p className="text-sm text-muted">Yüksek gösterim alan ama düşük tıklama alan sorgular ve kanibalizasyon tespiti.</p>
      </div>
      <DemoBanner source={ops.source} reason={ops.reason} error={ops.error} />

      {ops.loading ? (
        <Panel>
          <SkeletonRows rows={4} />
        </Panel>
      ) : ops.data.length === 0 ? (
        <Panel>
          <EmptyState title="Fırsat bulunamadı" description="Search Console bağlıysa ve yeterli gösterim varsa fırsat motoru burada öneri üretir." />
        </Panel>
      ) : (
        <ul className="space-y-3">
          {ops.data.map((f, idx) => (
            <li key={`${f.query}-${idx}`}>
              <Panel>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="warn">{f.category}</Badge>
                    <span className="text-base font-semibold text-ink">“{f.query}”</span>
                  </div>
                  <Badge tone="evidence">Tahmini kazanç {f.potential}</Badge>
                </div>

                <Inset className="mt-3 font-mono text-xs text-muted truncate">
                  Hedef: <span className="text-accent-ink">{f.page}</span>
                </Inset>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <div className="text-muted">Aylık gösterim</div>
                    <div className="font-mono font-semibold text-ink tabular-nums">{formatNumber(f.impressions)}</div>
                  </div>
                  <div>
                    <div className="text-muted">Tıklama</div>
                    <div className="font-mono font-semibold text-ink tabular-nums">{formatNumber(f.clicks)}</div>
                  </div>
                  <div>
                    <div className="text-muted">Mevcut TO</div>
                    <div className="font-mono font-semibold text-warn tabular-nums">{formatPercent(f.ctr, 2)}</div>
                  </div>
                  <div>
                    <div className="text-muted">Hedef TO</div>
                    <div className="font-mono font-semibold text-evidence tabular-nums">{formatPercent(f.targetCtr, 2)}</div>
                  </div>
                </div>

                {density === "expert" && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                    <pre className="whitespace-pre-wrap bg-critical-soft text-critical border-l-2 border-critical rounded-sm p-3 overflow-x-auto">{f.before}</pre>
                    <pre className="whitespace-pre-wrap bg-evidence-soft text-evidence border-l-2 border-evidence rounded-sm p-3 overflow-x-auto">{f.after}</pre>
                  </div>
                )}

                <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-sm text-muted">{f.action}</p>
                  <Button size="sm" loading={busy === idx} onClick={() => handleCreate(f, idx)} icon={busy === idx ? undefined : <ArrowRight className="w-3.5 h-3.5" />} className="shrink-0">
                    Optimizasyon seti oluştur
                  </Button>
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
