"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Bot,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Zap,
  Send,
  FileCode2,
  Copy,
  Check,
  Globe,
  ShieldCheck,
  Activity,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useSite } from "@/context/SiteContext";
import { api } from "@/lib/api";
import {
  DEMO_GEO,
  type GeoPromptItem,
  type GeoData,
  type GeoCitedSource,
  type GeoQuickAction,
} from "@/lib/demo";
import type { DataSource, DemoReason } from "@/lib/dataSource";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";
import { PageTabs, tabPanelProps, type PageTab } from "@/components/ui/PageTabs";

type GeoTab = "ozet" | "sorular" | "kaynaklar" | "llms";

// Sayfa tek akışta 10 ekran boyuydu; bölümler sekmelere ayrıldı.
const GEO_TABS: PageTab<GeoTab>[] = [
  { key: "ozet", label: "Özet" },
  { key: "sorular", label: "Sorular" },
  { key: "kaynaklar", label: "Kaynaklar" },
  { key: "llms", label: "/llms.txt" },
];

function getStatusBadge(status: string) {
  switch (status) {
    case "DOMINANT":
      return <Badge tone="evidence" mono>BİRİNCİL KAYNAK</Badge>;
    case "VISIBLE":
      return <Badge tone="accent" mono>GÖRÜNÜR</Badge>;
    case "RARE":
      return <Badge tone="warn" mono>NADİREN ALINTILANAN</Badge>;
    default:
      return <Badge tone="neutral" mono>{status}</Badge>;
  }
}

function getSourceTypeBadge(sourceType: string) {
  switch (sourceType) {
    case "OWNED":
      return <Badge tone="evidence" mono>SİZİN SİTENİZ</Badge>;
    case "UGC_COMMUNITY":
      return <Badge tone="accent" mono>TOPLULUK</Badge>;
    case "EDITORIAL_AUTHORITY":
      return <Badge tone="neutral" mono>OTORİTE SİTE</Badge>;
    default:
      return <Badge tone="warn" mono>RAKİP KAYNAK</Badge>;
  }
}

export default function GeoPage() {
  const { org, site } = useSite();
  const [geoData, setGeoData] = useState<GeoData>(DEMO_GEO);
  const [geoSource, setGeoSource] = useState<{ source: DataSource; reason?: DemoReason }>({
    source: "demo",
    reason: "no-site",
  });
  const [customPrompt, setCustomPrompt] = useState("");
  const [sampleRuns, setSampleRuns] = useState<number>(3);
  const [enableWebGrounding, setEnableWebGrounding] = useState<boolean>(true);
  const [simulating, setSimulating] = useState(false);
  const [deployingAction, setDeployingAction] = useState<string | null>(null);
  const [activeLlmsTab, setActiveLlmsTab] = useState<"llms" | "llms_full">("llms");
  const [editableLlmsTxt, setEditableLlmsTxt] = useState<string>(
    DEMO_GEO.llmsTxtReadiness?.llms_txt_content || ""
  );
  const [editableLlmsFullTxt, setEditableLlmsFullTxt] = useState<string>(
    DEMO_GEO.llmsTxtReadiness?.llms_full_txt_content || ""
  );
  const [copied, setCopied] = useState(false);
  const [probingLive, setProbingLive] = useState(false);
  const [tab, setTab] = useState<GeoTab>("ozet");
  const [notice, setNotice] = useState<{
    tone: "success" | "warn" | "info" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let isCancelled = false;
    async function loadGeo() {
      if (!org?.id || !site?.id) {
        setGeoSource({ source: "demo", reason: org?.id ? "no-site" : "no-org" });
        return;
      }
      try {
        const liveData = await api.getGeoAnalytics(org.id, site.id, sampleRuns);
        if (isCancelled) return;
        if (!liveData || !liveData.overallVisibility) {
          setGeoSource({ source: "demo", reason: "fetch-failed" });
          return;
        }
        setGeoData(liveData);
        setGeoSource({ source: "live" });
        if (liveData.llmsTxtReadiness?.llms_txt_content) {
          setEditableLlmsTxt(liveData.llmsTxtReadiness.llms_txt_content);
        }
        if (liveData.llmsTxtReadiness?.llms_full_txt_content) {
          setEditableLlmsFullTxt(liveData.llmsTxtReadiness.llms_full_txt_content);
        }
      } catch {
        if (!isCancelled) setGeoSource({ source: "demo", reason: "fetch-failed" });
      }
    }
    loadGeo();
    return () => {
      isCancelled = true;
    };
  }, [org?.id, site?.id, sampleRuns]);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;

    setSimulating(true);
    setNotice(null);

    const queryText = customPrompt.trim();

    if (org?.id && site?.id) {
      try {
        const simRes = await api.simulateGeoQuery(
          org.id,
          site.id,
          queryText,
          site.name,
          sampleRuns,
          enableWebGrounding
        );
        const newItem: GeoPromptItem = {
          id: `gp-live-${Date.now()}`,
          prompt: simRes.prompt,
          frequency: `MONTE CARLO (${sampleRuns} TUR)`,
          brand_mentioned: simRes.brand_mentioned,
          citation_rank: simRes.citation_rank,
          platform_results: simRes.platform_results,
          top_competitor_cited: simRes.top_competitor_cited || "",
          cited_sources: simRes.cited_sources || [],
          monte_carlo: simRes.monte_carlo,
          recommended_fix: simRes.recommended_fix,
          is_simulated: simRes.is_simulated,
          data_source: simRes.data_source,
        };

        setGeoData((prev) => ({
          ...prev,
          prompts: [newItem, ...prev.prompts],
          citedSources:
            simRes.cited_sources && simRes.cited_sources.length > 0
              ? [...simRes.cited_sources, ...(prev.citedSources || [])].slice(0, 12)
              : prev.citedSources,
        }));

        const mcProb = simRes.monte_carlo
          ? ` (anılma olasılığı %${Math.round(simRes.monte_carlo.mention_probability * 100)}, tutarlılık %${simRes.monte_carlo.stability_score})`
          : "";

        const modePrefix = simRes.is_simulated ? "Simülasyon (canlı AI sorgusu yapılmadı) – " : "";
        setNotice({
          tone: simRes.brand_mentioned ? "success" : "warn",
          text: modePrefix + (simRes.brand_mentioned
            ? `Sorgu tamamlandı: markanız '${queryText}' sorusunda ${simRes.citation_rank}. sırada kaynak gösterildi${mcProb}.`
            : `Sorgu tamamlandı: markanız '${queryText}' sorusunda anılmadı${mcProb}. Sorular sekmesindeki "Doğrudan yanıt ekle" düğmesiyle sayfanız için yanıt bloğu hazırlayabilirsiniz.`),
        });
        setCustomPrompt("");
        setSimulating(false);
        return;
      } catch {
        // Fallback simulation below
      }
    }

    setNotice({
      tone: "error",
      text: org?.id && site?.id
        ? "Sorgu şu an çalıştırılamadı: arka uç servisine ulaşılamıyor. Biraz sonra tekrar deneyin."
        : "Sorgu için önce bir organizasyon ve site seçin.",
    });
    setSimulating(false);
  };

  const handleDeployGeoAction = async (params: {
    action_type: string;
    title: string;
    target_url?: string;
    prompt_context?: string;
    custom_content?: string;
  }) => {
    const key = `${params.action_type}:${params.prompt_context || params.title}`;
    setDeployingAction(key);
    setNotice(null);

    if (org?.id && site?.id) {
      try {
        const res = await api.deployGeoAction(org.id, site.id, {
          action_type: params.action_type,
          title: params.title,
          target_url: params.target_url,
          prompt_context: params.prompt_context,
          custom_content: params.custom_content,
          auto_execute: true,
        });

        setNotice({
          tone: res.success ? "success" : "warn",
          text: `${res.message}`,
        });
        setDeployingAction(null);
        return;
      } catch {
        // Aşağıdaki hata bildirimine düşer; yer tutucu içerik canlı siteye uygulanmaz
      }
    }

    setNotice({
      tone: "error",
      text: org?.id && site?.id
        ? `'${params.title}' işlemi oluşturulamadı: arka uç servisine ulaşılamıyor. Sitede hiçbir değişiklik yapılmadı.`
        : "İşlemi uygulamak için önce bir organizasyon ve site seçin.",
    });
    setDeployingAction(null);
  };

  const handleProbeLlmsLive = async () => {
    if (!org?.id || !site?.id) return;
    setProbingLive(true);
    try {
      const bundle = await api.getLlmsTxtBundle(org.id, site.id, true);
      if (bundle && bundle.llms_txt_content) {
        setGeoData((prev) => ({
          ...prev,
          llmsTxtReadiness: bundle,
        }));
        setEditableLlmsTxt(bundle.llms_txt_content);
        setEditableLlmsFullTxt(bundle.llms_full_txt_content || "");
        setNotice({
          tone: "info",
          text: `Canlı /llms.txt ve robots.txt kontrolü tamamlandı: hazırlık puanı ${bundle.readiness_score}/100.`,
        });
      }
    } catch {
      setNotice({
        tone: "error",
        text: "Canlı /llms.txt ve robots.txt kontrolü yapılamadı: arka uç servisine ulaşılamıyor.",
      });
    } finally {
      setProbingLive(false);
    }
  };

  const handleCopyLlms = () => {
    const content = activeLlmsTab === "llms" ? editableLlmsTxt : editableLlmsFullTxt;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const llmsReadiness = geoData.llmsTxtReadiness || DEMO_GEO.llmsTxtReadiness!;
  const citedSources: GeoCitedSource[] = geoData.citedSources || DEMO_GEO.citedSources || [];
  const mcSummary = geoData.monteCarloSummary || DEMO_GEO.monteCarloSummary;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14">
      {/* Header */}
      <PageHeader
        icon={<Sparkles className="w-5 h-5 text-accent" />}
        title="AI görünürlüğü"
        description="ChatGPT, Perplexity, Gemini gibi yapay zeka aramalarında markanızın anılıp anılmadığı, yanıtlarda hangi kaynakların gösterildiği ve sitenizin /llms.txt dosyası."
        actions={
          <div className="flex items-center gap-2">
            <Badge
              tone={geoData.data_source === "LIVE_GROUNDED" || geoData.data_source === "HYBRID_GROUNDED" ? "evidence" : "warn"}
              mono
            >
              {geoData.data_source === "LIVE_GROUNDED"
                ? "CANLI WEB VERİSİ"
                : geoData.data_source === "HYBRID_GROUNDED"
                ? "KISMEN CANLI VERİ"
                : "SİMÜLASYON"}
            </Badge>
            <Link href="/changes">
              <Button size="sm" variant="secondary" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                Değişiklikler
              </Button>
            </Link>
          </div>
        }
      />

      <DemoBanner source={geoSource.source} reason={geoSource.reason} />

      {/* Notice */}
      {notice && (
        <Notice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      <PageTabs tabs={GEO_TABS} value={tab} onChange={setTab} label="AI görünürlüğü bölümleri" idPrefix="geo" />

      {tab === "ozet" && (
        <div {...tabPanelProps("geo", "ozet")} className="space-y-6">
          {/* Metric Strip */}
          <MetricStrip
            items={[
              {
                label: "Toplam AI görünürlüğü",
                value: `%${geoData.overallVisibility}`,
                tone: "evidence",
                hint: "5 aracın ortalaması",
              },
              {
                label: "Yanıt tutarlılığı",
                value: `%${mcSummary?.avg_stability_score ?? 91}`,
                tone: "default",
                hint: mcSummary?.confidence_interval_95
                  ? `%95 güven aralığı: %${Math.round((mcSummary.confidence_interval_95[0] || 0) * 100)}–%${Math.round((mcSummary.confidence_interval_95[1] || 0) * 100)}`
                  : `${sampleRuns} deneme`,
              },
              {
                label: "/llms.txt hazırlık puanı",
                value: `${llmsReadiness.readiness_score}/100`,
                tone: llmsReadiness.has_live_llms_txt ? "evidence" : "warn",
                hint: `${llmsReadiness.pages_indexed_count} sayfa dosyaya eklendi`,
              },
              {
                label: "En çok anıldığınız araç",
                value: geoData.topEngine,
                hint: `AI aramalarının payı: %${geoData.aiSearchShare}`,
              },
            ]}
          />

          {/* Soru deneme formu */}
          <Panel className="border-accent/40 bg-accent-soft">
            <form onSubmit={handleSimulate} className="space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-accent" /> Bir soruyu yapay zeka aramalarında deneyin
                  </h4>
                  <p className="text-xs text-muted">
                    Yapay zeka yanıtları her seferinde biraz değişir. Soru <strong>{sampleRuns} kez</strong> sorulur; markanızın geçip
                    geçmediği ve yanıtta gösterilen kaynaklar çıkarılır.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-2xs font-mono text-muted flex items-center gap-1.5 bg-surface px-2.5 py-1 rounded-xs border border-line">
                    <Activity className="w-3.5 h-3.5 text-accent" />
                    <span>Tekrar:</span>
                    <select
                      value={sampleRuns}
                      onChange={(e) => setSampleRuns(Number(e.target.value))}
                      className="bg-transparent font-bold text-ink focus:outline-none"
                    >
                      <option value={1}>1 kez (hızlı)</option>
                      <option value={3}>3 kez</option>
                      <option value={5}>5 kez (daha kesin)</option>
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => setEnableWebGrounding((v) => !v)}
                    aria-pressed={enableWebGrounding}
                    className={`text-2xs font-mono px-2.5 py-1 rounded-xs border transition-colors flex items-center gap-1 ${
                      enableWebGrounding
                        ? "bg-evidence-soft text-evidence border-evidence/30"
                        : "bg-surface text-muted border-line"
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    Canlı web araması: {enableWebGrounding ? "açık" : "kapalı"}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    aria-label="Yapay zeka motorlarında denenecek soru"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Örn: Türkiye'de en iyi e-ticaret kargo entegrasyonu hangisi?"
                    className="w-full h-10 pl-9 pr-3 rounded-sm bg-surface border border-line text-xs text-ink placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <Button
                  type="submit"
                  variant="evidence"
                  loading={simulating}
                  icon={<Send className="w-3.5 h-3.5" />}
                >
                  Soruyu {sampleRuns} kez sor
                </Button>
              </div>
            </form>
          </Panel>

          {/* Platform Cards Grid */}
          <div>
            <h3 className="text-sm font-bold text-ink uppercase tracking-wider mb-3">
              Yapay zeka araçlarına göre görünürlük
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {geoData.platforms.map((p, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-surface rounded-sm border border-line space-y-3 hover:border-line-strong transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-sm text-ink">
                      <Bot className="w-4 h-4 text-accent" />
                      <span>{p.platform}</span>
                    </div>
                    <span className="text-2xs font-mono font-semibold text-evidence bg-evidence-soft px-1.5 py-0.5 rounded-xs">
                      {p.trend}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-2xl font-mono font-bold text-ink">%{p.score}</div>
                      <div className="text-xs text-muted">Görünürlük</div>
                    </div>
                    {typeof p.avg_confidence === "number" && (
                      <div className="text-right">
                        <div className="text-xs font-mono font-semibold text-accent-ink">
                          %{Math.round(p.avg_confidence * 100)}
                        </div>
                        <div className="text-xs text-muted">Anılma olasılığı</div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-line pt-2 flex items-center justify-between text-xs font-mono">
                    <div>
                      <span className="text-muted block text-xs">Bahsedilme</span>
                      <span className="font-semibold text-ink">{p.mentions}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted block text-xs">Kaynak gösterilme</span>
                      <span className="font-semibold text-accent-ink">{p.citations}</span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between gap-1">
                    {getStatusBadge(p.status)}
                    <span className="text-2xs font-mono text-muted">
                      {p.grounding_mode === "LIVE_GROUNDED" ? "CANLI" : "SİM"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Önerilen işler */}
          <Panel title="Önerilen işler">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {geoData.quickActions.map((act: GeoQuickAction, i: number) => {
                const actionType = act.action_type || "INJECT_GEO_SCHEMA";
                const key = `${actionType}:${act.title}`;
                return (
                  <div
                    key={i}
                    className="p-4 bg-surface-2 rounded-sm border border-line space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-2xs font-mono font-bold text-accent-ink uppercase">
                          {act.category}
                        </span>
                        <span className="text-xs font-mono font-bold text-evidence bg-evidence-soft px-1.5 py-0.5 rounded-xs">
                          {act.impact}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-ink">{act.title}</h4>
                      <p className="text-xs text-muted leading-relaxed">{act.description}</p>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line/60">
                      <Button
                        size="sm"
                        variant="evidence"
                        loading={deployingAction === key}
                        icon={<Zap className="w-3.5 h-3.5" />}
                        onClick={() =>
                          handleDeployGeoAction({
                            action_type: actionType,
                            title: act.title,
                            target_url: act.target_url,
                          })
                        }
                      >
                        Değişiklik seti oluştur
                      </Button>
                      <Link
                        href="/changes"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline"
                      >
                        Değişiklikleri Gör <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {tab === "sorular" && (
        <div {...tabPanelProps("geo", "sorular")}>
          {/* İzlenen sorular */}
          <Panel
            title="İzlenen sorular"
            sub="Yapay zeka araçlarına düzenli sorulan sorular: her araçta markanızın anılıp anılmadığı ve denemeler arasında ne kadar tutarlı kaldığı."
          >
            <div className="space-y-4">
              {geoData.prompts.map((p) => {
                const mc = p.monte_carlo;
                const actionKey = `INJECT_DIRECT_ANSWER:${p.prompt}`;
                return (
                  <div key={p.id} className="p-4 bg-surface-2 rounded-sm border border-line space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-line pb-2">
                      <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-accent shrink-0" />
                        <span className="font-bold text-sm text-ink">&ldquo;{p.prompt}&rdquo;</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="evidence" mono>Kaynak sırası: {p.citation_rank}</Badge>
                        {mc && (
                          <Badge tone="accent" mono>
                            Anılma olasılığı %{Math.round(mc.mention_probability * 100)} (%95 güven aralığı %
                            {Math.round((mc.confidence_interval_95?.[0] || 0) * 100)}–%
                            {Math.round((mc.confidence_interval_95?.[1] || 0) * 100)})
                          </Badge>
                        )}
                        <span className="text-xs text-muted font-mono">Sıklık: {p.frequency}</span>
                      </div>
                    </div>

                    {/* Snippets from each platform */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      {Object.entries(p.platform_results).map(([engine, res], i) => (
                        <div key={i} className="p-3 bg-surface rounded-xs border border-line space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-ink">{engine}</span>
                            {res.mentioned ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-evidence">
                                <CheckCircle2 className="w-3 h-3" /> Anıldı
                                {typeof res.mention_probability === "number" && (
                                  <span className="font-mono text-2xs">
                                    (%{Math.round(res.mention_probability * 100)})
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-critical">
                                <AlertCircle className="w-3 h-3" /> Anılmadı
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted italic line-clamp-3">&ldquo;{res.snippet}&rdquo;</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted pt-1 border-t border-line/50">
                      <span>
                        En çok kaynak gösterilen rakip:{" "}
                        <strong className="text-ink">{p.top_competitor_cited}</strong>
                        {mc && (
                          <span className="ml-2 font-mono">
                            • Tutarlılık <strong>%{mc.stability_score}</strong> ({mc.sample_runs} deneme)
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-3">
                        <Button
                          size="sm"
                          variant="evidence"
                          loading={deployingAction === actionKey}
                          icon={<Zap className="w-3 h-3" />}
                          onClick={() =>
                            handleDeployGeoAction({
                              action_type: "INJECT_DIRECT_ANSWER",
                              title: `'${p.prompt.slice(0, 45)}...' için doğrudan yanıt ve SSS şeması`,
                              prompt_context: p.prompt,
                            })
                          }
                        >
                          Doğrudan yanıt ekle
                        </Button>
                        <Link
                          href="/content"
                          className="text-accent-ink hover:underline font-semibold flex items-center gap-1"
                        >
                          İçeriği Düzenle <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      )}

      {tab === "kaynaklar" && (
        <div {...tabPanelProps("geo", "kaynaklar")}>
          {/* Gösterilen kaynaklar */}
          <Panel
            title="Yapay zeka yanıtlarında gösterilen kaynaklar"
            sub="Yapay zeka araçlarının yanıt verirken hangi sayfaları kaynak gösterdiği ve neden seçtiği."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {citedSources.map((src, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-surface-2 rounded-sm border border-line space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {getSourceTypeBadge(src.source_type)}
                        <span className="font-mono text-xs font-bold text-ink truncate">
                          {src.domain}
                        </span>
                      </div>
                      <span className="text-2xs font-mono font-bold text-accent-ink bg-accent-soft px-2 py-0.5 rounded-xs shrink-0">
                        {src.citation_count} kez gösterildi
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-ink line-clamp-1">{src.title}</div>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-2xs font-mono text-accent-ink hover:underline flex items-center gap-1 truncate"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{src.url}</span>
                    </a>
                    <p className="text-xs text-muted bg-surface p-2 rounded-xs border border-line/70">
                      <strong>Neden seçildi:</strong> {src.why_cited}
                    </p>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-1 border-t border-line/60">
                    <div className="flex flex-wrap gap-1">
                      {(src.platforms_citing || []).map((plat) => (
                        <span
                          key={plat}
                          className="text-2xs font-mono bg-surface px-1.5 py-0.5 rounded-xs border border-line text-muted"
                        >
                          {plat}
                        </span>
                      ))}
                    </div>
                    {src.source_type !== "OWNED" && (
                      <button
                        type="button"
                        onClick={() =>
                          handleDeployGeoAction({
                            action_type: "INJECT_DIRECT_ANSWER",
                            title: `${src.domain} yerine kaynak olmak için doğrudan yanıt ve SSS şeması`,
                            prompt_context: src.title,
                          })
                        }
                        className="text-xs font-semibold text-accent-ink hover:underline inline-flex items-center gap-1"
                      >
                        Bu kaynağın önüne geçmek için öneri hazırla <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {tab === "llms" && (
        <div {...tabPanelProps("geo", "llms")}>
          {/* /llms.txt düzenleyici ve bot erişimi */}
          <Panel
            title="/llms.txt dosyası ve yapay zeka botlarının erişimi"
            sub="Taranan sayfalarınızdan llmstxt.org biçiminde hazırlanan özet dosya. Git, Cloudflare veya CMS bağlantınız üzerinden yayınlanır."
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left column: Readiness score, AI Bots status, Audit checks */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-4 bg-surface-2 rounded-sm border border-line space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xs font-mono uppercase text-muted block">
                        Hazırlık puanı
                      </span>
                      <div className="text-2xl font-mono font-bold text-ink">
                        {llmsReadiness.readiness_score} / 100
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={probingLive}
                      icon={<RefreshCw className="w-3.5 h-3.5" />}
                      onClick={handleProbeLlmsLive}
                    >
                      Canlı siteyi kontrol et
                    </Button>
                  </div>

                  {/* AI Bot Badges */}
                  <div>
                    <div className="text-xs font-semibold text-muted mb-1.5">
                      robots.txt&apos;de yapay zeka botlarının erişimi
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(llmsReadiness.ai_bots_status || {}).map(([botName, st]) => (
                        <span
                          key={botName}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xs text-2xs font-mono border ${
                            st === "ALLOWED"
                              ? "bg-evidence-soft text-evidence border-evidence/30"
                              : "bg-critical-soft text-critical border-critical/30"
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {botName}: {st === "ALLOWED" ? "İZİNLİ" : "ENGELLİ"}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Audit Checks */}
                <div className="space-y-2">
                  {(llmsReadiness.audit_checks || []).map((chk) => (
                    <div
                      key={chk.check_id}
                      className="p-3 bg-surface-2 rounded-xs border border-line flex items-start gap-2.5"
                    >
                      {chk.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-evidence shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-ink">{chk.title}</div>
                        <p className="text-xs text-muted leading-relaxed">{chk.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right column: Interactive /llms.txt & /llms-full.txt Editor & One-Click Deploy */}
              <div className="lg:col-span-7 flex flex-col justify-between bg-surface-2 rounded-sm border border-line p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveLlmsTab("llms")}
                      aria-pressed={activeLlmsTab === "llms"}
                      className={`px-3 py-1 rounded-xs text-xs font-mono font-semibold transition-colors ${
                        activeLlmsTab === "llms"
                          ? "bg-accent-fill text-white"
                          : "bg-surface text-muted hover:text-ink border border-line"
                      }`}
                    >
                      /llms.txt (özet)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveLlmsTab("llms_full")}
                      aria-pressed={activeLlmsTab === "llms_full"}
                      className={`px-3 py-1 rounded-xs text-xs font-mono font-semibold transition-colors ${
                        activeLlmsTab === "llms_full"
                          ? "bg-accent-fill text-white"
                          : "bg-surface text-muted hover:text-ink border border-line"
                      }`}
                    >
                      /llms-full.txt (tam metin)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyLlms}
                    className="inline-flex items-center gap-1 text-2xs font-mono text-ink bg-surface px-2.5 py-1 rounded-xs border border-line hover:border-accent"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-evidence" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Kopyalandı" : "Kopyala"}
                  </button>
                </div>

                <textarea
                  aria-label={activeLlmsTab === "llms" ? "/llms.txt içeriği" : "/llms-full.txt içeriği"}
                  value={activeLlmsTab === "llms" ? editableLlmsTxt : editableLlmsFullTxt}
                  onChange={(e) =>
                    activeLlmsTab === "llms"
                      ? setEditableLlmsTxt(e.target.value)
                      : setEditableLlmsFullTxt(e.target.value)
                  }
                  rows={12}
                  className="w-full font-mono text-2xs bg-surface text-ink p-3 rounded-xs border border-line focus:outline-none focus:border-accent leading-relaxed"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-2xs text-muted font-mono">
                    Hedef: <strong>https://{site?.domain || llmsReadiness.site_domain}/{activeLlmsTab === "llms" ? "llms.txt" : "llms-full.txt"}</strong>
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={deployingAction?.startsWith("ALLOW_AI_BOTS_ROBOTS")}
                      icon={<ShieldCheck className="w-3.5 h-3.5" />}
                      onClick={() =>
                        handleDeployGeoAction({
                          action_type: "ALLOW_AI_BOTS_ROBOTS",
                          title: "robots.txt AI Arama Botları İzni ve llms.txt Bildirimi",
                        })
                      }
                    >
                      robots.txt&apos;ye bot izni ekle
                    </Button>
                    <Button
                      size="sm"
                      variant="evidence"
                      loading={
                        deployingAction?.startsWith("DEPLOY_LLMS_TXT") ||
                        deployingAction?.startsWith("DEPLOY_LLMS_FULL_TXT")
                      }
                      icon={<FileCode2 className="w-3.5 h-3.5" />}
                      onClick={() =>
                        handleDeployGeoAction({
                          action_type: activeLlmsTab === "llms" ? "DEPLOY_LLMS_TXT" : "DEPLOY_LLMS_FULL_TXT",
                          title:
                            activeLlmsTab === "llms"
                              ? "Kök Dizine /llms.txt Dosyasını Yayınla"
                              : "Kök Dizine /llms-full.txt Dosyasını Yayınla",
                          custom_content: activeLlmsTab === "llms" ? editableLlmsTxt : editableLlmsFullTxt,
                        })
                      }
                    >
                      {activeLlmsTab === "llms"
                        ? "/llms.txt dosyasını yayınla"
                        : "/llms-full.txt dosyasını yayınla"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
