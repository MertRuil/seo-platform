"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Users, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, ADMIN_ROLES, type AdminRole, type AdminUserDetail, type AdminUserRow } from "@/lib/api";
import { formatDate, formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FilterChips, Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/States";
import { AuditList, Pager, QueryState, ROLE_LABEL, adminErrorText, useAdmin, useAdminRefresh, useDebounced } from "@/components/admin/AdminUi";

type StatusFilter = "all" | "active" | "inactive";
type AdminFilter = "all" | "true";
const PAGE_SIZE = 50;

function MembershipBadges({ items }: { items: AdminUserRow["memberships"] }) {
  if (items.length === 0) return <span className="text-xs text-warn">Organizasyonu yok</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((m) => (
        <Badge key={m.organization_id} tone={m.role === "OWNER" ? "accent" : "neutral"}>
          {m.organization_name} · {ROLE_LABEL[m.role] ?? m.role}
        </Badge>
      ))}
    </span>
  );
}

type Confirm = { title: string; body: string; patch: { is_active?: boolean; is_platform_admin?: boolean }; danger?: boolean };

function UserDetail({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { user: me } = useAuth();
  const refresh = useAdminRefresh();
  const detail = useAdmin(["user", userId], () => api.adminUser(userId));
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const apply = async () => {
    if (!confirm) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminUpdateUser(userId, confirm.patch);
      setConfirm(null);
      await refresh();
    } catch (err) {
      setError(adminErrorText(err));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      flush
      title="Kullanıcı ayrıntısı"
      actions={
        <button type="button" onClick={onClose} aria-label="Ayrıntıyı kapat" className="w-8 h-8 inline-flex items-center justify-center rounded-sm text-muted hover:text-ink hover:bg-surface-2 cursor-pointer">
          <X className="w-4 h-4" aria-hidden />
        </button>
      }
    >
      <QueryState query={detail}>
        {(u: AdminUserDetail) => {
          const self = u.id === me?.id;
          return (
            <div className="divide-y divide-line">
              <div className="px-5 py-4 space-y-2">
                <div className="text-base font-semibold text-ink break-all">{u.full_name || u.email}</div>
                {u.full_name && <div className="text-sm text-muted break-all">{u.email}</div>}
                <div className="flex flex-wrap gap-1.5">
                  {u.is_active ? <Badge tone="evidence">Aktif</Badge> : <Badge tone="critical">Pasif</Badge>}
                  {u.is_platform_admin && <Badge tone="accent">Platform yöneticisi</Badge>}
                </div>
                <div className="text-xs text-muted">
                  Kayıt {formatDate(u.created_at)} · son giriş {formatRelative(u.last_login_at)}
                </div>
                {error && <Notice tone="error" onClose={() => setError(null)}>{error}</Notice>}
                <div className="flex flex-wrap gap-2 pt-1">
                  {u.is_active ? (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={self}
                      title={self ? "Kendinizi pasife alamazsınız" : undefined}
                      onClick={() => setConfirm({ title: "Kullanıcıyı pasife al", body: `${u.email} artık giriş yapamaz ve açık oturumları bir sonraki istekte reddedilir. Veriler silinmez.`, patch: { is_active: false }, danger: true })}
                    >
                      Pasife al
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setConfirm({ title: "Kullanıcıyı aktif et", body: `${u.email} yeniden giriş yapabilir.`, patch: { is_active: true } })}>
                      Aktif et
                    </Button>
                  )}
                  {u.is_platform_admin ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={self}
                      title={self ? "Kendi yöneticiliğinizi kaldıramazsınız" : undefined}
                      onClick={() => setConfirm({ title: "Yöneticiliği kaldır", body: `${u.email} platform yönetimine bir sonraki istekte erişemez.`, patch: { is_platform_admin: false }, danger: true })}
                    >
                      Yöneticiliği kaldır
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setConfirm({ title: "Platform yöneticisi yap", body: `${u.email} tüm kullanıcıları, organizasyonları ve ödemeleri görebilir, plan ve kredi değiştirebilir.`, patch: { is_platform_admin: true }, danger: true })}
                    >
                      Yönetici yap
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
                    Organizasyona ekle
                  </Button>
                </div>
              </div>

              <section className="px-5 py-4">
                <h3 className="text-sm font-semibold text-ink mb-2">Üyelikler</h3>
                {u.memberships.length === 0 ? (
                  <p className="text-sm text-muted">Hiçbir organizasyonda üye değil.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {u.memberships.map((m) => (
                      <li key={m.organization_id} className="flex items-center justify-between gap-2 text-sm">
                        <Link href={`/admin/organizations/${m.organization_id}`} className="text-accent-ink hover:underline truncate">
                          {m.organization_name}
                        </Link>
                        <Badge tone={m.role === "OWNER" ? "accent" : "neutral"}>{ROLE_LABEL[m.role] ?? m.role}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="px-5 py-4">
                <h3 className="text-sm font-semibold text-ink mb-2">Sahip olduğu siteler</h3>
                {u.owned_sites.length === 0 ? (
                  <p className="text-sm text-muted">Site yok.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {u.owned_sites.map((s) => (
                      <li key={s.id} className="flex justify-between gap-2">
                        <span className="text-ink truncate">{s.name}</span>
                        <span className="font-mono text-xs text-muted truncate">{s.domain}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between px-5 pt-4 pb-1">
                  <h3 className="text-sm font-semibold text-ink">Son denetim kayıtları</h3>
                  <Link href={`/admin/audit?user=${u.id}`} className="text-xs font-semibold text-accent-ink hover:underline">
                    Tümü
                  </Link>
                </div>
                <AuditList rows={u.audit} />
              </section>

              <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title ?? ""}>
                <p className="text-sm text-ink">{confirm?.body}</p>
                <div className="flex justify-end gap-2 mt-5">
                  <Button variant="secondary" onClick={() => setConfirm(null)}>
                    Vazgeç
                  </Button>
                  <Button variant={confirm?.danger ? "danger" : "primary"} loading={busy} onClick={apply} data-autofocus>
                    Onayla
                  </Button>
                </div>
              </Modal>
              <AddToOrgModal open={addOpen} email={u.email} onClose={() => setAddOpen(false)} />
            </div>
          );
        }}
      </QueryState>
    </Panel>
  );
}

function AddToOrgModal({ open, email, onClose }: { open: boolean; email: string; onClose: () => void }) {
  const refresh = useAdminRefresh();
  const [q, setQ] = useState("");
  const [orgId, setOrgId] = useState("");
  const [role, setRole] = useState<AdminRole>("VIEWER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const term = useDebounced(q.trim());
  const orgs = useAdmin(["orgs-pick", term], () => api.adminOrganizations({ q: term, page_size: 10 }), open);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminAddMember(orgId, { email, role });
      await refresh();
      onClose();
      setOrgId("");
      setQ("");
    } catch (err) {
      setError(adminErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Organizasyona ekle">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="org-search">Organizasyon</Label>
          <Input id="org-search" icon={<Search className="w-4 h-4" />} placeholder="Ad veya slug ara" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mt-2 max-h-48 overflow-y-auto custom-scrollbar border border-line rounded-sm divide-y divide-line" role="radiogroup" aria-label="Organizasyon seç">
            {(orgs.data?.items ?? []).map((o) => (
              <label key={o.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-surface-2">
                <input type="radio" name="org" value={o.id} aria-label={o.name} checked={orgId === o.id} onChange={() => setOrgId(o.id)} />
                <span className="text-ink truncate">{o.name}</span>
                <span className="ml-auto font-mono text-xs text-muted">{o.slug}</span>
              </label>
            ))}
            {orgs.data && orgs.data.items.length === 0 && <p className="px-3 py-2 text-sm text-muted">Sonuç yok.</p>}
          </div>
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
          <Button variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" loading={busy} disabled={!orgId}>
            Ekle
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [adminOnly, setAdminOnly] = useState<AdminFilter>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  // Dar ekranda ayrıntı tablonun altında açılır; görünür alana kaydırılır.
  useEffect(() => {
    if (selected) detailRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const term = useDebounced(q.trim());
  const params = { q: term, status: status === "all" ? undefined : status, admin: adminOnly === "true" ? true : undefined, page, page_size: PAGE_SIZE };
  const list = useAdmin(["users", params], () => api.adminUsers(params));

  const columns: Column<AdminUserRow>[] = [
    {
      key: "email",
      header: "Kullanıcı",
      render: (u) => (
        <button type="button" onClick={() => setSelected(u.id)} className="text-left min-w-0 cursor-pointer group" aria-label={`${u.email} ayrıntısı`}>
          <span className="block text-sm font-medium text-accent-ink group-hover:underline break-all">{u.email}</span>
          {u.full_name && <span className="block text-xs text-muted">{u.full_name}</span>}
        </button>
      ),
    },
    { key: "orgs", header: "Organizasyonlar", render: (u) => <MembershipBadges items={u.memberships} /> },
    {
      key: "status",
      header: "Durum",
      render: (u) => (
        <span className="flex flex-wrap gap-1">
          {u.is_active ? <Badge tone="evidence">Aktif</Badge> : <Badge tone="critical">Pasif</Badge>}
          {u.is_platform_admin && <Badge tone="accent">Yönetici</Badge>}
        </span>
      ),
    },
    { key: "created", header: "Kayıt", render: (u) => <span className="text-xs text-muted whitespace-nowrap">{formatDate(u.created_at)}</span> },
    { key: "login", header: "Son giriş", render: (u) => <span className="text-xs text-muted whitespace-nowrap">{formatRelative(u.last_login_at)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader icon={<Users className="w-5 h-5" />} title="Kullanıcılar" description="Kullanıcı silinmez; pasife alınan hesap giriş yapamaz ve açık oturumları reddedilir." />

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
        <Input
          icon={<Search className="w-4 h-4" />}
          placeholder="E-posta veya ad ara"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="w-full lg:w-80"
          aria-label="Kullanıcı ara"
        />
        <div className="flex flex-wrap gap-3">
          <FilterChips<StatusFilter>
            label="Durum"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Tümü" },
              { value: "active", label: "Aktif" },
              { value: "inactive", label: "Pasif" },
            ]}
          />
          <FilterChips<AdminFilter>
            label="Yöneticilik"
            value={adminOnly}
            onChange={(v) => {
              setAdminOnly(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Herkes" },
              { value: "true", label: "Yalnızca yöneticiler" },
            ]}
          />
        </div>
      </div>

      <div className={selected ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] items-start" : ""}>
        <Panel flush>
          <QueryState query={list}>
            {(data) => (
              <>
                <DataTable caption="Kullanıcılar" columns={columns} rows={data.items} rowKey={(u) => u.id} empty="Bu süzgece uyan kullanıcı yok." />
                <Pager page={data.page} pageSize={data.page_size} total={data.total} onChange={setPage} />
              </>
            )}
          </QueryState>
        </Panel>
        <div ref={detailRef}>{selected && <UserDetail key={selected} userId={selected} onClose={() => setSelected(null)} />}</div>
      </div>
    </div>
  );
}
