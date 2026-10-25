"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { History, X } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Input, Label, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { AuditList, Pager, QueryState, dayAfter, useAdmin } from "@/components/admin/AdminUi";

const PAGE_SIZE = 50;
const ACTION_PREFIXES = [
  { value: "admin.", label: "Tüm yönetici işlemleri" },
  { value: "admin.user.", label: "Kullanıcı" },
  { value: "admin.org.", label: "Organizasyon oluşturma" },
  { value: "admin.member.", label: "Üyelik" },
  { value: "admin.plan.", label: "Plan değişikliği" },
  { value: "admin.credits.", label: "AI kredisi" },
];

function AuditView() {
  const router = useRouter();
  const search = useSearchParams();
  // Organizasyon ve kullanıcı süzgeci diğer ekranlardan gelen bağlantıyla (?org=, ?user=) kurulur.
  const org = search.get("org") ?? "";
  const user = search.get("user") ?? "";
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const params = { org, user, action, from, to: dayAfter(to), page, page_size: PAGE_SIZE };
  const list = useAdmin(["audit", params], () => api.adminAudit(params));

  const clear = (key: "org" | "user") => {
    const next = new URLSearchParams(search.toString());
    next.delete(key);
    const qs = next.toString();
    router.replace(qs ? `/admin/audit?${qs}` : "/admin/audit");
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <PageHeader icon={<History className="w-5 h-5" />} title="Denetim kaydı" description="Yalnızca okunur; kayıtlar silinemez. Satırı açınca önceki ve sonraki durum yan yana görünür." />

      <Panel>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="audit-action">İşlem türü</Label>
            <Select id="audit-action" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
              <option value="">Tümü</option>
              {ACTION_PREFIXES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="audit-from">Başlangıç</Label>
            <Input id="audit-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </div>
          <div>
            <Label htmlFor="audit-to">Bitiş</Label>
            <Input id="audit-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </div>
        </div>
        {(org || user) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {[
              { key: "org" as const, label: "Organizasyon", value: org },
              { key: "user" as const, label: "Kullanıcı", value: user },
            ]
              .filter((f) => f.value)
              .map((f) => (
                <Badge key={f.key} tone="accent">
                  {f.label}: <span className="font-mono">{f.value.slice(0, 8)}</span>
                  <button type="button" onClick={() => clear(f.key)} aria-label={`${f.label} süzgecini kaldır`} className="ml-1 cursor-pointer">
                    <X className="w-3 h-3" aria-hidden />
                  </button>
                </Badge>
              ))}
          </div>
        )}
      </Panel>

      <Panel flush>
        <QueryState query={list}>
          {(d) => (
            <>
              <AuditList rows={d.items} empty="Bu süzgece uyan kayıt yok." />
              <Pager page={d.page} pageSize={d.page_size} total={d.total} onChange={setPage} />
            </>
          )}
        </QueryState>
      </Panel>
    </div>
  );
}

export default function AdminAuditPage() {
  return (
    <Suspense>
      <AuditView />
    </Suspense>
  );
}
