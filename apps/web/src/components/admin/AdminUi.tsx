"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { ApiError, type AdminAuditRow, type AdminRole, type AdminUsageCell, type AdminUsed } from "@/lib/api";
import { ADMIN_TABS, isAdminTabActive } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice, SkeletonRows } from "@/components/ui/States";

export function AdminTabs({ currentPath }: { currentPath: string }) {
  const ref = useRef<HTMLElement>(null);
  // Dar ekranda sekme çubuğu kayar; etkin sekme görünür alanda kalsın.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentPath]);
  return (
    <nav ref={ref} aria-label="Platform yönetimi bölümleri" className="mb-5 border-b border-line overflow-x-auto overflow-y-hidden custom-scrollbar">
      <ul className="flex gap-1 min-w-max">
        {ADMIN_TABS.map((t) => {
          const active = isAdminTabActive(t.href, currentPath);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center h-10 px-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                  active ? "border-accent text-ink font-semibold" : "border-transparent text-muted hover:text-ink"
                )}
              >
                {t.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Yönetim verisi her zaman arka uçtan gelir; örnek veriye düşülmez. Yetki hatalarında yeniden denenmez. */
export function useAdmin<T>(key: unknown[], fn: () => Promise<T>, enabled = true) {
  return useQuery({
    queryKey: ["admin", ...key],
    queryFn: fn,
    enabled,
    staleTime: 15_000,
    retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1,
  });
}

/** Arka uçta bitiş tarihi hariçtir; seçilen gün dahil olsun diye ertesi gün gönderilir. */
export function dayAfter(date: string): string {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Arama kutusunda her tuşta istek atılmasın diye değeri gecikmeli döndürür. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useAdminRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["admin"] });
}

export function adminErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Oturum arka uçta doğrulanamadı. Çıkış yapıp yeniden giriş yapın.";
    if (err.status === 403) return "Bu bölüm yalnızca platform yöneticilerine açık. Yöneticilik yetkiniz kaldırılmış olabilir.";
    if (err.status === 0 || err.status >= 500) return "Arka uç servisine ulaşılamadı. Panel örnek veri göstermez; biraz sonra yeniden deneyin.";
    return err.message;
  }
  return err instanceof Error ? err.message : "İstek başarısız oldu.";
}

/** Yükleniyor ve hata durumlarını tek yerde gösterir; veri hazırsa children çağrılır. */
export function QueryState<T>({ query, rows = 5, children }: { query: { data?: T; error: unknown; isPending: boolean; refetch: () => unknown }; rows?: number; children: (data: T) => React.ReactNode }) {
  if (query.isPending) return <SkeletonRows rows={rows} className="p-5" />;
  if (query.error || query.data === undefined) {
    return (
      <div className="p-4">
        <Notice
          tone="error"
          action={
            <Button size="sm" variant="secondary" icon={<RefreshCw className="w-3.5 h-3.5" aria-hidden />} onClick={() => query.refetch()}>
              Yeniden dene
            </Button>
          }
        >
          {adminErrorText(query.error)}
        </Notice>
      </div>
    );
  }
  return <>{children(query.data)}</>;
}

export function Pager({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return <div className="px-4 py-3 text-xs text-muted border-t border-line">{formatNumber(total)} kayıt</div>;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-line text-xs text-muted">
      <span>
        {formatNumber(total)} kayıt · sayfa {page}/{pages}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Önceki
        </Button>
        <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Sonraki
        </Button>
      </div>
    </div>
  );
}

export const ROLE_LABEL: Record<AdminRole, string> = {
  OWNER: "Sahip",
  ADMIN: "Yönetici",
  SEO_MANAGER: "SEO yöneticisi",
  EDITOR: "Editör",
  VIEWER: "İzleyici",
};

const SUBSCRIPTION_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Aktif", tone: "evidence" },
  TRIALING: { label: "Deneme", tone: "accent" },
  PAST_DUE: { label: "Ödemesi gecikmiş", tone: "critical" },
  CANCELED: { label: "İptal", tone: "neutral" },
  PAUSED: { label: "Durduruldu", tone: "warn" },
  INCOMPLETE: { label: "Tamamlanmadı", tone: "warn" },
};

export function SubscriptionBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge>Abonelik yok</Badge>;
  const s = SUBSCRIPTION_STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const INVOICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  PAID: { label: "Ödendi", tone: "evidence" },
  PENDING: { label: "Bekliyor", tone: "warn" },
  VOID: { label: "İptal", tone: "neutral" },
};

export function InvoiceBadge({ status }: { status: string }) {
  const s = INVOICE_STATUS[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export const METRIC_LABEL: Record<string, string> = {
  pages_crawled: "Taranan sayfa",
  auto_fixes: "Otomatik düzeltme",
  ai_credits: "AI kredisi",
  ai_tokens: "AI token",
};

const LEVEL_CLASS: Record<string, string> = {
  ok: "bg-evidence",
  warn: "bg-warn",
  over: "bg-critical",
};

/** Kullanım / sınır; sınırın %80'i sarı, %100'ü kırmızı. Renk tek başına anlam taşımaz, sayı metinde de yazar.
 *  Sınır null: plan sınır koymuyor. Sınır 0: özellik planda yok. */
export function UsageMeter({ cell }: { cell: AdminUsageCell | AdminUsed }) {
  const ratio = cell.limit ? cell.used / cell.limit : null;
  const level = cell.limit === 0 ? (cell.used > 0 ? "over" : null) : ratio === null ? null : ratio >= 1 ? "over" : ratio >= 0.8 ? "warn" : "ok";
  const limitText = cell.limit === null ? "sınırsız" : cell.limit === 0 ? "planda yok" : `/ ${formatNumber(cell.limit)}`;
  return (
    <div className="min-w-[120px]">
      <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
        <span className={cn("font-semibold", level === "over" ? "text-critical" : level === "warn" ? "text-warn" : "text-ink")}>{formatNumber(cell.used)}</span>
        <span className="text-muted">{limitText}</span>
      </div>
      {ratio !== null && (
        <div className="mt-1 h-1.5 rounded-full bg-surface-2 overflow-hidden" role="img" aria-label={`Sınırın %${formatNumber(ratio * 100)} kadarı kullanıldı`}>
          <div className={cn("h-full rounded-full", LEVEL_CLASS[level ?? "ok"])} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

const ACTION_LABEL: Record<string, string> = {
  "admin.user.update": "Kullanıcı güncellendi",
  "admin.org.create": "Organizasyon oluşturuldu",
  "admin.member.add": "Üye eklendi",
  "admin.member.update": "Üye rolü değişti",
  "admin.member.remove": "Üye çıkarıldı",
  "admin.plan.change": "Plan değişti",
  "admin.credits.grant": "AI kredisi tanımlandı",
};

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

function prettyState(raw: string | null): string {
  if (!raw) return "—";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** Denetim satırları; satır açılınca önceki ve sonraki durum yan yana görünür. */
export function AuditList({ rows, showOrg = true, empty = "Kayıt yok." }: { rows: AdminAuditRow[]; showOrg?: boolean; empty?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  if (rows.length === 0) return <p className="px-5 py-8 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {rows.map((r) => {
        const expanded = open === r.id;
        return (
          <li key={r.id}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : r.id)}
              className="w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-surface-2 transition-colors cursor-pointer"
            >
              {expanded ? <ChevronDown className="w-4 h-4 mt-0.5 text-muted shrink-0" aria-hidden /> : <ChevronRight className="w-4 h-4 mt-0.5 text-muted shrink-0" aria-hidden />}
              <span className="flex-1 min-w-0 grid gap-0.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3">
                <span className="min-w-0">
                  <span className="text-sm font-medium text-ink">{actionLabel(r.action)}</span>
                  <span className="block text-xs text-muted truncate">
                    {r.user_email ?? "sistem"}
                    {showOrg && r.organization_name ? ` · ${r.organization_name}` : ""}
                    {` · ${r.resource_type}`}
                  </span>
                </span>
                <span className="text-xs text-muted tabular-nums whitespace-nowrap">{formatDateTime(r.created_at)}</span>
              </span>
            </button>
            {expanded && (
              <div className="px-5 pb-4 grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Önceki durum", value: r.state_before },
                  { label: "Sonraki durum", value: r.state_after },
                ].map((b) => (
                  <div key={b.label} className="min-w-0">
                    <div className="text-xs font-semibold text-muted mb-1">{b.label}</div>
                    <pre className="bg-surface-2 border border-line rounded-sm p-3 text-xs font-mono text-ink overflow-x-auto whitespace-pre-wrap break-words">{prettyState(b.value)}</pre>
                  </div>
                ))}
                <div className="sm:col-span-2 text-xs text-muted font-mono break-all">
                  İşlem: {r.action} · kaynak: {r.resource_id ?? "—"} · IP: {r.ip_address ?? "—"}
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
