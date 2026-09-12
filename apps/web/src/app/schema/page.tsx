"use client";

import React from "react";
import { Code2 } from "lucide-react";
import { DEMO_SCHEMA, type SchemaRow } from "@/lib/demo";
import { useSiteData } from "@/hooks/useSiteData";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { DemoBanner } from "@/components/ui/DemoBanner";

const columns: Column<SchemaRow>[] = [
  { key: "type", header: "@type", render: (r) => <span className="font-mono font-semibold text-accent-ink">{r.type}</span> },
  { key: "page", header: "Uygulanan sayfa", render: (r) => <span className="font-mono text-xs text-muted">{r.page}</span> },
  { key: "rich", header: "Zengin sonuç", render: (r) => <span className="text-ink">{r.richResult}</span> },
  { key: "missing", header: "Eksik alan", expertOnly: true, render: (r) => <span className="font-mono text-xs text-muted">{r.missing}</span> },
  { key: "status", header: "Doğrulama", align: "center", render: (r) => <Badge tone={r.status === "Geçerli" ? "evidence" : r.status === "Uyarı" ? "warn" : "critical"}>{r.status}</Badge> },
];

export default function YapilandirilmisVeriPage() {
  // Arka uçta şema varlıklarını listeleyen uç yok; SchemaGenerator yalnızca öneri üretiyor.
  const res = useSiteData<SchemaRow[]>("schema", async () => DEMO_SCHEMA, DEMO_SCHEMA, { requires: "none" });

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={res.source} reason={res.reason} />
      <PageHeader icon={<Code2 className="w-5 h-5" />} title="Yapılandırılmış veri ve zengin sonuçlar" description="Sayfalardaki JSON-LD şema varlıkları, uygun zengin sonuç türü ve Google yönergelerine göre doğrulama durumu." />
      <Panel flush title="Aktif JSON-LD varlıkları" actions={<Badge tone="evidence">Sözdizimi hatası yok</Badge>}>
        <DataTable columns={columns} rows={res.data} rowKey={(r) => `${r.type}-${r.page}`} caption="Şema varlıkları tablosu" />
      </Panel>
    </div>
  );
}
