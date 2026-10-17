"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { api, type ExperimentEvaluationResponse } from "@/lib/api";
import { useSite } from "@/context/SiteContext";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Notice, EmptyState } from "@/components/ui/States";

export default function SeoDeneyleriPage() {
  const { org, site } = useSite();
  const [name,setName] = useState("");
  const [variant,setVariant] = useState("");
  const [control,setControl] = useState("");
  const [date,setDate] = useState("");
  const [days,setDays] = useState(14);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [result,setResult] = useState<{siteId:string;data:ExperimentEvaluationResponse}|null>(null);
  const evaluate = async (event:React.FormEvent) => {
    event.preventDefault();
    if (!org || !site) return;
    setBusy(true);setError(null);setResult(null);
    try {
      const pages=(text:string)=>text.split(/\s+/).map((url)=>url.trim()).filter(Boolean);
      const data=await api.evaluateExperiment(org.id,site.id,{name,variant_pages:pages(variant),control_pages:pages(control),change_date:date,window_days:days});
      setResult({siteId:site.id,data});
    } catch (e) { setError(e instanceof Error ? e.message : "Karşılaştırma hesaplanamadı"); }
    finally {setBusy(false);}
  };
  const current=result?.siteId===site?.id ? result?.data : null;
  return <div className="space-y-5 max-w-5xl mx-auto pb-12">
    <PageHeader icon={<FlaskConical className="w-5 h-5"/>} title="SEO deney karşılaştırması" description="Search Console tıklamalarıyla değişen sayfaları kontrol grubuyla karşılaştırın. Sabit veya örnek sonuç üretilmez."/>
    <Notice tone="info">Önce ve sonra pencerelerinde her iki grup için veri gerekir. Sonuç sayfa başına normalize edilir; istatistiksel anlamlılık ve nedensellik kanıtı değildir.</Notice>
    {!site || !org ? <Panel><EmptyState title="Önce bir site seçin" description="Karşılaştırma için Search Console bağlantısını kurup verileri eşitleyin."/></Panel> : <Panel title="Karşılaştırmayı tanımla">
      <form onSubmit={evaluate} className="space-y-4">
        <div><Label htmlFor="experiment-name">Karşılaştırma adı</Label><Input id="experiment-name" required value={name} onChange={(e)=>setName(e.target.value)}/></div>
        <div className="grid md:grid-cols-2 gap-4">
          <div><Label htmlFor="experiment-date">Değişiklik tarihi</Label><Input id="experiment-date" type="date" required value={date} onChange={(e)=>setDate(e.target.value)}/></div>
          <div><Label htmlFor="experiment-days">Önce ve sonra pencere uzunluğu (gün)</Label><Input id="experiment-days" type="number" min={7} max={90} required value={days} onChange={(e)=>setDays(Number(e.target.value))}/></div>
          <div><Label htmlFor="variant-pages">Değişen sayfalar (her satıra bir tam URL)</Label><Textarea id="variant-pages" required rows={5} value={variant} onChange={(e)=>setVariant(e.target.value)}/></div>
          <div><Label htmlFor="control-pages">Kontrol sayfaları (her satıra bir tam URL)</Label><Textarea id="control-pages" required rows={5} value={control} onChange={(e)=>setControl(e.target.value)}/></div>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" loading={busy}>Gerçek verilerle karşılaştır</Button>
      </form>
    </Panel>}
    {current && <Panel title={current.experiment_name} sub={current.conclusion}>
      <dl className="grid sm:grid-cols-3 gap-5 text-sm">
        <div><dt className="text-muted">Varyant büyümesi</dt><dd className="text-2xl mt-1">%{formatNumber(current.variant_growth_percent,1)}</dd></div>
        <div><dt className="text-muted">Kontrol büyümesi</dt><dd className="text-2xl mt-1">%{formatNumber(current.control_growth_percent,1)}</dd></div>
        <div><dt className="text-muted">Büyüme farkı (yüzde puan)</dt><dd className="text-2xl mt-1">{formatNumber(current.variant_relative_lift_percent,1)}</dd></div>
      </dl>
    </Panel>}
  </div>;
}
