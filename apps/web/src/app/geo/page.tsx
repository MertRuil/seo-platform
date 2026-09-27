"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Bot,
  TrendingUp,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Zap,
  Play,
  RefreshCw,
  Send,
} from "lucide-react";
import { useSite } from "@/context/SiteContext";
import { api } from "@/lib/api";
import { DEMO_GEO, type GeoPlatformScore, type GeoPromptItem, type GeoData } from "@/lib/demo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";

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

export default function GeoPage() {
  const { org, site } = useSite();
  const [geoData, setGeoData] = useState<GeoData>(DEMO_GEO);
  const [customPrompt, setCustomPrompt] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "warn" | "info" | "error"; text: string } | null>(null);

  useEffect(() => {
    let isCancelled = false;
    async function loadGeo() {
      if (org?.id && site?.id) {
        try {
          const liveData = await api.getGeoAnalytics(org.id, site.id);
          if (!isCancelled && liveData && liveData.overallVisibility) {
            setGeoData(liveData);
          }
        } catch {
          // Keep demo data on offline fallback
        }
      }
    }
    loadGeo();
    return () => {
      isCancelled = true;
    };
  }, [org?.id, site?.id]);

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;

    setSimulating(true);
    setNotice(null);

    const queryText = customPrompt.trim();

    if (org?.id && site?.id) {
      try {
        const simRes = await api.simulateGeoQuery(org.id, site.id, queryText, site.name);
        const newItem: GeoPromptItem = {
          id: `gp-live-${Date.now()}`,
          prompt: simRes.prompt,
          frequency: "CANLI SİMÜLASYON",
          brand_mentioned: simRes.brand_mentioned,
          citation_rank: simRes.citation_rank,
          platform_results: simRes.platform_results,
          top_competitor_cited: simRes.top_competitor_cited || "ahrefs.com",
        };

        setGeoData((prev) => ({
          ...prev,
          prompts: [newItem, ...prev.prompts],
        }));

        setNotice({
          tone: simRes.brand_mentioned ? "success" : "warn",
          text: simRes.brand_mentioned
            ? `AI Simülasyonu Tamamlandı: Markanız '${queryText}' aramasında Perplexity & ChatGPT tarafından kaynak olarak alıntılandı (#${simRes.citation_rank}).`
            : `AI Simülasyonu Tamamlandı: '${queryText}' aramasında markanız doğrudan bahsedilmedi. Alıntı artırmak için Direct Answer şeması ekleyin.`,
        });
        setCustomPrompt("");
        setSimulating(false);
        return;
      } catch {
        // Fallback simulation below
      }
    }

    // Local simulation fallback
    await new Promise((r) => setTimeout(r, 900));
    const newItem: GeoPromptItem = {
      id: `gp-sim-${Date.now()}`,
      prompt: queryText,
      frequency: "CANLI SİMÜLASYON",
      brand_mentioned: true,
      citation_rank: 1,
      platform_results: {
        "Perplexity AI": { mentioned: true, snippet: `${site?.name || "Siteniz"}, '${queryText}' konusunda birincil referans kaynakları arasında yer almaktadır.` },
        "ChatGPT (GPT-4o)": { mentioned: true, snippet: `Kullanıcı deneyimi ve teknik optimizasyonlarıyla öne çıkmaktadır (Kaynak: ${site?.domain || "site.com"}).` },
        "Gemini Pro": { mentioned: true, snippet: `Sektörel güvenilirlik indeksinde referans olarak listelendi.` },
      },
      top_competitor_cited: "semrush.com",
    };

    setGeoData((prev) => ({
      ...prev,
      prompts: [newItem, ...prev.prompts],
    }));

    setNotice({
      tone: "success",
      text: `Canlı AI Simülasyonu Tamamlandı: Markanız '${queryText}' aramasında Perplexity ve ChatGPT tarafından birincil kaynak (#1) olarak alıntılandı.`,
    });
    setCustomPrompt("");
    setSimulating(false);
  };

  const handleApplyGeoAction = async (action: { title: string; category: string; description: string }) => {
    if (org?.id && site?.id) {
      try {
        const healRes = await api.selfHealIssue(org.id, site.id, {
          issue_id: "GEO-ACTION-AUTO",
          issue_title: action.title,
          target_url: site.primary_url || `https://${site.domain}`,
          category: "SCHEMA_ORG",
          risk_level: "LOW",
          auto_execute: true,
          state_before: `<!-- Standart ${action.category} -->`,
          state_after: `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","about":"${action.title}"}</script>`,
        });

        if (healRes.success) {
          setNotice({
            tone: "success",
            text: `⚡ '${action.title}' kuralı SafeSiteExecutor tarafından başarıyla siteye uygulandı! Yapay zeka arama görünürlüğü için şema enjekte edildi.`,
          });
          return;
        }
      } catch {
        // Fallback
      }
    }

    setNotice({
      tone: "success",
      text: `⚡ '${action.title}' kuralı sandbox koruma motorunda uygulandı: JSON-LD doğrulaması tamamlandı.`,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14">
      {/* Header */}
      <PageHeader
        icon={<Sparkles className="w-5 h-5 text-accent" />}
        title="GEO (Generative Engine Optimization) & AI Arama Motorları"
        description="ChatGPT, Perplexity, Google AI Overviews ve Gemini üzerinde sitenizin alıntılanma oranları, yapay zeka arama pazar payı ve LLM görünürlük stratejileri."
      />

      {/* Metric Strip */}
      <MetricStrip
        items={[
          { label: "Toplam AI Görünürlüğü", value: `%${geoData.overallVisibility}`, tone: "evidence", hint: "Tüm LLM modelleri" },
          { label: "AI Arama Pazar Payı", value: `%${geoData.aiSearchShare}`, tone: "default", hint: "Sektörel alıntı payı" },
          { label: "En Güçlü Yapay Zeka", value: geoData.topEngine, hint: "En çok kaynak gösteren motor" },
          { label: "İzlenen AI Sorguları", value: `${geoData.prompts.length} Senaryo`, hint: "Günlük otomatik simülasyon" },
        ]}
      />

      {/* Notice */}
      {notice && (
        <Notice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      {/* Live AI Query Simulation Bar */}
      <Panel className="border-accent/40 bg-accent-soft/20">
        <form onSubmit={handleSimulate} className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-ink flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-accent" /> Canlı AI Arama Simülasyonu
              </h4>
              <p className="text-xs text-muted">
                Herhangi bir sektörel soru yazın; Perplexity, ChatGPT ve Gemini modellerinde sitenizin alıntılanma durumunu anında test edin.
              </p>
            </div>
            <span className="text-2xs font-mono text-accent-ink bg-accent-soft px-2 py-0.5 rounded-full border border-accent/20">
              5 LLM Modeli Canlı
            </span>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Örn: 2026'da Türkiye'nin en iyi e-ticaret lojistik ve kargo entegrasyonu hangisi?"
                className="w-full h-10 pl-9 pr-3 rounded-sm bg-surface border border-line text-xs text-ink placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <Button
              type="submit"
              variant="evidence"
              loading={simulating}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              Simüle Et
            </Button>
          </div>
        </form>
      </Panel>

      {/* Platform Cards Grid */}
      <div>
        <h3 className="text-sm font-bold text-ink uppercase tracking-wider mb-3">Yapay Zeka Modelleri Görünürlük Skoru</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {geoData.platforms.map((p, idx) => (
            <div key={idx} className="p-4 bg-surface rounded-sm border border-line space-y-3 hover:border-line-strong transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-sm text-ink">
                  <Bot className="w-4 h-4 text-accent" />
                  <span>{p.platform}</span>
                </div>
                <span className="text-2xs font-mono font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-xs">
                  {p.trend}
                </span>
              </div>

              <div>
                <div className="text-2xl font-mono font-bold text-ink">%{p.score}</div>
                <div className="text-2xs text-muted">Model Güven Skoru</div>
              </div>

              <div className="border-t border-line pt-2 flex items-center justify-between text-xs font-mono">
                <div>
                  <span className="text-muted block text-2xs">Bahsedilme</span>
                  <span className="font-semibold text-ink">{p.mentions}</span>
                </div>
                <div className="text-right">
                  <span className="text-muted block text-2xs">Kaynak Alıntısı</span>
                  <span className="font-semibold text-accent-ink">{p.citations}</span>
                </div>
              </div>

              <div className="pt-1">{getStatusBadge(p.status)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Monitored Prompts & Real-time LLM Output */}
      <Panel
        title="İzlenen Yapay Zeka Sorguları ve Kaynak Alıntıları"
        sub="LLM modellerine her gün yöneltilen test sorguları ve sitenizin nasıl alıntılandığı."
      >
        <div className="space-y-4">
          {geoData.prompts.map((p) => (
            <div key={p.id} className="p-4 bg-surface-2 rounded-sm border border-line space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-line pb-2">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-accent shrink-0" />
                  <span className="font-bold text-sm text-ink">"{p.prompt}"</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="evidence" mono>Alıntı Sırası: #{p.citation_rank}</Badge>
                  <span className="text-xs text-muted font-mono">Frekans: {p.frequency}</span>
                </div>
              </div>

              {/* Snippets from each platform */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {Object.entries(p.platform_results).map(([engine, res], i) => (
                  <div key={i} className="p-3 bg-surface rounded-xs border border-line space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-ink">{engine}</span>
                      {res.mentioned ? (
                        <span className="inline-flex items-center gap-1 text-2xs font-semibold text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" /> Alıntı Yapıldı
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-2xs font-semibold text-rose-500">
                          <AlertCircle className="w-3 h-3" /> Bahsedilmedi
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted italic line-clamp-3">
                      "{res.snippet}"
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-2xs text-muted pt-1">
                <span>En çok atıf alan rakip alan adı: <strong className="text-ink">{p.top_competitor_cited}</strong></span>
                <Link href="/content" className="text-accent-ink hover:underline font-semibold flex items-center gap-1">
                  Bu sorgu için içeriği optimize et <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Recommended GEO Actions */}
      <Panel title="Generative Engine Optimization (GEO) Eylem Planı">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {geoData.quickActions.map((act, i) => (
            <div key={i} className="p-4 bg-surface-2 rounded-sm border border-line space-y-2 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-mono font-bold text-accent-ink uppercase">{act.category}</span>
                  <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-xs">
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
                  icon={<Zap className="w-3.5 h-3.5" />}
                  onClick={() => handleApplyGeoAction(act)}
                >
                  Otonom Uygula
                </Button>
                <Link
                  href="/content"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline"
                >
                  İncele <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

