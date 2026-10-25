"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, Coins, UserPlus } from "lucide-react";
import { api, ADMIN_ROLES, ADMIN_USAGE_METRICS, type AdminOrgDetail, type AdminRole } from "@/lib/api";
import { formatDate, formatMoneyMinor, formatNumber, formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { PageTabs, tabPanelProps } from "@/components/ui/PageTabs";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/States";
import { AuditList, METRIC_LABEL, QueryState, ROLE_LABEL, SubscriptionBadge, UsageMeter, adminErrorText, useAdmin, useAdminRefresh } from "@/components/admin/AdminUi";

type Tab = "members" | "sites" | "plan" | "audit";
type Member = AdminOrgDetail["members"][number];
type Site = AdminOrgDetail["sites"][number];

const CRAWL_STATUS: Record<string, { label: string; tone: "evidence" | "warn" | "critical" | "neutral" }> = {
  COMPLETED: { label: "Tamamlandı", tone: "evidence" },
  RUNNING: { label: "Sürüyor", tone: "warn" },
  QUEUED: { label: "Sırada", tone: "warn" },
  FAILED: { label: "Başarısız", tone: "critical" },
  CANCELLED: { label: "İptal", tone: "neutral" },
};

/** Gerekçe zorunlu: denetim kaydında kimin neden değiştirdiği kalır. */
const MIN_REASON = 5;

function useAction() {
  const refresh = useAdminRefresh();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
      return true;
    } catch (err) {
      setError(adminErrorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

function MembersTab({ org }: { org: AdminOrgDetail }) {
  const { busy, error, setError, run } = useAction();
  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("VIEWER");
  const [removing, setRemoving] = useState<Member | null>(null);
  const owners = org.members.filter((m) => m.role === "OWNER").length;

  const columns: Column<Member>[] = [
    {
      key: "email",
      header: "Üye",
      render: (m) => (
        <span className="block min-w-0">
          <span className="block text-sm text-ink break-all">{m.email}</span>
          {m.full_name && <span className="block text-xs text-muted">{m.full_name}</span>}
        </span>
      ),
    },
    {
      key: "role",
      header: "Rol",
      render: (m) => {
        const lastOwner = m.role === "OWNER" && owners <= 1;
        return (
          <Select
            aria-label={`${m.email} rolü`}
            value={m.role}
            disabled={busy || lastOwner}
            title={lastOwner ? "Son sahibin rolü düşürülemez" : undefined}
            onChange={(e) => run(() => api.adminUpdateMember(org.id, m.user_id, e.target.value as AdminRole))}
            className="w-44"
          >
            {ADMIN_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </Select>
        );
      },
    },
    { key: "added", header: "Eklenme", render: (m) => <span className="text-xs text-muted whitespace-nowrap">{formatDate(m.created_at)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">İşlemler</span>,
      align: "right",
      render: (m) => {
        const lastOwner = m.role === "OWNER" && owners <= 1;
        return (
          <Button size="sm" variant="ghost" disabled={busy || lastOwner} title={lastOwner ? "Son sahip çıkarılamaz" : undefined} onClick={() => setRemoving(m)}>
            Çıkar
          </Button>
        );
      },
    },
  ];

  return (
    <Panel
      flush
      title="Üyeler"
      sub="Organizasyonun son sahibi çıkarılamaz ve rolü düşürülemez."
      actions={
        <Button size="sm" icon={<UserPlus className="w-3.5 h-3.5" aria-hidden />} onClick={() => setAddOpen(true)}>
          Üye ekle
        </Button>
      }
    >
      {error && (
        <div className="p-4">
          <Notice tone="error" onClose={() => setError(null)}>
            {error}
          </Notice>
        </div>
      )}
      <DataTable caption="Üyeler" columns={columns} rows={org.members} rowKey={(m) => m.user_id} empty="Üye yok." />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Üye ekle">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => api.adminAddMember(org.id, { email: email.trim(), role }))) {
              setAddOpen(false);
              setEmail("");
            }
          }}
        >
          <div>
            <Label htmlFor="member-email" hint="kayıtlı bir kullanıcı olmalı">
              E-posta
            </Label>
            <Input id="member-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="member-role">Rol</Label>
            <Select id="member-role" value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
              {ADMIN_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Vazgeç
            </Button>
            <Button type="submit" loading={busy} disabled={!email.trim()}>
              Ekle
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Üyeyi çıkar">
        <p className="text-sm text-ink">
          {removing?.email} bu organizasyondan çıkarılır. Hesabı silinmez, diğer üyelikleri sürer.
        </p>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            Vazgeç
          </Button>
          <Button
            variant="danger"
            loading={busy}
            data-autofocus
            onClick={async () => {
              if (removing) await run(() => api.adminRemoveMember(org.id, removing.user_id));
              setRemoving(null);
            }}
          >
            Çıkar
          </Button>
        </div>
      </Modal>
    </Panel>
  );
}

function SitesTab({ org }: { org: AdminOrgDetail }) {
  const columns: Column<Site>[] = [
    {
      key: "name",
      header: "Site",
      render: (s) => (
        <span className="block min-w-0">
          <span className="block text-sm text-ink">{s.name}</span>
          <span className="block font-mono text-xs text-muted">{s.domain}</span>
        </span>
      ),
    },
    { key: "verify", header: "Doğrulama", render: (s) => <Badge tone={s.verification_status === "VERIFIED" ? "evidence" : "neutral"}>{s.verification_status === "VERIFIED" ? "Doğrulandı" : "Doğrulanmadı"}</Badge> },
    {
      key: "crawl",
      header: "Son tarama",
      render: (s) =>
        s.last_crawl ? (
          <span className="flex items-center gap-2">
            <Badge tone={CRAWL_STATUS[s.last_crawl.status]?.tone ?? "neutral"}>{CRAWL_STATUS[s.last_crawl.status]?.label ?? s.last_crawl.status}</Badge>
            <span className="text-xs text-muted whitespace-nowrap">{formatRelative(s.last_crawl.finished_at ?? s.last_crawl.created_at)}</span>
          </span>
        ) : (
          <span className="text-xs text-muted">Tarama yok</span>
        ),
    },
  ];
  return (
    <Panel flush title="Siteler" sub="Yalnızca görüntüleme.">
      <DataTable caption="Siteler" columns={columns} rows={org.sites} rowKey={(s) => s.id} empty="Bu organizasyonda site yok." />
    </Panel>
  );
}

function PlanTab({ org }: { org: AdminOrgDetail }) {
  const plans = useAdmin(["plans"], () => api.adminPlans());
  const { busy, error, setError, run } = useAction();
  const [mode, setMode] = useState<"plan" | "credits" | null>(null);
  const [planCode, setPlanCode] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const sub = org.subscription;
  const amountNum = Number(amount);
  const reasonOk = reason.trim().length >= MIN_REASON;

  const open = (m: "plan" | "credits") => {
    setMode(m);
    setReason("");
    setAmount("");
    setPlanCode(sub?.plan_code ?? "");
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok =
      mode === "plan"
        ? await run(() => api.adminChangePlan(org.id, { plan_code: planCode, reason: reason.trim() }))
        : await run(() => api.adminGrantCredits(org.id, { amount: amountNum, reason: reason.trim() }));
    if (ok) {
      setDone(mode === "plan" ? `Plan ${planCode} olarak değiştirildi.` : `${formatNumber(amountNum)} AI kredisi tanımlandı.`);
      setMode(null);
    }
  };

  return (
    <div className="space-y-5">
      {done && (
        <Notice tone="success" onClose={() => setDone(null)}>
          {done}
        </Notice>
      )}
      <Panel
        title="Abonelik"
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => open("plan")}>
              Planı değiştir
            </Button>
            <Button size="sm" variant="secondary" icon={<Coins className="w-3.5 h-3.5" aria-hidden />} onClick={() => open("credits")}>
              AI kredisi tanımla
            </Button>
          </div>
        }
      >
        <dl className="grid gap-4 sm:grid-cols-4 text-sm">
          <div>
            <dt className="text-xs text-muted">Plan</dt>
            <dd className="mt-1 font-semibold text-ink">{sub?.plan_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Durum</dt>
            <dd className="mt-1">
              <SubscriptionBadge status={sub?.status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Sağlayıcı</dt>
            <dd className="mt-1 text-ink">{sub?.provider === "MANUAL" ? "Elle" : sub?.provider ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Dönem sonu</dt>
            <dd className="mt-1 text-ink">{formatDate(sub?.current_period_end ?? sub?.trial_ends_at)}</dd>
          </div>
        </dl>
      </Panel>

      <Panel title="Bu dönemin kullanımı" sub={`AI kredisi bakiyesi: ${formatNumber(org.ai_credit_balance)}`}>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ADMIN_USAGE_METRICS.map((m) => (
            <li key={m}>
              <div className="text-xs text-muted mb-1.5">{METRIC_LABEL[m]}</div>
              <UsageMeter cell={org.usage[m]} />
            </li>
          ))}
        </ul>
      </Panel>

      <Modal open={mode !== null} onClose={() => setMode(null)} title={mode === "plan" ? "Planı değiştir" : "AI kredisi tanımla"}>
        <form onSubmit={submit} className="space-y-4">
          {mode === "plan" ? (
            <div>
              <Label htmlFor="plan-code">Yeni plan</Label>
              <Select id="plan-code" value={planCode} onChange={(e) => setPlanCode(e.target.value)} required>
                <option value="" disabled>
                  Plan seçin
                </option>
                {(plans.data ?? []).map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                    {p.monthly_price ? ` · ${formatMoneyMinor(p.monthly_price.amount_minor, p.monthly_price.currency)}/ay` : ""}
                    {p.is_public ? "" : " · gizli"}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted mt-1">Sağlayıcı “elle” olarak kaydedilir; ödeme alınmaz. Planın aylık kredisi bakiyeye eklenir.</p>
            </div>
          ) : (
            <div>
              <Label htmlFor="credit-amount">Kredi miktarı</Label>
              <Input id="credit-amount" type="number" min={1} max={1000000} step={1} required value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          )}
          <div>
            <Label htmlFor="admin-reason" hint={`en az ${MIN_REASON} karakter, denetim kaydına yazılır`}>
              Gerekçe
            </Label>
            <Textarea id="admin-reason" required minLength={MIN_REASON} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMode(null)}>
              Vazgeç
            </Button>
            <Button
              type="submit"
              loading={busy}
              disabled={!reasonOk || (mode === "plan" ? !planCode || planCode === sub?.plan_code : !(Number.isInteger(amountNum) && amountNum >= 1 && amountNum <= 1_000_000))}
            >
              Kaydet
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function AuditTab({ orgId }: { orgId: string }) {
  const audit = useAdmin(["audit", { org: orgId }], () => api.adminAudit({ org: orgId, page_size: 50 }));
  return (
    <Panel flush title="Denetim kaydı" sub="Bu organizasyonun son 50 kaydı">
      <QueryState query={audit}>{(d) => <AuditList rows={d.items} showOrg={false} />}</QueryState>
    </Panel>
  );
}

export default function AdminOrganizationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("members");
  const detail = useAdmin(["org", id], () => api.adminOrganization(id));

  return (
    <div className="space-y-5">
      <Link href="/admin/organizations" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft className="w-4 h-4" aria-hidden /> Organizasyonlar
      </Link>
      <QueryState query={detail}>
        {(org) => (
          <>
            <PageHeader
              icon={<Building2 className="w-5 h-5" />}
              title={org.name}
              description={`${org.slug} · oluşturulma ${formatDate(org.created_at)} · ${formatNumber(org.members.length)} üye · ${formatNumber(org.sites.length)} site`}
              actions={<SubscriptionBadge status={org.subscription?.status} />}
            />
            <PageTabs<Tab>
              label="Organizasyon bölümleri"
              idPrefix="org"
              value={tab}
              onChange={setTab}
              tabs={[
                { key: "members", label: "Üyeler" },
                { key: "sites", label: "Siteler" },
                { key: "plan", label: "Plan ve kullanım" },
                { key: "audit", label: "Denetim kaydı" },
              ]}
            />
            <div {...tabPanelProps("org", tab)}>
              {tab === "members" && <MembersTab org={org} />}
              {tab === "sites" && <SitesTab org={org} />}
              {tab === "plan" && <PlanTab org={org} />}
              {tab === "audit" && <AuditTab orgId={org.id} />}
            </div>
          </>
        )}
      </QueryState>
    </div>
  );
}
