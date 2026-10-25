"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CreditCard, ExternalLink } from "lucide-react";
import { api, type AdminBillingEventRow, type AdminInvoiceRow, type AdminSubscriptionRow } from "@/lib/api";
import { formatDate, formatDateTime, formatMinorByCurrency, formatMoneyMinor, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { PageTabs, tabPanelProps } from "@/components/ui/PageTabs";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { FilterChips, Input, Label, Select } from "@/components/ui/Input";
import { Notice } from "@/components/ui/States";
import { InvoiceBadge, Pager, QueryState, SubscriptionBadge, dayAfter, useAdmin } from "@/components/admin/AdminUi";

type Tab = "subscriptions" | "invoices" | "events";
const PAGE_SIZE = 50;

function OrgLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/admin/organizations/${id}`} className="text-sm text-accent-ink hover:underline">
      {name}
    </Link>
  );
}

function SubscriptionsTab() {
  const [status, setStatus] = useState("");
  const [plan, setPlan] = useState("");
  const [page, setPage] = useState(1);
  const plans = useAdmin(["plans"], () => api.adminPlans());
  const params = { status, plan, page, page_size: PAGE_SIZE };
  const list = useAdmin(["subscriptions", params], () => api.adminSubscriptions(params));

  const columns: Column<AdminSubscriptionRow>[] = [
    { key: "org", header: "Organizasyon", render: (s) => <OrgLink id={s.organization_id} name={s.organization_name} /> },
    { key: "plan", header: "Plan", render: (s) => <Badge mono>{s.plan_code}</Badge> },
    {
      key: "status",
      header: "Durum",
      render: (s) => (
        <span className="flex flex-wrap gap-1">
          <SubscriptionBadge status={s.status} />
          {s.cancel_at_period_end && <Badge tone="warn">Dönem sonunda iptal</Badge>}
        </span>
      ),
    },
    { key: "provider", header: "Sağlayıcı", render: (s) => <span className="text-sm text-ink">{s.provider === "MANUAL" ? "Elle" : s.provider ?? "—"}</span> },
    { key: "end", header: "Dönem sonu", render: (s) => <span className="text-xs text-muted whitespace-nowrap">{formatDate(s.current_period_end ?? s.trial_ends_at)}</span> },
    {
      key: "price",
      header: "Aylık tutar",
      align: "right",
      render: (s) => (s.monthly_price && s.monthly_price.amount_minor > 0 ? formatMoneyMinor(s.monthly_price.amount_minor, s.monthly_price.currency) : <span className="text-muted">Ücretsiz</span>),
    },
  ];

  return (
    <Panel flush>
      <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-line">
        <Select aria-label="Duruma göre süz" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-52">
          <option value="">Tüm durumlar</option>
          <option value="ACTIVE">Aktif</option>
          <option value="TRIALING">Deneme</option>
          <option value="PAST_DUE">Ödemesi gecikmiş</option>
          <option value="CANCELED">İptal</option>
        </Select>
        <Select aria-label="Plana göre süz" value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} className="sm:w-48">
          <option value="">Tüm planlar</option>
          {(plans.data ?? []).map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>
      <QueryState query={list}>
        {(d) => (
          <>
            <DataTable caption="Abonelikler" columns={columns} rows={d.items} rowKey={(s) => s.id} empty="Bu süzgece uyan abonelik yok." />
            <Pager page={d.page} pageSize={d.page_size} total={d.total} onChange={setPage} />
          </>
        )}
      </QueryState>
    </Panel>
  );
}

function InvoicesTab() {
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const params = { status, from, to: dayAfter(to), page, page_size: PAGE_SIZE };
  const list = useAdmin(["invoices", params], () => api.adminInvoices(params));

  const columns: Column<AdminInvoiceRow>[] = [
    { key: "number", header: "Numara", render: (i) => <span className="font-mono text-xs text-ink">{i.number ?? "—"}</span> },
    { key: "org", header: "Organizasyon", render: (i) => <OrgLink id={i.organization_id} name={i.organization_name} /> },
    { key: "total", header: "Tutar", align: "right", render: (i) => formatMoneyMinor(i.total_minor, i.currency) },
    { key: "tax", header: "Vergi", align: "right", render: (i) => <span className="text-muted">{formatMoneyMinor(i.tax_minor, i.currency)}</span> },
    { key: "status", header: "Durum", render: (i) => <InvoiceBadge status={i.status} /> },
    { key: "issued", header: "Kesim", render: (i) => <span className="text-xs text-muted whitespace-nowrap">{formatDate(i.issued_at)}</span> },
    { key: "paid", header: "Ödeme", render: (i) => <span className="text-xs text-muted whitespace-nowrap">{formatDate(i.paid_at)}</span> },
    {
      key: "pdf",
      header: <span className="sr-only">PDF</span>,
      render: (i) =>
        i.pdf_url ? (
          <a href={i.pdf_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline">
            PDF <ExternalLink className="w-3 h-3" aria-hidden />
          </a>
        ) : null,
    },
  ];

  return (
    <Panel flush>
      <div className="grid gap-3 sm:grid-cols-3 p-4 border-b border-line">
        <div>
          <Label htmlFor="inv-status">Durum</Label>
          <Select id="inv-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Tümü</option>
            <option value="PAID">Ödendi</option>
            <option value="PENDING">Bekliyor</option>
            <option value="VOID">İptal</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="inv-from">Başlangıç</Label>
          <Input id="inv-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </div>
        <div>
          <Label htmlFor="inv-to">Bitiş</Label>
          <Input id="inv-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>
      </div>
      <QueryState query={list}>
        {(d) => (
          <>
            <DataTable
              caption="Faturalar"
              columns={columns}
              rows={d.items}
              rowKey={(i) => i.id}
              empty="Fatura yok. Faturalar Paddle ödeme bildirimi geldiğinde yazılır; ödeme akışı canlıya alınana kadar bu liste boş kalır."
            />
            <Pager page={d.page} pageSize={d.page_size} total={d.total} onChange={setPage} />
          </>
        )}
      </QueryState>
    </Panel>
  );
}

type Processed = "all" | "false" | "true";

function EventsTab() {
  const [processed, setProcessed] = useState<Processed>("all");
  const [page, setPage] = useState(1);
  const params = { processed: processed === "all" ? undefined : processed, page, page_size: PAGE_SIZE };
  const list = useAdmin(["billing-events", params], () => api.adminBillingEvents(params));

  const columns: Column<AdminBillingEventRow>[] = [
    { key: "type", header: "Olay", render: (e) => <span className="font-mono text-xs text-ink">{e.event_type}</span> },
    { key: "provider", header: "Sağlayıcı", render: (e) => <span className="text-sm text-ink">{e.provider}</span> },
    { key: "at", header: "Zaman", render: (e) => <span className="text-xs text-muted whitespace-nowrap">{formatDateTime(e.created_at)}</span> },
    {
      key: "state",
      header: "İşlenme",
      render: (e) => (e.processed_at ? <Badge tone="evidence">İşlendi</Badge> : e.error ? <Badge tone="critical">Hata</Badge> : <Badge tone="warn">Bekliyor</Badge>),
    },
    { key: "error", header: "Hata", render: (e) => (e.error ? <span className="text-xs text-critical break-words">{e.error}</span> : <span className="text-muted">—</span>) },
  ];

  return (
    <Panel flush>
      <div className="p-4 border-b border-line">
        <FilterChips<Processed>
          label="İşlenme durumu"
          value={processed}
          onChange={(v) => {
            setProcessed(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "Tümü" },
            { value: "false", label: "İşlenmemiş" },
            { value: "true", label: "İşlenmiş" },
          ]}
        />
      </div>
      <QueryState query={list}>
        {(d) => (
          <>
            <DataTable caption="Ödeme olayları" columns={columns} rows={d.items} rowKey={(e) => e.id} empty="Ödeme olayı yok." />
            <Pager page={d.page} pageSize={d.page_size} total={d.total} onChange={setPage} />
          </>
        )}
      </QueryState>
    </Panel>
  );
}

export default function AdminBillingPage() {
  const [tab, setTab] = useState<Tab>("subscriptions");
  const summary = useAdmin(["billing-summary"], () => api.adminBillingSummary());
  const system = useAdmin(["system"], () => api.adminSystem());

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<CreditCard className="w-5 h-5" />}
        title="Ödemeler"
        description="Yalnızca okunur. Tutarlar para birimine göre ayrı gösterilir, kurla çevrilmez. İade ve iptal Paddle panelinden yapılır."
      />

      {system.data && !system.data.payments_configured && (
        <Notice tone="warn">Paddle anahtarları tanımlı değil: faturalar ve ödeme olayları gelmez. Elle atanan planlar Abonelikler sekmesinde görünür.</Notice>
      )}

      <QueryState query={summary} rows={2}>
        {(s) => (
          <MetricStrip
            items={[
              { label: "Aylık yinelenen gelir", value: <span className="text-xl">{formatMinorByCurrency(s.mrr_minor)}</span>, hint: "liste fiyatı" },
              { label: "Bu ay tahsilat", value: <span className="text-xl">{formatMinorByCurrency(s.collected_this_month_minor)}</span> },
              { label: "Ödemesi geciken", value: formatNumber(s.past_due), tone: s.past_due > 0 ? "critical" : "default" },
              { label: "Son 30 gün yeni ücretli", value: formatNumber(s.new_paid_last_30_days) },
              { label: "Son 30 gün iptal", value: formatNumber(s.canceled_last_30_days) },
            ]}
          />
        )}
      </QueryState>

      <PageTabs<Tab>
        label="Ödeme bölümleri"
        idPrefix="billing"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "subscriptions", label: "Abonelikler" },
          { key: "invoices", label: "Faturalar" },
          { key: "events", label: "Ödeme olayları" },
        ]}
      />
      <div {...tabPanelProps("billing", tab)}>
        {tab === "subscriptions" && <SubscriptionsTab />}
        {tab === "invoices" && <InvoicesTab />}
        {tab === "events" && <EventsTab />}
      </div>
    </div>
  );
}
