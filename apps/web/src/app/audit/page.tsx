"use client";

import React, { useState } from "react";
import { History, UserCheck, Lock, Search, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSiteData } from "@/hooks/useSiteData";
import { DEMO_AUDIT, type AuditRow } from "@/lib/demo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Input, FilterChips } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { EmptyState } from "@/components/ui/States";

type Cat = "ALL" | "DEĞİŞİKLİK" | "TARAMA" | "OTURUM";

export default function DenetimGunluguPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);
  // Arka uçta denetim günlüğü okuma ucu yok (AuditLog tablosuna yalnızca yazılıyor).
  const res = useSiteData<AuditRow[]>("audit", async () => DEMO_AUDIT, DEMO_AUDIT, { requires: "none" });

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Cat>("ALL");
  const needle = q.toLowerCase();
  const rows = res.data.filter((k) => {
    const hit = [k.action, k.target, k.user, k.detail].some((s) => s.toLowerCase().includes(needle));
    return cat === "ALL" ? hit : hit && k.action.includes(cat);
  });

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={res.source} reason={res.reason} />
      <PageHeader
        icon={<History className="w-5 h-5" />}
        title="Denetim günlüğü"
        description="Kullanıcı eylemleri, otonom uygulamalar ve site yazma işlemlerinin işlem defteri."
        actions={
          isAdmin ? (
            <Badge tone="accent">
              <Shield className="w-3 h-3" aria-hidden /> Yönetici görünümü
            </Badge>
          ) : (
            <Badge tone="neutral">
              <Lock className="w-3 h-3" aria-hidden /> IP adresleri gizli
            </Badge>
          )
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <Input icon={<Search className="w-4 h-4" />} placeholder="İşlem, hedef veya kullanıcı ara" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-80" aria-label="Günlükte ara" />
        <FilterChips<Cat>
          label="Kategori"
          value={cat}
          onChange={setCat}
          options={[
            { value: "ALL", label: "Tümü" },
            { value: "DEĞİŞİKLİK", label: "Değişiklik" },
            { value: "TARAMA", label: "Tarama" },
            { value: "OTURUM", label: "Oturum" },
          ]}
        />
      </div>

      <Panel flush title="Son işlemler" actions={<span className="font-mono text-xs text-muted">{rows.length} kayıt</span>}>
        {rows.length === 0 ? (
          <EmptyState title="Kayıt bulunamadı" description="Arama kriterlerine uyan denetim kaydı yok." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((k, idx) => (
              <li key={idx} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-surface-2 transition-colors text-sm">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-accent-ink">{k.time}</span>
                    <span className="font-semibold text-ink">{k.action}</span>
                    <span className="text-muted truncate">({k.target})</span>
                  </div>
                  <p className="text-muted">{k.detail}</p>
                  {isAdmin && <span className="font-mono text-2xs text-muted">Kaynak IP: {k.ip}</span>}
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs text-muted shrink-0">
                  <UserCheck className="w-3.5 h-3.5 text-evidence" aria-hidden />
                  {k.user}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
