"use client";

import React from "react";
import { ShieldCheck, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { DEMO_HEALTH, type HealthData, type HealthRule } from "@/lib/demo";
import { healthToView } from "@/lib/mappers";
import { formatNumber } from "@/lib/format";
import { useSiteData } from "@/hooks/useSiteData";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge, type Tone } from "@/components/ui/Badge";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { SkeletonRows } from "@/components/ui/States";
import { cn } from "@/lib/cn";

const statusTone: Record<HealthRule["status"], Tone> = { Mükemmel: "evidence", İyi: "accent", Uyarı: "warn", Kritik: "critical" };

export default function TeknikSaglikPage() {
  const res = useSiteData<HealthData>("health", async ({ org, site, crawl }) => healthToView(await api.getCrawlHealth(org.id, site.id, crawl!.id)), DEMO_HEALTH);
  const d = res.data;
  const verdict = d.score >= 90 ? "Arama motorları için ideal" : d.score >= 70 ? "İyi; birkaç düzeltme gerekli" : "Öncelikli teknik iş var";

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={res.source} reason={res.reason} error={res.error} />
      <PageHeader
        icon={<ShieldCheck className="w-5 h-5" />}
        title="Teknik sağlık ve kural analizi"
        description="13 deterministik kural; olgular HTTP yanıtından okunur, yapay zeka yorum eklemez. Puan, taranan sayfalar üzerinden hesaplanır."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
              Raporu Yazdır / PDF
            </Button>
            <LinkButton href="/crawls" variant="primary">
              Yeni tarama başlat
            </LinkButton>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Panel className="flex flex-col items-center justify-center text-center">
          <div className="font-mono text-2xs uppercase tracking-wider text-muted">Genel sağlık skoru</div>
          <div className="font-editorial text-5xl text-ink mt-2 tabular-nums">
            {d.score}
            <span className="font-mono text-xs text-muted ml-1">/ 100</span>
          </div>
          <Badge tone={d.score >= 90 ? "evidence" : d.score >= 70 ? "warn" : "critical"} className="mt-3">
            {verdict}
          </Badge>
          <p className="text-xs text-muted mt-3">
            {formatNumber(d.pages)} sayfa değerlendirildi · {d.issues} bulgu
          </p>
        </Panel>

        <Panel className="md:col-span-2" title="Puan kırılımı">
          {res.loading ? (
            <SkeletonRows rows={3} />
          ) : (
            <ul className="space-y-3">
              {d.breakdown.map((b) => (
                <li key={b.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted">{b.label}</span>
                    <span className={cn("font-semibold tabular-nums", b.pct >= 90 ? "text-evidence" : b.pct >= 70 ? "text-warn" : "text-critical")}>%{b.pct}</span>
                  </div>
                  <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden" role="progressbar" aria-valuenow={b.pct} aria-valuemin={0} aria-valuemax={100} aria-label={b.label}>
                    <div className={cn("h-full rounded-full", b.pct >= 90 ? "bg-evidence" : b.pct >= 70 ? "bg-warn" : "bg-critical")} style={{ width: `${b.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel flush title="Deterministik kural değerlendirmesi" sub="Her kural için durum, puan ve etkilenen sayfa notu">
        {res.loading ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {d.rules.map((item) => (
              <li key={item.rule} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-surface-2 transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink">{item.rule}</div>
                  <p className="text-xs text-muted">{item.note}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-xs text-muted tabular-nums">{item.score}</span>
                  <Badge tone={statusTone[item.status]}>{item.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
