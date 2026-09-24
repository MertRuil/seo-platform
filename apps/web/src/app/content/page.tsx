"use client";

import React, { useState } from "react";
import {
  PenTool,
  Sparkles,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  TrendingUp,
  BarChart2,
  Hash,
  Layers,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { DEMO_CONTENT, type ContentOptimizationData } from "@/lib/demo";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

export default function ContentOptimizerPage() {
  const [data, setData] = useState<ContentOptimizationData>(DEMO_CONTENT);
  const [targetUrl, setTargetUrl] = useState(DEMO_CONTENT.url);
  const [targetKeyword, setTargetKeyword] = useState(DEMO_CONTENT.targetKeyword);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // AI Content Generator state
  const [genType, setGenType] = useState<"META_TITLE" | "META_DESCRIPTION" | "FAQ" | "OUTLINE">("META_TITLE");
  const [genTopic, setGenTopic] = useState("Otonom SEO ve CDN Optimizasyonu");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState<{ title: string; content: string; tokens: number } | null>({
    title: "Optimize Meta Başlık Önerisi",
    content: "Otonom SEO Platformu ve CDN Optimizasyonu | 2026 Calpeo Rehberi",
    tokens: 120,
  });
  const [copied, setCopied] = useState(false);

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUrl.trim() || !targetKeyword.trim()) return;

    setIsAnalyzing(true);
    setTimeout(() => {
      setData({
        ...data,
        url: targetUrl,
        targetKeyword: targetKeyword,
        contentScore: Math.floor(Math.random() * 15) + 80,
        geoScore: Math.floor(Math.random() * 15) + 82,
        readabilityScore: 84,
        wordCount: Math.floor(Math.random() * 500) + 1400,
      });
      setIsAnalyzing(false);
    }, 700);
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      if (genType === "META_TITLE") {
        setGeneratedOutput({
          title: "Optimize Meta Başlık",
          content: `${genTopic} - Kapsamlı Stratejiler ve ${targetKeyword} 2026`,
          tokens: 95,
        });
      } else if (genType === "META_DESCRIPTION") {
        setGeneratedOutput({
          title: "Optimize Meta Açıklama",
          content: `${genTopic} hakkında aradığınız tüm teknik detaylar ve ${targetKeyword} rehberi. Sitenizin görünürlüğünü anında artırın!`,
          tokens: 165,
        });
      } else if (genType === "FAQ") {
        setGeneratedOutput({
          title: "FAQ Schema.org JSON-LD Bloğu",
          content: `{\n  "@context": "https://schema.org",\n  "@type": "FAQPage",\n  "mainEntity": [{\n    "@type": "Question",\n    "name": "${genTopic} nedir ve nasıl çalışır?",\n    "acceptedAnswer": {\n      "@type": "Answer",\n      "text": "${genTopic}, sitelerin arama motoru ve yapay zeka indeksleme kalitesini otomatik olarak yükselten otonom bir sistemdir."\n    }\n  }]\n}`,
          tokens: 280,
        });
      } else {
        setGeneratedOutput({
          title: "Kapsamlı İçerik Taslağı",
          content: `## H1: ${genTopic}: 2026 Stratejik Kılavuzu\n\n### H2: 1. Giriş ve ${targetKeyword} Temelleri\n- Modern arama motoru beklentileri\n- Doğrudan yanıt formatının önemi\n\n### H2: 2. Teknik Uygulama & Schema Standartları\n- JSON-LD yapılandırılmış veri entegrasyonu\n- Self-referential canonical yapılandırması\n\n### H2: 3. Sık Yapılan Hatalar ve Kontrol Listesi\n- Aşırı anahtar kelime doldurmadan kaçınma\n- Sayfa açılış hızı (INP & LCP) sinyalleri`,
          tokens: 420,
        });
      }
      setIsGenerating(false);
    }, 600);
  };

  const handleCopy = () => {
    if (!generatedOutput) return;
    navigator.clipboard.writeText(generatedOutput.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14">
      {/* Header */}
      <PageHeader
        icon={<PenTool className="w-5 h-5 text-accent" />}
        title="İçerik Optimizasyonu & NLP Skorlama"
        description="Surfer SEO ve Clearscope kalitesinde gerçek zamanlı içerik skoru, Google Helpful Content semantik varlıkları (Entities) ve yapay zeka içerik asistanı."
      />

      {/* URL & Keyword Analysis Input */}
      <Panel title="İçerik ve Hedef Anahtar Kelime Denetimi">
        <form onSubmit={handleAnalyze} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-6">
            <Label htmlFor="audit-url">İncelenecek Sayfa URL'i</Label>
            <Input
              id="audit-url"
              placeholder="https://flagship-store.com/blog/otonom-seo"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              required
            />
          </div>

          <div className="md:col-span-4">
            <Label htmlFor="audit-kw">Hedef Anahtar Kelime</Label>
            <Input
              id="audit-kw"
              placeholder="ör. otonom seo yazılımı"
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              required
            />
          </div>

          <div className="md:col-span-2">
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              loading={isAnalyzing}
              icon={<Sparkles className="w-4 h-4" />}
            >
              NLP Analiz Et
            </Button>
          </div>
        </form>
      </Panel>

      {/* Metric Strip */}
      <MetricStrip
        items={[
          {
            label: "İçerik Kalite Skoru",
            value: `${data.contentScore} / 100`,
            tone: data.contentScore >= 80 ? "evidence" : "warn",
            hint: "Surfer SEO NLP standardı",
          },
          {
            label: "GEO (AI Arama) Skoru",
            value: `${data.geoScore} / 100`,
            tone: "default",
            hint: "ChatGPT ve Perplexity alıntı uyumu",
          },
          {
            label: "Kelime Sayısı",
            value: `${formatNumber(data.wordCount)} / ${formatNumber(data.targetWordCount)}`,
            hint: "Önerilen uzunluk",
          },
          {
            label: "Okunabilirlik İndeksi",
            value: `${data.readabilityScore} / 100`,
            hint: "Kullanıcı deneyimi",
          },
          {
            label: "Anahtar Kelime Yoğunluğu",
            value: `%${data.keywordDensity}`,
            hint: "Doğal oran (1.5 - 2.5%)",
          },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Missing Entities & Headings */}
        <div className="lg:col-span-7 space-y-6">
          {/* Semantic Entities Table */}
          <Panel title="Google Bilgi Grafı & Semantik Varlıklar (Entities)" sub="Rakiplerinizin kullandığı ve Google'ın içeriğinizde aradığı kavramlar">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2 border-b border-line text-xs font-semibold text-muted uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Semantik Kavram</th>
                    <th className="py-2.5 px-3 text-center">Mevcut Kullanım</th>
                    <th className="py-2.5 px-3 text-center">Önerilen Hedef</th>
                    <th className="py-2.5 px-3 text-right">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.missingEntities.map((ent, idx) => (
                    <tr key={idx} className="hover:bg-surface-2 transition-colors">
                      <td className="py-3 px-3 font-semibold text-ink">{ent.name}</td>
                      <td className="py-3 px-3 text-center font-mono">{ent.current} kez</td>
                      <td className="py-3 px-3 text-center font-mono text-muted">{ent.recommended}</td>
                      <td className="py-3 px-3 text-right">
                        <Badge
                          tone={
                            ent.status === "Optimal"
                              ? "evidence"
                              : ent.status === "Yetersiz"
                              ? "warn"
                              : "critical"
                          }
                          mono
                        >
                          {ent.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Missing Headings & Structure */}
          <Panel title="Eksik Başlıklar & İçerik Hiyerarşisi (H2 / H3)">
            <div className="space-y-2.5">
              {data.missingHeadings.map((hd, i) => (
                <div key={i} className="p-3 bg-surface-2 rounded-sm border border-line flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono font-medium text-ink">
                    <Hash className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span>{hd}</span>
                  </div>
                  <Badge tone="accent">Ekle</Badge>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-line">
              <h4 className="text-xs font-bold text-ink uppercase tracking-wider mb-2">AI İyileştirme Önerileri</h4>
              <ul className="space-y-1.5 text-xs text-muted">
                {data.aiSuggestions.map((sug, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                    <span>{sug}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </div>

        {/* Right Column: AI Content Generator Tool */}
        <div className="lg:col-span-5">
          <Panel title="AI SEO İçerik & Kod Üretici" sub="Başlık, meta açıklama, FAQ schema veya taslak üretin">
            <div className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-1.5 bg-surface-2 p-1 rounded-sm border border-line">
                <button
                  type="button"
                  onClick={() => setGenType("META_TITLE")}
                  className={`text-xs py-1.5 font-semibold rounded-xs transition-colors ${
                    genType === "META_TITLE" ? "bg-accent-fill text-white" : "text-muted hover:text-ink"
                  }`}
                >
                  Meta Başlık
                </button>
                <button
                  type="button"
                  onClick={() => setGenType("META_DESCRIPTION")}
                  className={`text-xs py-1.5 font-semibold rounded-xs transition-colors ${
                    genType === "META_DESCRIPTION" ? "bg-accent-fill text-white" : "text-muted hover:text-ink"
                  }`}
                >
                  Meta Açıklama
                </button>
                <button
                  type="button"
                  onClick={() => setGenType("FAQ")}
                  className={`text-xs py-1.5 font-semibold rounded-xs transition-colors ${
                    genType === "FAQ" ? "bg-accent-fill text-white" : "text-muted hover:text-ink"
                  }`}
                >
                  FAQ Schema (JSON-LD)
                </button>
                <button
                  type="button"
                  onClick={() => setGenType("OUTLINE")}
                  className={`text-xs py-1.5 font-semibold rounded-xs transition-colors ${
                    genType === "OUTLINE" ? "bg-accent-fill text-white" : "text-muted hover:text-ink"
                  }`}
                >
                  İçerik Taslağı
                </button>
              </div>

              {/* Topic Input */}
              <div>
                <Label htmlFor="gen-topic">Konu / Sayfa Başlığı</Label>
                <Input
                  id="gen-topic"
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  placeholder="Sayfa konusu veya ürün adı"
                />
              </div>

              <Button
                variant="primary"
                className="w-full"
                loading={isGenerating}
                onClick={handleGenerate}
                icon={<Sparkles className="w-4 h-4" />}
              >
                Yapay Zeka ile Oluştur
              </Button>

              {/* Result Area */}
              {generatedOutput && (
                <div className="mt-4 p-3 bg-surface-2 rounded-sm border border-line space-y-2">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="text-xs font-bold text-ink">{generatedOutput.title}</span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline font-semibold"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-evidence" /> Kopyalandı!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Kopyala
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="font-mono text-xs text-ink whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto custom-scrollbar bg-surface p-2.5 rounded-xs border border-line">
                    {generatedOutput.content}
                  </pre>
                  <div className="text-right text-2xs text-faint font-mono">
                    Token harcaması: {generatedOutput.tokens} tokens
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
