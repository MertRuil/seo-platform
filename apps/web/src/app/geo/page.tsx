"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { DEMO_GEO, type GeoPlatformScore, type GeoPromptItem } from "@/lib/demo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

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
  const [geoData, setGeoData] = useState(DEMO_GEO);

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

              <div className="pt-2">
                <Link
                  href="/content"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline"
                >
                  Uygula & İncele <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
