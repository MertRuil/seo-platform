"use client";

import React from "react";
import { Link2 } from "lucide-react";
import { api } from "@/lib/api";
import { DEMO_LINKS, type LinksData } from "@/lib/demo";
import { graphToLinks } from "@/lib/mappers";
import { formatNumber, shortUrl } from "@/lib/format";
import { useSiteData } from "@/hooks/useSiteData";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { EmptyState, SkeletonRows } from "@/components/ui/States";

type TopRow = LinksData["top"][number];

const columns: Column<TopRow>[] = [
  { key: "url", header: "Sayfa", render: (r) => <span className="font-mono text-xs text-ink" title={r.url}>{shortUrl(r.url, 60)}</span> },
  { key: "pagerank", header: "PageRank", align: "center", render: (r) => <span className="font-mono text-accent-ink font-semibold">{formatNumber(r.pagerank, 4)}</span> },
  { key: "in", header: "Gelen", align: "center", render: (r) => <span className="font-mono text-evidence font-semibold">{r.inbound}</span> },
  { key: "out", header: "Giden", align: "center", expertOnly: true, render: (r) => <span className="font-mono text-muted">{r.outbound}</span> },
  { key: "status", header: "Durum", align: "right", render: (r) => <Badge tone={r.weak ? "warn" : "evidence"}>{r.status}</Badge> },
];

export default function IcLinkGrafiPage() {
  const res = useSiteData<LinksData>("graph", async ({ org, site }) => graphToLinks(await api.getSiteGraph(org.id, site.id)), DEMO_LINKS);
  const d = res.data;

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={res.source} reason={res.reason} error={res.error} />
      <PageHeader icon={<Link2 className="w-5 h-5" />} title="İç link grafı ve PageRank" description="Yönlendirilmiş link grafı üzerinden otorite akışı, yetim sayfalar ve bağlantı fırsatları." />

      {res.loading ? (
        <Panel>
          <SkeletonRows rows={3} />
        </Panel>
      ) : (
        <>
          <MetricStrip
            items={[
              { label: "Graf düğümü", value: formatNumber(d.nodes), unit: "sayfa", hint: `${formatNumber(d.edges)} iç bağlantı` },
              { label: "Yetim sayfa", value: d.orphans, tone: d.orphans > 0 ? "warn" : "evidence", hint: "iç link almayan" },
              { label: "Ortalama tıklama derinliği", value: d.avgDepth, tone: "evidence", hint: "tarama bütçesi için" },
            ]}
          />
          <Panel flush title="PageRank otorite sıralaması">
            <DataTable columns={columns} rows={d.top} rowKey={(r) => r.url} caption="Sayfa içi PageRank sıralaması" empty="Graf verisi yok." />
          </Panel>
          <Panel flush title="Bağlantı fırsatları" sub="Otoritesi yüksek kaynaktan zayıf hedefe önerilen bağlamsal linkler">
            {d.opportunities.length === 0 ? (
              <EmptyState title="Öneri yok" description="Graf hesaplandığında bağlantı fırsatları burada listelenir." />
            ) : (
              <ul className="divide-y divide-line">
                {d.opportunities.map((o, i) => (
                  <li key={i} className="px-5 py-3 text-sm">
                    <div className="font-mono text-xs text-ink flex flex-wrap items-center gap-2">
                      <span title={o.source}>{shortUrl(o.source, 44)}</span>
                      <span className="text-muted">→</span>
                      <span className="text-accent-ink" title={o.target}>
                        {shortUrl(o.target, 44)}
                      </span>
                    </div>
                    <p className="text-muted mt-0.5">{o.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
