"use client";

import React, { useMemo, useState } from "react";
import { KeyRound, Search, Compass, Sparkles, ArrowRight, Target } from "lucide-react";
import { api } from "@/lib/api";
import { DEMO_KEYWORDS, DEMO_PERFORMANCE, type PerformanceData } from "@/lib/demo";
import { gscToPerformance } from "@/lib/mappers";
import { formatNumber, formatPercent } from "@/lib/format";
import { useSiteData } from "@/hooks/useSiteData";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Input, Segmented } from "@/components/ui/Input";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { EmptyState, SkeletonRows } from "@/components/ui/States";
import { ComplianceFlags } from "@/components/ComplianceFlags";
import { cn } from "@/lib/cn";

type QueryRow = PerformanceData["queries"][number];
type Tab = "rankings" | "ideas";
type Bucket = "all" | "top3" | "top10" | "near";

const INTENT_LABEL: Record<string, string> = { TRANSACTIONAL: "İşlemsel", COMMERCIAL: "Ticari", INFORMATIONAL: "Bilgi", NAVIGATIONAL: "Gezinme" };

/** 11-20 arası sıralar ilk sayfaya en yakın, gösterimi olan sorgulardır. */
const isNearPageOne = (r: QueryRow) => r.position > 10 && r.position <= 20 && r.impressions > 0;

function PositionBadge({ position }: { position: number }) {
  const cls = position <= 3 ? "bg-evidence-soft text-evidence border-evidence" : position <= 10 ? "bg-accent-soft text-accent-ink border-accent" : "bg-surface-2 text-ink border-line";
  return <span className={cn("inline-flex items-center justify-center min-w-[2.5rem] h-7 px-1.5 rounded-sm border font-mono font-semibold text-sm tabular-nums", cls)}>{formatNumber(position, 1)}</span>;
}

const columns: Column<QueryRow>[] = [
  {
    key: "query",
    header: "Sorgu",
    render: (r) => (
      <div className="flex flex-col gap-1 min-w-[12rem]">
        <span className="font-medium text-ink">{r.query}</span>
        <div className="flex flex-wrap gap-1">
          {isNearPageOne(r) && (
            <Badge tone="warn">
              <Target className="w-3 h-3" aria-hidden /> İlk sayfaya yakın
            </Badge>
          )}
          <ComplianceFlags text={r.query} />
        </div>
      </div>
    ),
  },
  { key: "position", header: "Ort. sıra", align: "center", render: (r) => <PositionBadge position={r.position} /> },
  { key: "clicks", header: "Tıklama", align: "right", render: (r) => <span className="font-mono">{formatNumber(r.clicks)}</span> },
  { key: "impressions", header: "Gösterim", align: "right", render: (r) => <span className="font-mono text-muted">{formatNumber(r.impressions)}</span> },
  { key: "ctr", header: "Tıklama oranı", align: "right", render: (r) => <span className="font-mono">{formatPercent(r.ctr, 1)}</span> },
];

export default function KeywordsPage() {
  const [tab, setTab] = useState<Tab>("rankings");
  const [query, setQuery] = useState("");
  const [bucket, setBucket] = useState<Bucket>("all");
  const res = useSiteData<PerformanceData>("keywords-gsc", async ({ org, site, period }) => gscToPerformance(await api.getGscMetrics(org.id, site.id, period)), DEMO_PERFORMANCE, { requires: "site" });
  const rows = res.data.queries;
  const live = res.source === "live";

  const stats = useMemo(
    () => ({
      top3: rows.filter((r) => r.position <= 3).length,
      top10: rows.filter((r) => r.position > 3 && r.position <= 10).length,
      near: rows.filter(isNearPageOne).length,
    }),
    [rows]
  );

  const filtered = rows
    .filter((r) => r.query.toLowerCase().includes(query.trim().toLowerCase()))
    .filter((r) => (bucket === "top3" ? r.position <= 3 : bucket === "top10" ? r.position <= 10 : bucket === "near" ? isNearPageOne(r) : true))
    .sort((a, b) => b.impressions - a.impressions);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-14">
      {tab === "rankings" ? <DemoBanner source={res.source} reason={res.reason} error={res.error} /> : <DemoBanner source="demo" reason="no-endpoint" />}
      <PageHeader
        icon={<KeyRound className="w-5 h-5" />}
        title="Anahtar kelimeler"
        description="Google'da hangi aramalarda göründüğünüz ve hangi sırada olduğunuz. Veriler Google Search Console'dan gelir."
      />

      <div role="tablist" aria-label="Anahtar kelime görünümü" className="flex items-center gap-1 border-b border-line">
        {(
          [
            ["rankings", "Sıralamalar", KeyRound],
            ["ideas", "Kelime fikirleri", Compass],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 h-10 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer",
              tab === value ? "border-accent text-accent-ink" : "border-transparent text-muted hover:text-ink"
            )}
          >
            <Icon className="w-4 h-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {tab === "rankings" ? (
        res.loading ? (
          <Panel>
            <SkeletonRows rows={6} />
          </Panel>
        ) : live && rows.length === 0 ? (
          <Panel>
            <EmptyState
              icon={<KeyRound className="w-8 h-8" />}
              title="Search Console verisi henüz yok"
              description="Sıralamalarınızı görmek için Google Search Console mülkünüzü bağlayın. Bağlandıktan sonra sorgularınız, sıralarınız ve tıklamalarınız burada görünür."
              action={<LinkButton href="/integrations" variant="primary" icon={<ArrowRight className="w-4 h-4" aria-hidden />}>Search Console'u bağla</LinkButton>}
            />
          </Panel>
        ) : (
          <>
            <MetricStrip
              items={[
                { label: "Sorgu", value: formatNumber(rows.length), hint: "Search Console'da görünen" },
                { label: "İlk 3", value: formatNumber(stats.top3), tone: "evidence", hint: "En çok tıklanan sıralar" },
                { label: "4-10 arası", value: formatNumber(stats.top10), hint: "İlk sayfa" },
                { label: "11-20 arası", value: formatNumber(stats.near), tone: "warn", hint: "İlk sayfaya taşınabilir" },
              ]}
            />
            {stats.near > 0 && (
              <p className="text-sm text-ink">
                <strong>{stats.near} sorgu</strong> ikinci sayfada. Bu sorgulara ait sayfaların başlığını ve içeriğini güçlendirmek, ilk sayfaya çıkmanın en hızlı yoludur.
              </p>
            )}
            <Panel flush>
              <div className="p-4 border-b border-line flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="w-full md:w-80">
                  <Input placeholder="Sorgu ara" aria-label="Sorgu ara" value={query} onChange={(e) => setQuery(e.target.value)} icon={<Search className="w-4 h-4" />} />
                </div>
                <Segmented<Bucket>
                  label="Sıra aralığı"
                  value={bucket}
                  onChange={setBucket}
                  options={[
                    { value: "all", label: "Tümü" },
                    { value: "top3", label: "İlk 3" },
                    { value: "top10", label: "İlk 10" },
                    { value: "near", label: "11-20" },
                  ]}
                />
              </div>
              <DataTable
                caption="Search Console sorguları ve sıraları"
                columns={columns}
                rows={filtered}
                rowKey={(r) => r.query}
                empty={query ? "Aramanızla eşleşen sorgu yok." : "Bu aralıkta sorgu yok."}
              />
            </Panel>
          </>
        )
      ) : (
        <Panel title="Kelime fikirleri" sub="Arama hacmi, zorluk ve tıklama başı maliyet için bir anahtar kelime veri sağlayıcısı bağlantısı gerekir. Bu veri henüz platformda yok; aşağıdakiler örnektir.">
          <ul className="divide-y divide-line border border-line rounded-sm">
            {DEMO_KEYWORDS.researchSuggestions.map((item) => (
              <li key={item.keyword} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink text-sm">{item.keyword}</span>
                    <Badge tone="neutral">{INTENT_LABEL[item.intent] ?? item.intent}</Badge>
                    {item.has_ai_overview && (
                      <Badge tone="accent">
                        <Sparkles className="w-3 h-3" aria-hidden /> AI Overview çıkıyor
                      </Badge>
                    )}
                    <ComplianceFlags text={item.keyword} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 text-xs text-muted font-mono">
                    <span>Hacim {formatNumber(item.volume)}</span>
                    <span>Zorluk %{item.difficulty}</span>
                    <span>CPC ₺{item.cpc.toFixed(2)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
