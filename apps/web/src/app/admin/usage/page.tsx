"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Activity, X } from "lucide-react";
import { api, ADMIN_USAGE_METRICS, type AdminUsageDetail, type AdminUsageMetric, type AdminUsageRow } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Select, Segmented } from "@/components/ui/Input";
import { TrendChart } from "@/components/ui/TrendChart";
import { METRIC_LABEL, Pager, QueryState, UsageMeter, useAdmin } from "@/components/admin/AdminUi";

const PAGE_SIZE = 50;
const DAYS = 30;

/** Dönem sınırları UTC gece yarısıdır; yerel saate çevrilirse bitiş günü bir gün kayar. */
function utcDay(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Son 30 günü (UTC) boş günler sıfır olacak şekilde seriye çevirir. */
function dailySeries(daily: AdminUsageDetail["daily"], metric: AdminUsageMetric) {
  const byDate = new Map(daily.filter((d) => d.metric === metric).map((d) => [d.date, d.quantity]));
  const labels: string[] = [];
  const values: number[] = [];
  const today = new Date();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", timeZone: "UTC" }));
    values.push(byDate.get(key) ?? 0);
  }
  return { labels, values };
}

const LEDGER_REASON: Record<string, string> = {
  PLAN_GRANT: "Plan kredisi",
  MANUAL: "Elle tanımlama",
  MANUAL_PURCHASE: "Satın alma",
  CONSUME: "Tüketim",
  REFUND: "İade",
};

function UsageDetail({ row, onClose }: { row: AdminUsageRow; onClose: () => void }) {
  const [metric, setMetric] = useState<AdminUsageMetric>("pages_crawled");
  const detail = useAdmin(["usage", row.organization_id], () => api.adminUsageDetail(row.organization_id));

  return (
    <Panel
      flush
      title={row.organization_name}
      sub="Son 30 günün günlük kullanımı, kullanım olayları ve AI kredi hareketleri"
      actions={
        <div className="flex items-center gap-2">
          <Link href={`/admin/organizations/${row.organization_id}`} className="text-sm font-semibold text-accent-ink hover:underline">
            Organizasyon
          </Link>
          <button type="button" onClick={onClose} aria-label="Ayrıntıyı kapat" className="w-8 h-8 inline-flex items-center justify-center rounded-sm text-muted hover:text-ink hover:bg-surface-2 cursor-pointer">
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
      }
    >
      <QueryState query={detail}>
        {(d) => {
          const series = dailySeries(d.daily, metric);
          return (
            <div className="divide-y divide-line">
              <div className="p-5 space-y-3">
                <div className="overflow-x-auto">
                  <Segmented<AdminUsageMetric> label="Metrik" value={metric} onChange={setMetric} options={ADMIN_USAGE_METRICS.map((m) => ({ value: m, label: METRIC_LABEL[m] }))} />
                </div>
                <TrendChart
                  labels={series.labels}
                  series={[{ name: METRIC_LABEL[metric], values: series.values, tone: "accent" }]}
                  height={180}
                  format={(n) => formatNumber(n)}
                  ariaLabel={`${row.organization_name} için son 30 günün günlük ${METRIC_LABEL[metric].toLowerCase()} kullanımı`}
                />
              </div>

              <section>
                <h3 className="text-sm font-semibold text-ink px-5 pt-4 pb-2">Kullanım olayları</h3>
                {d.events.length === 0 ? (
                  <p className="px-5 pb-4 text-sm text-muted">Olay yok.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {d.events.map((e) => (
                      <li key={e.id} className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0">
                          <span className="text-ink">{METRIC_LABEL[e.metric] ?? e.metric}</span>
                          <span className="block text-xs text-muted font-mono truncate">
                            {e.ref_type ?? "—"} {e.ref_id ?? ""}
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block tabular-nums text-ink">{formatNumber(e.quantity)}</span>
                          <span className="block text-xs text-muted">{formatDateTime(e.created_at)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold text-ink px-5 pt-4 pb-2">AI kredi hareketleri</h3>
                {d.credit_ledger.length === 0 ? (
                  <p className="px-5 pb-4 text-sm text-muted">Hareket yok.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {d.credit_ledger.map((c) => (
                      <li key={c.id} className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0">
                          <span className="text-ink">{LEDGER_REASON[c.reason] ?? c.reason}</span>
                          <span className="block text-xs text-muted">{formatDateTime(c.created_at)}</span>
                        </span>
                        <span className="text-right shrink-0 tabular-nums">
                          <span className={c.delta >= 0 ? "block text-evidence" : "block text-critical"}>
                            {c.delta >= 0 ? "+" : "−"}
                            {formatNumber(Math.abs(c.delta))}
                          </span>
                          <span className="block text-xs text-muted">bakiye {formatNumber(c.balance_after)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          );
        }}
      </QueryState>
    </Panel>
  );
}

export default function AdminUsagePage() {
  const [metric, setMetric] = useState<"" | AdminUsageMetric>("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdminUsageRow | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  // Dar ekranda ayrıntı tablonun altında açılır; görünür alana kaydırılır.
  useEffect(() => {
    if (selected) detailRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);
  const params = { metric, page, page_size: PAGE_SIZE };
  const list = useAdmin(["usage-list", params], () => api.adminUsage(params));

  const columns: Column<AdminUsageRow>[] = [
    {
      key: "org",
      header: "Organizasyon",
      render: (r) => (
        <button type="button" onClick={() => setSelected(r)} className="text-left cursor-pointer group" aria-label={`${r.organization_name} kullanım ayrıntısı`}>
          <span className="block text-sm font-medium text-accent-ink group-hover:underline">{r.organization_name}</span>
          <Badge mono className="mt-0.5">
            {r.plan_code ?? "planı yok"}
          </Badge>
        </button>
      ),
    },
    ...ADMIN_USAGE_METRICS.map((m) => ({ key: m, header: METRIC_LABEL[m], render: (r: AdminUsageRow) => <UsageMeter cell={r.metrics[m]} /> })),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Activity className="w-5 h-5" />}
        title="Kullanım"
        description="Bu dönemin kullanımı, plan sınırına oranla. Sınırın %80'ini geçen sarı, sınıra ulaşan kırmızı."
        actions={
          <Select
            aria-label="Sıralama ölçütü"
            value={metric}
            onChange={(e) => {
              setMetric(e.target.value as "" | AdminUsageMetric);
              setPage(1);
            }}
            className="w-56"
          >
            <option value="">En yüksek orana göre</option>
            {ADMIN_USAGE_METRICS.map((m) => (
              <option key={m} value={m}>
                {METRIC_LABEL[m]} oranına göre
              </option>
            ))}
          </Select>
        }
      />

      <div className={selected ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] items-start" : ""}>
        <Panel flush>
          <QueryState query={list}>
            {(d) => (
              <>
                <div className="px-4 py-2.5 text-xs text-muted border-b border-line">
                  Dönem: {utcDay(d.period_start)} – {utcDay(new Date(new Date(d.period_end).getTime() - 1).toISOString())} (UTC)
                </div>
                <DataTable caption="Organizasyon başına kullanım" columns={columns} rows={d.items} rowKey={(r) => r.organization_id} empty="Organizasyon yok." />
                <Pager page={d.page} pageSize={d.page_size} total={d.total} onChange={setPage} />
              </>
            )}
          </QueryState>
        </Panel>
        <div ref={detailRef}>{selected && <UsageDetail key={selected.organization_id} row={selected} onClose={() => setSelected(null)} />}</div>
      </div>
    </div>
  );
}
