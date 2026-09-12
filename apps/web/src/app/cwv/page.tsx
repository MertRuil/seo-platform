"use client";

import React from "react";
import { Zap, Clock, Activity, Move } from "lucide-react";
import { api } from "@/lib/api";
import { DEMO_CWV, type CwvData } from "@/lib/demo";
import { cruxToView } from "@/lib/mappers";
import { formatNumber } from "@/lib/format";
import { useSiteData } from "@/hooks/useSiteData";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { EmptyState, SkeletonRows } from "@/components/ui/States";
import { cn } from "@/lib/cn";

interface Metric {
  key: string;
  name: string;
  icon: React.ReactNode;
  value: number | null;
  display: string;
  good: number;
  poor: number;
  threshold: string;
  help: string;
}

function rating(v: number | null, good: number, poor: number): "good" | "needs" | "poor" | "none" {
  if (v === null) return "none";
  if (v <= good) return "good";
  if (v <= poor) return "needs";
  return "poor";
}

const toneClass = { good: "text-evidence", needs: "text-warn", poor: "text-critical", none: "text-muted" } as const;
const barClass = { good: "bg-evidence", needs: "bg-warn", poor: "bg-critical", none: "bg-line-strong" } as const;

export default function WebVitalsPage() {
  const res = useSiteData<CwvData>("crux", async ({ org, site }) => cruxToView(await api.getCruxMetrics(org.id, site.id)), DEMO_CWV, { requires: "site" });
  const d = res.data;

  const metrics: Metric[] = [
    { key: "lcp", name: "Largest Contentful Paint", icon: <Clock className="w-4 h-4" />, value: d.lcpMs, display: d.lcpMs === null ? "—" : `${formatNumber(d.lcpMs / 1000, 1)} sn`, good: 2500, poor: 4000, threshold: "İyi ≤ 2,5 sn", help: "Ana içeriğin ekrana gelme süresi." },
    { key: "inp", name: "Interaction to Next Paint", icon: <Activity className="w-4 h-4" />, value: d.inpMs, display: d.inpMs === null ? "—" : `${formatNumber(d.inpMs)} ms`, good: 200, poor: 500, threshold: "İyi ≤ 200 ms", help: "Etkileşime tarayıcının tepki süresi." },
    { key: "cls", name: "Cumulative Layout Shift", icon: <Move className="w-4 h-4" />, value: d.cls, display: d.cls === null ? "—" : formatNumber(d.cls, 2), good: 0.1, poor: 0.25, threshold: "İyi ≤ 0,1", help: "Yüklenirken beklenmedik yer değiştirme." },
  ];

  const allGood = metrics.every((m) => rating(m.value, m.good, m.poor) === "good");
  const hasAny = metrics.some((m) => m.value !== null);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={res.source} reason={res.reason} error={res.error} />
      <PageHeader
        icon={<Zap className="w-5 h-5" />}
        title="Web Vitals (CrUX)"
        description="Chrome Kullanıcı Deneyimi Raporu, 75. yüzdelik gerçek kullanıcı saha metrikleri."
        actions={hasAny ? <Badge tone={allGood ? "evidence" : "warn"}>{allGood ? "Google eşiklerini karşılıyor" : "Eşiğin altında metrik var"}</Badge> : undefined}
      />

      {res.loading ? (
        <Panel>
          <SkeletonRows rows={3} />
        </Panel>
      ) : !hasAny ? (
        <Panel>
          <EmptyState title="CrUX verisi yok" description="Site yeterli Chrome trafiğine ulaştığında ve CrUX API anahtarı tanımlandığında saha metrikleri burada görünür." />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {metrics.map((m) => {
            const r = rating(m.value, m.good, m.poor);
            const pct = m.value === null ? 0 : Math.min(100, (m.value / m.poor) * 100);
            return (
              <Panel key={m.key}>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="font-medium">{m.name}</span>
                  <span className={toneClass[r]} aria-hidden>
                    {m.icon}
                  </span>
                </div>
                <div className={cn("font-editorial text-4xl mt-2 tabular-nums", toneClass[r])}>{m.display}</div>
                <div className="mt-2 h-1.5 w-full bg-surface-2 rounded-full overflow-hidden" aria-hidden>
                  <div className={cn("h-full rounded-full", barClass[r])} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-muted mt-2">{m.threshold}</div>
                <p className="text-xs text-muted mt-2 pt-2 border-t border-line">{m.help}</p>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
