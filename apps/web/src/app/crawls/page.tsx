"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Play, Globe, ChevronRight, ShieldCheck, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import { api, ApiError } from "@/lib/api";
import { DEMO_CRAWLS, type CrawlRow } from "@/lib/demo";
import { crawlsToRows } from "@/lib/mappers";
import { addChangeSet, newChangeSetId } from "@/lib/changesets";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, Inset } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Badge, SeverityBadge } from "@/components/ui/Badge";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Notice } from "@/components/ui/States";

interface QuickIssue {
  rule_id: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string;
  category?: string;
}
interface QuickResult {
  health_score?: number;
  overall_score?: number;
  status_code?: number;
  page_info?: { response_time_ms?: number; word_count?: number; title?: string; meta_description?: string; canonical_url?: string };
  issues?: QuickIssue[];
  ai_recommendations?: Array<{ title: string; description: string; reason: string; expected_impact: string; priority_score: number }>;
}

const crawlColumns: Column<CrawlRow>[] = [
  { key: "id", header: "Tarama", render: (r) => <span className="font-mono font-semibold text-accent-ink">{r.id}</span> },
  { key: "mode", header: "Mod", render: (r) => <span className="text-ink">{r.mode}</span> },
  { key: "status", header: "Durum", align: "center", render: (r) => <Badge tone={r.status.startsWith("COMPLETED") ? "evidence" : r.status === "FAILED" ? "critical" : "accent"} mono>{r.status}</Badge> },
  { key: "pages", header: "Sayfa", align: "right", render: (r) => <span className="font-mono">{formatNumber(r.pages)}</span> },
  { key: "errors", header: "Hata", align: "right", render: (r) => <span className="font-mono text-muted">{r.errors}</span> },
  { key: "duration", header: "Süre", align: "right", expertOnly: true, render: (r) => <span className="font-mono text-muted">{r.duration}</span> },
  { key: "date", header: "Tarih", align: "right", render: (r) => <span className="text-muted">{r.date}</span> },
];

export default function SiteTaramalariPage() {
  const router = useRouter();
  const { token } = useAuth();
  const { org, site, sites, crawls, status, source, reason, refresh, selectSite } = useSite();

  // Site ekleme
  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [addingSite, setAddingSite] = useState(false);
  const [siteError, setSiteError] = useState<string | null>(null);

  // Tarama tetikleme
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);

  // Hızlı denetim
  const [quickUrl, setQuickUrl] = useState("https://example.com");
  const [quickBusy, setQuickBusy] = useState(false);
  const [quick, setQuick] = useState<QuickResult | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);

  const canRegister = status === "ready" && !!org;
  const rows = source === "demo" && crawls.length === 0 ? DEMO_CRAWLS : crawlsToRows(crawls);

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;
    setSiteError(null);
    if (!/^https?:\/\//.test(siteUrl.trim())) {
      setSiteError("Adres http:// veya https:// ile başlamalı.");
      return;
    }
    setAddingSite(true);
    try {
      const created = await api.createSite(org.id, { name: siteName.trim() || new URL(siteUrl.trim()).hostname, primary_url: siteUrl.trim() });
      await refresh();
      selectSite(created.id);
      setSiteName("");
      setSiteUrl("");
      setNotice({ tone: "success", text: `${created.normalized_domain} kaydedildi. Şimdi ilk taramayı başlatabilirsiniz.` });
    } catch (err) {
      setSiteError(err instanceof ApiError ? err.message : "Site kaydedilemedi.");
    } finally {
      setAddingSite(false);
    }
  };

  const handleStartCrawl = async () => {
    if (!org || !site) return;
    setStarting(true);
    setNotice(null);
    try {
      const run = await api.triggerCrawl(org.id, site.id);
      setNotice({ tone: "info", text: `Tarama #${run.id.slice(0, 8).toUpperCase()} kuyruğa alındı. Tamamlanınca AI denetimi otomatik başlar; bu sayfayı yenileyerek durumu görebilirsiniz.` });
      await refresh();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Tarama başlatılamadı." });
    } finally {
      setStarting(false);
    }
  };

  const handleQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickUrl.trim();
    if (!/^https?:\/\//.test(trimmed)) {
      setQuickError("Adres http:// veya https:// ile başlamalı.");
      return;
    }
    setQuickBusy(true);
    setQuickError(null);
    setQuick(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/v1/audit/quick", { method: "POST", headers, body: JSON.stringify({ url: trimmed, max_pages: 10 }) });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Siteye erişilemedi veya analiz hatası oluştu.");
      }
      setQuick(await res.json());
    } catch (err) {
      setQuickError(err instanceof Error ? err.message : "Bilinmeyen bir hata oluştu.");
    } finally {
      setQuickBusy(false);
    }
  };

  const handleIssueSet = (iss: QuickIssue) => {
    const id = newChangeSetId("CS-LIVE");
    addChangeSet({
      id,
      baslik: `Canlı denetim düzeltmesi: ${iss.title}`,
      onem: iss.severity || "MEDIUM",
      etkilenenSayfa: quickUrl,
      kategori: iss.category || "TEKNİK",
      oneri: iss.recommendation,
      durum: "BEKLİYOR",
      oncekiKod: `<!-- ${quickUrl} üzerinde tespit: ${iss.rule_id} -->\n${iss.description}`,
      yeniKod: `<!-- Önerilen çözüm -->\n${iss.recommendation}`,
      olusturulmaTarihi: new Date().toLocaleTimeString("tr-TR"),
    });
    setNotice({ tone: "success", text: `"${iss.title}" için düzeltme seti #${id} oluşturuldu; diff sayfasına yönlendiriliyorsunuz.` });
    setTimeout(() => router.push("/changes"), 800);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={source} reason={reason} />
      <PageHeader
        icon={<Layers className="w-5 h-5" />}
        title="Site taramaları"
        description="Kayıtlı siteyi tarayın; tarama bitince kural motoru ve AI denetimi otomatik çalışır. Kayıtsız hızlı denetim için alttaki formu kullanın."
        actions={
          site ? (
            <Button onClick={handleStartCrawl} loading={starting} icon={<Play className="w-3.5 h-3.5" />}>
              Taramayı başlat
            </Button>
          ) : undefined
        }
      />

      {notice && (
        <Notice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      {/* Onboarding: site yoksa kayıt formu */}
      {canRegister && sites.length === 0 && (
        <Panel title="İlk siteyi ekleyin" sub="Alan adı kaydedilir; ardından ilk tarama başlatılır ve tüm ekranlar canlı veriye geçer.">
          <form onSubmit={handleAddSite} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div>
              <Label htmlFor="site-name">Site adı</Label>
              <Input id="site-name" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="Acme Türkiye" />
            </div>
            <div>
              <Label htmlFor="site-url">Ana adres</Label>
              <Input id="site-url" type="url" value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://acme.com.tr" mono required />
            </div>
            <Button type="submit" loading={addingSite} icon={<Plus className="w-3.5 h-3.5" />}>
              Kaydet
            </Button>
          </form>
          {siteError && (
            <Notice tone="error" className="mt-3">
              {siteError}
            </Notice>
          )}
        </Panel>
      )}

      {!canRegister && status === "ready" && (
        <Notice tone="info">Site kaydı için arka uçta tanımlı bir hesapla giriş yapın; bu oturum yalnızca yerel demo hesabı kullanıyor.</Notice>
      )}

      {/* Hızlı denetim */}
      <Panel title="Hızlı denetim" sub="Herhangi bir adresi kayıt gerektirmeden tarar, kuralları çalıştırır ve AI önerilerini çıkarır.">
        <form onSubmit={handleQuick} className="flex flex-col sm:flex-row gap-2">
          <Input icon={<Globe className="w-4 h-4" />} type="url" required value={quickUrl} onChange={(e) => setQuickUrl(e.target.value)} placeholder="https://siteniz.com" mono aria-label="Denetlenecek adres" />
          <Button type="submit" loading={quickBusy} icon={<Play className="w-3.5 h-3.5" />} className="shrink-0">
            Denetle
          </Button>
        </form>
        {quickError && (
          <Notice tone="error" className="mt-3">
            {quickError}
          </Notice>
        )}
      </Panel>

      {quick && (
        <div className="space-y-5 animate-fade-in">
          <MetricStrip
            items={[
              { label: "Teknik sağlık skoru", value: quick.health_score ?? quick.overall_score ?? "—", unit: "/ 100", tone: "evidence", hint: "kural motoru" },
              { label: "HTTP yanıt kodu", value: quick.status_code ?? "—", hint: quick.page_info?.response_time_ms ? `${quick.page_info.response_time_ms} ms` : undefined },
              { label: "Gövde kelime sayısı", value: formatNumber(quick.page_info?.word_count ?? 0), hint: "içerik derinliği" },
              { label: "Bulunan sorun", value: quick.issues?.length ?? 0, tone: (quick.issues?.length ?? 0) > 0 ? "warn" : "evidence", hint: "aksiyon gerektiren" },
            ]}
          />

          <Panel title="Sayfa meta verileri">
            <dl className="grid grid-cols-1 gap-2 font-mono text-xs">
              {[
                ["<title>", quick.page_info?.title || "(eksik)"],
                ["Meta açıklaması", quick.page_info?.meta_description || "(eksik)"],
                ["Canonical", quick.page_info?.canonical_url || "(belirtilmemiş)"],
              ].map(([k, v]) => (
                <Inset key={k} className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <dt className="text-muted shrink-0">{k}</dt>
                  <dd className="text-ink sm:text-right break-all">{v}</dd>
                </Inset>
              ))}
            </dl>
          </Panel>

          <Panel flush title="Kural ihlalleri ve çözümleri">
            {(quick.issues ?? []).length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">Kural ihlali bulunmadı.</p>
            ) : (
              <ul className="divide-y divide-line">
                {quick.issues!.map((iss, idx) => (
                  <li key={idx} className="px-5 py-4 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={iss.severity} />
                      <span className="text-sm font-semibold text-ink">{iss.title}</span>
                      <span className="font-mono text-2xs text-muted">{iss.rule_id}</span>
                    </div>
                    <p className="text-sm text-muted">{iss.description}</p>
                    <p className="text-sm text-evidence">Öneri: {iss.recommendation}</p>
                    <div className="pt-1 flex justify-end">
                      <Button size="sm" variant="secondary" onClick={() => handleIssueSet(iss)} icon={<ChevronRight className="w-3.5 h-3.5 text-accent" />}>
                        Düzeltme seti oluştur
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {(quick.ai_recommendations ?? []).length > 0 && (
            <Panel title={<span className="inline-flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-accent" aria-hidden />AI uzman ajan önerileri</span>} sub="Google Search Central belgelerine dayalı">
              <ul className="space-y-3">
                {quick.ai_recommendations!.map((rec, idx) => (
                  <li key={idx}>
                    <Inset className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-accent-ink">{rec.title}</span>
                        <Badge tone="evidence" mono>
                          Öncelik {rec.priority_score}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted">{rec.description}</p>
                      <p className="text-xs text-muted">Gerekçe: {rec.reason}</p>
                      <div className="pt-2 border-t border-line text-xs text-muted">
                        Beklenen etki: <span className="text-ink font-medium">{rec.expected_impact}</span>
                      </div>
                    </Inset>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}

      <Panel flush title="Tarama geçmişi" sub={site ? site.normalized_domain : "Örnek kayıtlar"}>
        <DataTable columns={crawlColumns} rows={rows} rowKey={(r) => r.id} caption="Geçmiş taramalar" empty="Henüz tarama yok. Yukarıdan ilk taramayı başlatın." />
      </Panel>
    </div>
  );
}
