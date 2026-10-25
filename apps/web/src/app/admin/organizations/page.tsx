"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Plus, Search } from "lucide-react";
import { api, type AdminOrgRow } from "@/lib/api";
import { formatDate, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/States";
import { Pager, QueryState, SubscriptionBadge, UsageMeter, adminErrorText, useAdmin, useAdminRefresh, useDebounced } from "@/components/admin/AdminUi";

const PAGE_SIZE = 50;

function CreateOrgModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const refresh = useAdminRefresh();
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const org = await api.adminCreateOrganization({ name: name.trim(), owner_email: ownerEmail.trim() });
      await refresh();
      router.push(`/admin/organizations/${org.id}`);
    } catch (err) {
      setError(adminErrorText(err));
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Yeni organizasyon" icon={<Building2 className="w-4 h-4" />}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="org-name">Ad</Label>
          <Input id="org-name" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="org-owner" hint="kayıtlı bir kullanıcı olmalı">
            Sahip e-postası
          </Label>
          <Input id="org-owner" type="email" required value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} />
        </div>
        <p className="text-xs text-muted">Organizasyon Free planla açılır; slug addan üretilir.</p>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Vazgeç
          </Button>
          <Button type="submit" loading={busy} disabled={!name.trim() || !ownerEmail.trim()}>
            Oluştur
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminOrganizationsPage() {
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const term = useDebounced(q.trim());
  const plans = useAdmin(["plans"], () => api.adminPlans());
  const params = { q: term, plan, page, page_size: PAGE_SIZE };
  const list = useAdmin(["orgs", params], () => api.adminOrganizations(params));

  const columns: Column<AdminOrgRow>[] = [
    {
      key: "name",
      header: "Organizasyon",
      render: (o) => (
        <Link href={`/admin/organizations/${o.id}`} className="block min-w-0 group">
          <span className="block text-sm font-medium text-accent-ink group-hover:underline">{o.name}</span>
          <span className="block font-mono text-xs text-muted">{o.slug}</span>
        </Link>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      render: (o) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge mono>{o.plan_code ?? "—"}</Badge>
          <SubscriptionBadge status={o.subscription_status} />
        </span>
      ),
    },
    { key: "members", header: "Üye", align: "right", render: (o) => formatNumber(o.member_count) },
    { key: "sites", header: "Site", align: "right", render: (o) => formatNumber(o.site_count) },
    { key: "credits", header: "Bu ay AI kredisi", render: (o) => <UsageMeter cell={o.ai_credits} /> },
    { key: "created", header: "Oluşturulma", render: (o) => <span className="text-xs text-muted whitespace-nowrap">{formatDate(o.created_at)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Building2 className="w-5 h-5" />}
        title="Organizasyonlar"
        description="Plan, üye, site ve bu dönemin AI kredisi kullanımı."
        actions={
          <Button icon={<Plus className="w-4 h-4" aria-hidden />} onClick={() => setCreateOpen(true)}>
            Yeni organizasyon
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <Input
          icon={<Search className="w-4 h-4" />}
          placeholder="Ad veya slug ara"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-80"
          aria-label="Organizasyon ara"
        />
        <Select
          aria-label="Plana göre süz"
          value={plan}
          onChange={(e) => {
            setPlan(e.target.value);
            setPage(1);
          }}
          className="w-full sm:w-48"
        >
          <option value="">Tüm planlar</option>
          {(plans.data ?? []).map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <Panel flush>
        <QueryState query={list}>
          {(data) => (
            <>
              <DataTable caption="Organizasyonlar" columns={columns} rows={data.items} rowKey={(o) => o.id} empty="Bu süzgece uyan organizasyon yok." />
              <Pager page={data.page} pageSize={data.page_size} total={data.total} onChange={setPage} />
            </>
          )}
        </QueryState>
      </Panel>

      <CreateOrgModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
