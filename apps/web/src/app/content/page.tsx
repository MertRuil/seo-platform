"use client";

import React, { useState, useMemo } from "react";
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
  ShieldAlert,
  ShieldCheck,
  Scale,
  RefreshCw,
  Wand2,
} from "lucide-react";
import { DEMO_CONTENT, type ContentOptimizationData } from "@/lib/demo";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import {
  scanTurkishCompliance,
  getSectorName,
  type ComplianceViolation,
  type ComplianceSector,
} from "@/lib/compliance-tr";

const SAMPLE_TEXTS = [
  {
    title: "Sağlık & Klinik Örneği (Yasaklı İddialar)",
    content: "İstanbul'un en iyi doktoru ve 1 numaralı kliniğimiz ile sedef hastalığını tedavi eder, burun estetiğinde öncesi sonrası garantili sonuç sunarız. Sıfır risk ile ağrısız acısız kesin çözüm.",
    keyword: "estetik cerrahi uzmanı",
  },
  {
    title: "Hukuk & Avukatlık Örneği (TBB Reklam İhlalleri)",
    content: "Ankara'nın en iyi ceza avukatı olarak dava kazanma garantisi ve ücretsiz danışmanlık veriyoruz. %100 başarı oranı ile en başarılı avukat bürosu.",
    keyword: "ceza avukatı ankara",
  },
  {
    title: "Gıda Takviyesi Örneği (Yasaklı Zayıflama Beyanları)",
    content: "Bu bitkisel çay 1 haftada 10 kilo zayıflatır ve kanseri önler. Sağlık Bakanlığı onaylı takviye olarak doktor tavsiyeli güvenli formül.",
    keyword: "zayıflama çayı",
  },
  {
    title: "Finans & Kredi Örneği (Yetkisiz Vaatler)",
    content: "Kripto botumuz ile günlük %10 kar ve kesin kazanç garantisi. Sicili bozuklara kredi ve senetle kredi anında hesabınızda.",
    keyword: "kredi başvurusu",
  },
  {
    title: "Mevzuata Tam Uyumlu Kurumsal Örnek",
    content: "Deneyimli hekim kadromuz ile tedavi sürecini destekleyen bilgilendirme danışmanlığı sunuyoruz. Yasal haklarınız kapsamında detaylı bilgi almak için iletişime geçebilirsiniz.",
    keyword: "sağlık danışmanlığı",
  },
];

export default function ContentOptimizerPage() {
  const [data, setData] = useState<ContentOptimizationData>(DEMO_CONTENT);
  const [targetUrl, setTargetUrl] = useState(DEMO_CONTENT.url);
  const [targetKeyword, setTargetKeyword] = useState(DEMO_CONTENT.targetKeyword);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Content Draft & Compliance Shield state
  const [contentDraft, setContentDraft] = useState(SAMPLE_TEXTS[0].content);
  const [selectedComplianceSector, setSelectedComplianceSector] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"nlp" | "compliance" | "generator">("nlp");

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

  // Scan live text for Turkish regulatory compliance
  const complianceViolations = useMemo(() => {
    const sectorFilter = selectedComplianceSector === "ALL" ? undefined : (selectedComplianceSector as ComplianceSector);
    return scanTurkishCompliance(contentDraft, sectorFilter);
  }, [contentDraft, selectedComplianceSector]);

  const criticalViolations = complianceViolations.filter((v) => v.severity === "CRITICAL");

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

  const handleApplyFix = (violation: ComplianceViolation) => {
    // Replace matched text with suggested fix in the draft
    const regex = new RegExp(violation.matchedPattern, "gi");
    setContentDraft((prev) => prev.replace(regex, violation.suggestedFix));
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
        title="İçerik Optimizasyonu & Türkiye Mevzuat Uyum Kalkanı"
        description="Surfer SEO standardında NLP içerik skoru, Google Helpful Content semantik varlıkları ve Türkiye Reklam Kurulu / TİTCK / TBB mevzuatına göre yasaklı kelime denetimi."
        actions={
          <div className="flex items-center gap-2">
            {criticalViolations.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold animate-pulse">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                {criticalViolations.length} Kritik Mevzuat İhlali!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Türkiye Reklam Mevzuatına Uyumlu
              </span>
            )}
          </div>
        }
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
            label: "TR Mevzuat Riski",
            value: complianceViolations.length === 0 ? "0 İhlal" : `${complianceViolations.length} Ceza Riski`,
            tone: complianceViolations.length === 0 ? "evidence" : "critical",
            hint: "Reklam Kurulu & TİTCK",
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
        ]}
      />

      {/* Tab Selector */}
      <div className="flex items-center gap-2 border-b border-line pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("nlp")}
          className={`px-4 py-2 text-sm font-semibold rounded-t-sm transition-colors border-b-2 ${
            activeTab === "nlp"
              ? "border-accent text-accent-ink bg-surface-2"
              : "border-transparent text-muted hover:text-ink hover:bg-surface-2"
          }`}
        >
          Semantik Varlıklar & NLP Skor
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("compliance")}
          className={`px-4 py-2 text-sm font-semibold rounded-t-sm transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === "compliance"
              ? "border-accent text-accent-ink bg-surface-2"
              : "border-transparent text-muted hover:text-ink hover:bg-surface-2"
          }`}
        >
          <Scale className="w-4 h-4 text-accent" />
          🇹🇷 Türkiye Mevzuat Uyum Kalkanı
          {complianceViolations.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-rose-500 text-white font-mono text-2xs">
              {complianceViolations.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("generator")}
          className={`px-4 py-2 text-sm font-semibold rounded-t-sm transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === "generator"
              ? "border-accent text-accent-ink bg-surface-2"
              : "border-transparent text-muted hover:text-ink hover:bg-surface-2"
          }`}
        >
          <Wand2 className="w-4 h-4 text-accent" />
          AI SEO İçerik Üretici
        </button>
      </div>

      {activeTab === "compliance" ? (
        /* =========================================================
           TAB 2: TÜRKİYE MEVZUAT VE REKLAM KURULU UYUM KALKANI
           ========================================================= */
        <div className="space-y-6">
          {/* Quick Sample Selector */}
          <Panel title="Sektörel Yasaklı Kalıp Test Simülatörü" sub="Farklı sektörlerde Türkiye Reklam Kurulu ve TİTCK tarafından yasaklanan örnek metinleri anında test edin">
            <div className="flex flex-wrap gap-2">
              {SAMPLE_TEXTS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setContentDraft(sample.content);
                    setTargetKeyword(sample.keyword);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-sm bg-surface-2 hover:bg-accent-soft hover:text-accent-ink border border-line transition-colors cursor-pointer"
                >
                  {sample.title}
                </button>
              ))}
            </div>

            <div className="mt-4">
              <Label htmlFor="live-draft">Denetlenen Sayfa / İçerik Metni (Düzenlenebilir)</Label>
              <textarea
                id="live-draft"
                rows={4}
                value={contentDraft}
                onChange={(e) => setContentDraft(e.target.value)}
                className="w-full bg-surface border border-line-strong rounded-sm p-3 text-sm text-ink font-sans focus:outline-none focus:border-accent leading-relaxed"
                placeholder="İçeriğinizi buraya yapıştırın veya yazın..."
              />
            </div>
          </Panel>

          {/* Compliance Status Alert */}
          {complianceViolations.length > 0 ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-sm space-y-2">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                <span>Yasal İkaz: İçerikte Türkiye Reklam Mevzuatına Aykırı {complianceViolations.length} İfade Tespit Edildi!</span>
              </div>
              <p className="text-xs text-rose-600 leading-relaxed">
                Türk Ticaret Kanunu, TİTCK Sağlık Hizmetleri Tanıtım Yönetmeliği veya TBB Avukatlık Reklam Yasağı uyarınca aşağıdaki ifadeler sitenize
                <strong> Ticaret Bakanlığı Reklam Kurulu tarafından idari para cezası</strong>, reklam durdurma veya <strong>BTK erişim engeli</strong> getirilmesine yol açabilir.
              </p>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-emerald-800">Mevzuata Tam Uyumlu</h4>
                <p className="text-xs text-emerald-700">
                  İçerikte TİTCK sağlık beyanı yasağı, TBB avukatlık üstünlük iddiası, SPK kesin kazanç vaadi veya kanıtlanamayan süperlatif kalıplar bulunmamaktadır.
                </p>
              </div>
            </div>
          )}

          {/* Sector Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-muted whitespace-nowrap">Sektör Filtresi:</span>
            {[
              { id: "ALL", label: "Tüm Sektörler" },
              { id: "HEALTH_MEDICAL", label: "Sağlık & Medikal (TİTCK)" },
              { id: "FOOD_SUPPLEMENT", label: "Gıda Takviyeleri & Zayıflama" },
              { id: "LEGAL_SERVICES", label: "Hukuk & Avukatlık (TBB)" },
              { id: "FINANCIAL_SERVICES", label: "Finans & Yatırım (SPK/BDDK)" },
              { id: "SUPERLATIVE_COMMERCIAL", label: "E-Ticaret & Reklam" },
              { id: "ILLEGAL_BETTING_TOBACCO", label: "Bahis & Tütün" },
            ].map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSelectedComplianceSector(sec.id)}
                className={`text-xs px-2.5 py-1 rounded-sm font-medium transition-colors ${
                  selectedComplianceSector === sec.id
                    ? "bg-accent-fill text-white font-semibold"
                    : "bg-surface text-muted border border-line hover:text-ink"
                }`}
              >
                {sec.label}
              </button>
            ))}
          </div>

          {/* Violations Table */}
          {complianceViolations.length > 0 && (
            <Panel title="Tespit Edilen Mevzuat İhlalleri ve Uyumlu Alternatifleri" flush>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2 border-b border-line text-xs font-semibold text-muted uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Yasaklı İfade</th>
                      <th className="py-3 px-3">Sektör</th>
                      <th className="py-3 px-3">İhlal Edilen Mevzuat</th>
                      <th className="py-3 px-3">Ceza Riski</th>
                      <th className="py-3 px-4">Tavsiye Edilen Uyumlu Alternatif</th>
                      <th className="py-3 px-3 text-right">Eylem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {complianceViolations.map((v, i) => (
                      <tr key={i} className="hover:bg-surface-2 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-sm font-mono text-xs w-fit">
                              "{v.matchedPattern}"
                            </span>
                            <span className="text-2xs text-muted font-mono">{v.title}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <Badge tone={v.severity === "CRITICAL" ? "critical" : "warn"} mono>
                            {getSectorName(v.sector)}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-3 text-xs text-muted max-w-[200px]">
                          {v.legalBasis}
                        </td>

                        <td className="py-3.5 px-3 text-xs text-rose-600 font-medium max-w-[180px]">
                          {v.penaltyRisk}
                        </td>

                        <td className="py-3.5 px-4 text-xs font-medium text-emerald-700 bg-emerald-50/40 rounded-sm">
                          {v.suggestedFix}
                        </td>

                        <td className="py-3.5 px-3 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleApplyFix(v)}
                            className="whitespace-nowrap"
                          >
                            Metinde Düzelt
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>
      ) : activeTab === "nlp" ? (
        /* =========================================================
           TAB 1: NLP SEMANTİK SKORLAMA (SURFER SEO STANDARDI)
           ========================================================= */
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

          {/* Right Column: Live Draft Editor */}
          <div className="lg:col-span-5 space-y-4">
            <Panel title="Canlı İçerik Taslağı & NLP Denetimi">
              <div className="space-y-3">
                <textarea
                  rows={14}
                  value={contentDraft}
                  onChange={(e) => setContentDraft(e.target.value)}
                  className="w-full bg-surface border border-line-strong rounded-sm p-3 text-xs text-ink font-sans focus:outline-none focus:border-accent leading-relaxed"
                  placeholder="İçeriğinizi buraya yazın..."
                />
                <div className="flex items-center justify-between text-2xs text-muted font-mono">
                  <span>Kelime: {contentDraft.split(/\s+/).filter(Boolean).length}</span>
                  {complianceViolations.length > 0 && (
                    <span className="text-rose-600 font-bold">
                      ⚠️ {complianceViolations.length} Türkiye mevzuat uyarısı
                    </span>
                  )}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        /* =========================================================
           TAB 3: AI SEO İÇERİK & KOD ÜRETİCİ
           ========================================================= */
        <div className="max-w-3xl mx-auto">
          <Panel title="AI SEO İçerik & Kod Üretici" sub="Başlık, meta açıklama, FAQ schema veya taslak üretin">
            <div className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-surface-2 p-1 rounded-sm border border-line">
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
      )}
    </div>
  );
}
