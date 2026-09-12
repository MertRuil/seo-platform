"use client";

import React from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { DEMO_PERFORMANCE, type PerformanceData } from "@/lib/demo";
import { gscToPerformance } from "@/lib/mappers";
import { formatCompact, formatNumber, formatPercent } from "@/lib/format";
import { useSiteData } from "@/hooks/useSiteData";
import { useSite } from "@/context/SiteContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { EmptyState, SkeletonRows } from "@/components/ui/States";

type QueryRow = PerformanceData["queries"][number];

const columns: Column<QueryRow>[] = [
  { key: "query", header: "Sorgu", render: (r) => <span className="font-medium text-ink">{r.query}</span> },
  { key: "clicks", header: "Tıklama", align: "right", render: (r) => <span className="font-mono text-evidence font-semibold">{formatNumber(r.clicks)}</span> },
  { key: "impressions", header: "Gösterim", align: "right", render: (r) => <span className="font-mono text-muted">{formatNumber(r.impressions)}</span> },
  { key: "ctr", header: "TO", align: "right", render: (r) => <span className="font-mono text-accent-ink font-semibold">{formatPercent(r.ctr, 2)}</span> },
  { key: "position", header: "Ort. sıra", align: "right", render: (r) => <span className="font-mono text-ink font-semibold">{formatNumber(r.position, 1)}</span> },
];

export default function AramaPerformansiPage() {
  const { period } = useSite();
  const res = useSiteData<PerformanceData>("performance", async ({ org, site }) => gscToPerformance(await api.getGscMetrics(org.id, site.id)), DEMO_PERFORMANCE, { requires: "site" });
  const d = res.data;
  const live = res.source === "live";
  const hasData = d.queries.length > 0;

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={res.source} reason={res.reason} error={res.error} />
      <PageHeader
        icon={<TrendingUp className="w-5 h-5" />}
        title="Arama performansı"
        description={`Google Search Console: tıklama, gösterim, tıklama oranı ve ortalama sıra · son ${period} gün.`}
      />

      {res.loading ? (
        <Panel>
          <SkeletonRows rows={3} />
        </Panel>
      ) : live && !hasData ? (
        <Panel>
          <EmptyState
            title="Search Console verisi henüz yok"
            description="Mülkü bağladığınızda son 16 aylık sorgu ve sayfa verisi burada görünür."
            action={
              <Link href="/integrations" className="text-sm font-semibold text-accent-ink hover:underline">
                Search Console'u bağla →
              </Link>
            }
          />
        </Panel>
      ) : (
        <>
          <MetricStrip
            items={[
              { label: "Organik tıklama", value: formatCompact(d.clicks), trend: d.deltas.clicks ? { text: d.deltas.clicks, direction: "up" } : undefined, hint: `${period} gün` },
              { label: "Gösterim", value: formatCompact(d.impressions), trend: d.deltas.impressions ? { text: d.deltas.impressions, direction: "up" } : undefined },
              { label: "Tıklama oranı", value: formatPercent(d.ctr, 2), tone: "default", hint: d.ctr > 0.05 ? "sektör ort. üstü" : undefined },
              { label: "Ortalama sıra", value: formatNumber(d.position, 1), trend: d.deltas.position ? { text: d.deltas.position, direction: "up" } : undefined },
            ]}
          />
          <Panel flush title="En çok trafik getiren sorgular" sub="Tıklamaya göre sıralı">
            <DataTable columns={columns} rows={d.queries} rowKey={(r) => r.query} caption="Arama sorguları performans tablosu" />
          </Panel>
        </>
      )}
    </div>
  );
}
