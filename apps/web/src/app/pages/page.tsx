"use client";

import React, { useState } from "react";
import { FileText, CheckCircle2, XCircle, Search } from "lucide-react";
import { api } from "@/lib/api";
import { DEMO_PAGES, type PageRow } from "@/lib/demo";
import { pagesToRows } from "@/lib/mappers";
import { formatNumber, shortUrl } from "@/lib/format";
import { useSiteData } from "@/hooks/useSiteData";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { SkeletonRows } from "@/components/ui/States";

const columns: Column<PageRow>[] = [
  {
    key: "url",
    header: "Sayfa",
    render: (r) => (
      <div className="min-w-0 max-w-md">
        <div className="font-medium text-ink truncate">{r.title}</div>
        <div className="font-mono text-xs text-accent-ink truncate" title={r.url}>
          {shortUrl(r.url, 64)}
        </div>
      </div>
    ),
  },
  {
    key: "status",
    header: "HTTP",
    align: "center",
    render: (r) => (
      <Badge tone={r.status === 200 ? "evidence" : r.status < 400 ? "accent" : "critical"} mono>
        {r.status}
      </Badge>
    ),
  },
  {
    key: "canonical",
    header: "Canonical",
    render: (r) => <span className={r.canonicalBroken ? "font-mono text-xs text-critical font-semibold" : "font-mono text-xs text-ink"}>{r.canonical}</span>,
  },
  {
    key: "indexable",
    header: "İndekslenebilir",
    align: "center",
    render: (r) =>
      r.indexable ? (
        <CheckCircle2 className="w-4 h-4 text-evidence mx-auto" aria-label="Evet" />
      ) : (
        <XCircle className="w-4 h-4 text-critical mx-auto" aria-label="Hayır" />
      ),
  },
  { key: "depth", header: "Derinlik", align: "center", expertOnly: true, render: (r) => <span className="font-mono text-xs">{r.depth ?? "—"}</span> },
  { key: "response", header: "Yanıt (ms)", align: "right", expertOnly: true, render: (r) => <span className="font-mono text-xs">{r.responseMs ?? "—"}</span> },
  { key: "words", header: "Kelime", align: "right", render: (r) => <span className="font-mono text-xs text-muted">{r.words > 0 ? formatNumber(r.words) : "—"}</span> },
];

export default function TarananSayfalarPage() {
  const [q, setQ] = useState("");
  const res = useSiteData<PageRow[]>("pages", async ({ org, site, crawl }) => pagesToRows(await api.getCrawlPages(org.id, site.id, crawl!.id, { limit: 200 })), DEMO_PAGES);
  const needle = q.toLowerCase();
  const rows = res.data.filter((p) => p.url.toLowerCase().includes(needle) || p.title.toLowerCase().includes(needle));

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={res.source} reason={res.reason} error={res.error} />
      <PageHeader
        icon={<FileText className="w-5 h-5" />}
        title="Taranan sayfalar ve indeks durumu"
        description="Tarayıcının keşfettiği URL'ler, HTTP yanıt kodları, canonical hedefleri ve indeks uygunluğu. Uzman görünümü derinlik ve yanıt süresini de gösterir."
        actions={<Input icon={<Search className="w-4 h-4" />} placeholder="URL veya başlık ara" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-72" aria-label="Sayfa ara" />}
      />
      <Panel flush title={`${formatNumber(rows.length)} sayfa`} sub={q ? `"${q}" için filtrelendi` : "Son taramadaki tüm URL'ler"}>
        {res.loading ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.url} caption="Taranan sayfalar tablosu" empty="Arama kriterine uyan sayfa yok." />
        )}
      </Panel>
    </div>
  );
}
