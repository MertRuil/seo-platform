"use client";

import React from "react";
import Link from "next/link";
import { Building2, CheckCircle2, XCircle } from "lucide-react";
import { api, type AdminSystemStatus } from "@/lib/api";
import { formatMinorByCurrency, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { AuditList, QueryState, useAdmin } from "@/components/admin/AdminUi";

function SystemRow({ label, ok, text }: { label: string; ok: boolean; text: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="text-sm text-ink">{label}</span>
      <span className={ok ? "inline-flex items-center gap-1.5 text-sm text-evidence" : "inline-flex items-center gap-1.5 text-sm text-critical"}>
        {ok ? <CheckCircle2 className="w-4 h-4" aria-hidden /> : <XCircle className="w-4 h-4" aria-hidden />}
        {text}
      </span>
    </li>
  );
}

const QUEUE_TEXT: Record<AdminSystemStatus["queue"], string> = {
  redis: "Redis",
  in_process: "Süreç içi (Redis yok)",
  unavailable: "Kullanılamıyor",
};

export default function AdminOverviewPage() {
  const overview = useAdmin(["overview"], () => api.adminOverview());
  const system = useAdmin(["system"], () => api.adminSystem());

  return (
    <div className="space-y-5">
      <PageHeader icon={<Building2 className="w-5 h-5" />} title="Platform yönetimi" description="Kullanıcılar, organizasyonlar, ödemeler ve sistem durumu. Veriler doğrudan arka uçtan okunur." />

      <QueryState query={overview} rows={3}>
        {(o) => (
          <>
            <MetricStrip
              items={[
                { label: "Kullanıcı", value: formatNumber(o.users.total), hint: `aktif ${formatNumber(o.users.active)}`, href: "/admin/users" },
                { label: "Organizasyon", value: formatNumber(o.organizations), href: "/admin/organizations" },
                { label: "Site", value: formatNumber(o.sites) },
                {
                  label: "Son 7 gün tarama",
                  value: formatNumber(o.crawls_last_7_days.total),
                  hint: `başarısız ${formatNumber(o.crawls_last_7_days.failed)}`,
                  tone: o.crawls_last_7_days.failed > 0 ? "warn" : "default",
                },
              ]}
            />
            <MetricStrip
              items={[
                { label: "Aylık yinelenen gelir", value: <span className="text-xl">{formatMinorByCurrency(o.billing.mrr_minor)}</span>, hint: "liste fiyatı", href: "/admin/billing" },
                { label: "Bu ay tahsilat", value: <span className="text-xl">{formatMinorByCurrency(o.billing.collected_this_month_minor)}</span> },
                { label: "Ödemesi geciken", value: formatNumber(o.billing.past_due), tone: o.billing.past_due > 0 ? "critical" : "default" },
                { label: "Son 30 gün", value: `+${formatNumber(o.billing.new_paid_last_30_days)}`, hint: `iptal ${formatNumber(o.billing.canceled_last_30_days)}` },
              ]}
            />
          </>
        )}
      </QueryState>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Plan dağılımı" sub="Organizasyon sayısı">
          <QueryState query={overview} rows={3}>
            {(o) => {
              const entries = Object.entries(o.plans).sort((a, b) => b[1] - a[1]);
              const max = Math.max(1, ...entries.map(([, n]) => n));
              return entries.length === 0 ? (
                <p className="text-sm text-muted">Organizasyon yok.</p>
              ) : (
                <ul className="space-y-2.5">
                  {entries.map(([code, n]) => (
                    <li key={code} className="grid grid-cols-[96px_minmax(0,1fr)_48px] items-center gap-3 text-sm">
                      <span className="font-mono text-xs text-ink truncate">{code === "none" ? "planı yok" : code}</span>
                      <span className="h-2 rounded-full bg-surface-2 overflow-hidden">
                        <span className="block h-full bg-accent rounded-full" style={{ width: `${(n / max) * 100}%` }} />
                      </span>
                      <span className="text-right tabular-nums text-ink">{formatNumber(n)}</span>
                    </li>
                  ))}
                </ul>
              );
            }}
          </QueryState>
        </Panel>

        <Panel title="Sistem durumu" sub="Anahtar değerleri gösterilmez; yalnızca tanımlı olup olmadıkları">
          <QueryState query={system} rows={5}>
            {(s) => (
              <ul className="divide-y divide-line">
                <SystemRow label="Veritabanı" ok={s.database} text={s.database ? "Bağlı" : "Ulaşılamıyor"} />
                <SystemRow label="İş kuyruğu" ok={s.queue === "redis"} text={QUEUE_TEXT[s.queue]} />
                <SystemRow
                  label={`AI sağlayıcı${s.llm.provider ? ` (${s.llm.provider}${s.llm.model ? `, ${s.llm.model}` : ""})` : ""}`}
                  ok={s.llm.api_key_configured}
                  text={s.llm.api_key_configured ? "Anahtar tanımlı" : "Anahtar yok"}
                />
                <SystemRow label="E-posta (SMTP)" ok={s.smtp_configured} text={s.smtp_configured ? "Yapılandırıldı" : "Yapılandırılmadı"} />
                <SystemRow label="Ödeme (Paddle)" ok={s.payments_configured} text={s.payments_configured ? "Yapılandırıldı" : "Yapılandırılmadı"} />
                <li className="pt-2.5 text-xs text-muted">Ortam: {s.environment}</li>
              </ul>
            )}
          </QueryState>
        </Panel>
      </div>

      <Panel
        flush
        title="Son yönetici işlemleri"
        actions={
          <Link href="/admin/audit" className="text-sm font-semibold text-accent-ink hover:underline">
            Tümü
          </Link>
        }
      >
        <QueryState query={overview}>{(o) => <AuditList rows={o.recent_admin_actions} empty="Henüz yönetici işlemi yok." />}</QueryState>
      </Panel>
    </div>
  );
}
