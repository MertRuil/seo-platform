"use client";

import React from "react";
import { FlaskConical } from "lucide-react";
import { DEMO_EXPERIMENTS, type ExperimentItem } from "@/lib/demo";
import { formatNumber } from "@/lib/format";
import { useSiteData } from "@/hooks/useSiteData";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, Inset } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { EmptyState } from "@/components/ui/States";

export default function SeoDeneyleriPage() {
  // Arka uçta deney listesi ucu yok (yalnızca POST /experiments değerlendirir).
  const res = useSiteData<ExperimentItem[]>("experiments", async () => DEMO_EXPERIMENTS, DEMO_EXPERIMENTS, { requires: "none" });

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={res.source} reason={res.reason} />
      <PageHeader
        icon={<FlaskConical className="w-5 h-5" />}
        title="SEO deneyleri ve nedensellik (Diff-in-Diff)"
        description="Varyant ve kontrol sayfa gruplarını karşılaştırarak mevsimsellik ve algoritma güncellemelerinden arındırılmış net etkiyi ölçer."
      />

      {res.data.length === 0 ? (
        <Panel>
          <EmptyState title="Henüz deney yok" description="Bir değişiklik setini uyguladığınızda 14 günlük ölçüm penceresiyle deney otomatik açılır." />
        </Panel>
      ) : (
        res.data.map((e) => (
          <Panel
            key={e.name}
            title={e.name}
            sub={`${e.days} günlük kohort · ${e.variantPages} varyant / ${e.controlPages} kontrol sayfası`}
            actions={<Badge tone={e.significant ? "evidence" : "warn"}>{e.significant ? "İstatistiksel olarak anlamlı" : "Henüz anlamlı değil"}</Badge>}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Inset>
                <div className="text-xs text-muted">Varyant büyümesi</div>
                <div className="text-2xl font-semibold text-evidence mt-1 tabular-nums">+%{formatNumber(e.variantPct, 1)}</div>
                <p className="text-2xs text-muted mt-1">Değişen sayfalar</p>
              </Inset>
              <Inset>
                <div className="text-xs text-muted">Kontrol büyümesi</div>
                <div className="text-2xl font-semibold text-ink mt-1 tabular-nums">+%{formatNumber(e.controlPct, 1)}</div>
                <p className="text-2xs text-muted mt-1">Değişmeyen sayfalar (genel pazar)</p>
              </Inset>
              <Inset className="border-accent bg-accent-soft">
                <div className="text-xs text-accent-ink">Net nedensel etki</div>
                <div className="text-2xl font-semibold text-accent-ink mt-1 tabular-nums">+%{formatNumber(e.liftPct, 1)}</div>
                <p className="text-2xs text-accent-ink mt-1">Algoritma dalgalanması hariç</p>
              </Inset>
            </div>
          </Panel>
        ))
      )}
    </div>
  );
}
