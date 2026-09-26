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
  getSectorName as getTrSectorName,
  type ComplianceViolation as TrComplianceViolation,
  type ComplianceSector as TrComplianceSector,
} from "@/lib/compliance-tr";
import {
  scanEuCompliance,
  getEuSectorName,
  type EuComplianceViolation,
  type EuComplianceSector,
} from "@/lib/compliance-eu";
import {
  scanUsCompliance,
  getUsSectorName,
  type UsComplianceViolation,
  type UsComplianceSector,
} from "@/lib/compliance-us";

const SAMPLE_TEXTS_TR = [
  {
    title: "🏥 Sağlık & Klinik (TİTCK İhlalleri)",
    content: "İstanbul'un en iyi doktoru ve 1 numaralı kliniğimiz ile sedef hastalığını tedavi eder, burun estetiğinde öncesi sonrası garantili sonuç sunarız. Sıfır risk ile ağrısız acısız kesin çözüm.",
    keyword: "estetik cerrahi uzmanı",
  },
  {
    title: "⚖️ Hukuk & Avukatlık (TBB Reklam İhlalleri)",
    content: "Ankara'nın en iyi ceza avukatı olarak dava kazanma garantisi ve ücretsiz danışmanlık veriyoruz. %100 başarı oranı ile en başarılı avukat bürosu.",
    keyword: "ceza avukatı ankara",
  },
  {
    title: "💊 Gıda Takviyesi (Yasaklı Zayıflama Beyanları)",
    content: "Bu bitkisel çay 1 haftada 10 kilo zayıflatır ve kanseri önler. Sağlık Bakanlığı onaylı takviye olarak doktor tavsiyeli güvenli formül.",
    keyword: "zayıflama çayı",
  },
  {
    title: "💳 Finans & Kredi (Yetkisiz Vaatler)",
    content: "Kripto botumuz ile günlük %10 kar ve kesin kazanç garantisi. Sicili bozuklara kredi ve senetle kredi anında hesabınızda.",
    keyword: "kredi başvurusu",
  },
  {
    title: "✅ Mevzuata Tam Uyumlu Kurumsal Örnek",
    content: "Deneyimli hekim kadromuz ile tedavi sürecini destekleyen bilgilendirme danışmanlığı sunuyoruz. Yasal haklarınız kapsamında detaylı bilgi almak için iletişime geçebilirsiniz.",
    keyword: "sağlık danışmanlığı",
  },
];

const SAMPLE_TEXTS_EU = [
  {
    title: "🌿 Greenwashing & Climate (Dir (EU) 2024/825)",
    content: "Our new clothing line is 100% eco-friendly and 100% sustainable. Completely carbon neutral and climate positive shopping with net-zero product footprint.",
    keyword: "sustainable fashion europe",
  },
  {
    title: "🏥 Health & Pharma (Dir 2001/83/EC & MDR)",
    content: "Order Ozempic without prescription online! Our European clinic offers a guaranteed cure for diabetes with zero risk surgery and no side effects.",
    keyword: "weight loss clinic europe",
  },
  {
    title: "🥗 Supplements & Weight Loss (EFSA Reg 1924/2006)",
    content: "Drink our herbal extract to lose 10 kg in 2 weeks with our rapid fat burning formula. Clinically proven, cures arthritis and prevents cancer.",
    keyword: "slimming tea europe",
  },
  {
    title: "💰 Finance & Crypto (MiCA & MiFID II)",
    content: "Invest in our algorithm for guaranteed returns and risk-free investment with guaranteed crypto profit. Instant loans no credit check guaranteed.",
    keyword: "crypto trading platform eu",
  },
  {
    title: "🛒 E-Commerce Superlative (Omnibus Directive)",
    content: "We are the cheapest in Europe with an unbeatable price and unconditional money-back guarantee with no questions asked refund.",
    keyword: "electronics store europe",
  },
  {
    title: "✅ Fully Compliant EU Standard Copy",
    content: "Our specialized clinical diagnostics adhere to European standards. Competitive pricing with standard 14-day statutory withdrawal rights. Capital at risk for investments.",
    keyword: "medical diagnostics eu",
  },
];

const SAMPLE_TEXTS_US = [
  {
    title: "🏥 FDA Unapproved Disease Cure & POM (FD&C Act)",
    content: "Order Ozempic without prescription online! Our clinical formula cures cancer and provides a guaranteed cure for diabetes with zero risk surgery options.",
    keyword: "online pharmacy us",
  },
  {
    title: "🥗 Dietary Supplements & Rapid Weight Loss (DSHEA / FTC)",
    content: "Lose 30 lbs in 2 weeks with our rapid fat melting guarantee and lose weight without diet or exercise! Proven botanical drops prevent diabetes and heart disease.",
    keyword: "fat burner supplement us",
  },
  {
    title: "⭐ FTC Deceptive Practices, Fake Reviews & Made in USA",
    content: "Engineered globally and 100% made in the USA! Pay for 5-star reviews on Google and Yelp with guaranteed ratings. Claim your 100% free trial no risk today.",
    keyword: "reputation management us",
  },
  {
    title: "📈 SEC / CFTC Guaranteed Crypto Yield & Predatory Loans",
    content: "Invest in our algorithm for guaranteed returns and risk-free investing with guaranteed crypto yield. Instant loans no credit check with bad credit guaranteed approval.",
    keyword: "crypto investment us",
  },
  {
    title: "🌿 FTC Green Guides (Environmental Claims)",
    content: "Buy our certified carbon neutral product with 100% eco-friendly and zero environmental impact design. Completely environmentally safe guaranteed.",
    keyword: "sustainable products us",
  },
  {
    title: "⚖️ ABA Legal Outcome Guarantee (Model Rule 7.1)",
    content: "The best lawyer in New York with 100% success rate attorney and guaranteed court victory in commercial litigation. Guaranteed million dollar settlement.",
    keyword: "personal injury lawyer ny",
  },
  {
    title: "✅ Fully Compliant US Standard Copy",
    content: "Our certified clinical team provides diagnostic evaluations and physician consultations. Dietary supplement statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. Investments involve risk, including loss of principal. Prior results do not guarantee a similar outcome.",
    keyword: "wellness healthcare us",
  },
];

export default function ContentOptimizerPage() {
  const [data, setData] = useState<ContentOptimizationData>(DEMO_CONTENT);
  const [targetUrl, setTargetUrl] = useState(DEMO_CONTENT.url);
  const [targetKeyword, setTargetKeyword] = useState(DEMO_CONTENT.targetKeyword);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Content Draft & Compliance Shield state
  const [complianceRegion, setComplianceRegion] = useState<"TR" | "EU" | "US">("TR");
  const [contentDraft, setContentDraft] = useState(SAMPLE_TEXTS_TR[0].content);
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

  // Scan live text for regulatory compliance based on selected jurisdiction
  const complianceViolations = useMemo(() => {
    if (complianceRegion === "TR") {
      const sectorFilter = selectedComplianceSector === "ALL" ? undefined : (selectedComplianceSector as TrComplianceSector);
      return scanTurkishCompliance(contentDraft, sectorFilter);
    } else if (complianceRegion === "EU") {
      const sectorFilter = selectedComplianceSector === "ALL" ? undefined : (selectedComplianceSector as EuComplianceSector);
      return scanEuCompliance(contentDraft, sectorFilter);
    } else {
      const sectorFilter = selectedComplianceSector === "ALL" ? undefined : (selectedComplianceSector as UsComplianceSector);
      return scanUsCompliance(contentDraft, sectorFilter);
    }
  }, [complianceRegion, contentDraft, selectedComplianceSector]);

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

  const handleApplyFix = (violation: { matchedPattern: string; suggestedFix: string }) => {
    // Replace matched text with suggested fix in the draft
    const escaped = violation.matchedPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
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
          🛡️ Mevzuat Uyum Kalkanı ({complianceRegion === "TR" ? "🇹🇷 TR" : complianceRegion === "EU" ? "🇪🇺 EU" : "🇺🇸 US"})
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
           TAB 2: TÜRKİYE, AVRUPA BİRLİĞİ & ABD MEVZUAT UYUM KALKANI
           ========================================================= */
        <div className="space-y-6">
          {/* Jurisdiction / Region Switcher */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-surface-2 border border-line rounded-sm">
            <div>
              <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                <Scale className="w-4 h-4 text-accent" />
                Denetlenecek Yargı Alanı ve Mevzuat Rejimi
              </h3>
              <p className="text-xs text-muted">
                Hedef pazarınıza göre Türkiye Reklam Kurulu/TİTCK, Avrupa Birliği (Directives/EFSA/MiCA) veya ABD (FTC/FDA/SEC) kurallarını seçin.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-surface border border-line-strong rounded-sm shrink-0">
              <button
                type="button"
                onClick={() => {
                  setComplianceRegion("TR");
                  setContentDraft(SAMPLE_TEXTS_TR[0].content);
                  setSelectedComplianceSector("ALL");
                }}
                className={`text-xs px-2.5 py-1.5 rounded-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  complianceRegion === "TR"
                    ? "bg-accent-fill text-white shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span>🇹🇷</span> Türkiye (TR)
              </button>
              <button
                type="button"
                onClick={() => {
                  setComplianceRegion("EU");
                  setContentDraft(SAMPLE_TEXTS_EU[0].content);
                  setSelectedComplianceSector("ALL");
                }}
                className={`text-xs px-2.5 py-1.5 rounded-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  complianceRegion === "EU"
                    ? "bg-accent-fill text-white shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span>🇪🇺</span> Avrupa Birliği (EU)
              </button>
              <button
                type="button"
                onClick={() => {
                  setComplianceRegion("US");
                  setContentDraft(SAMPLE_TEXTS_US[0].content);
                  setSelectedComplianceSector("ALL");
                }}
                className={`text-xs px-2.5 py-1.5 rounded-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  complianceRegion === "US"
                    ? "bg-accent-fill text-white shadow-xs"
                    : "text-muted hover:text-ink"
                }`}
              >
                <span>🇺🇸</span> ABD (FTC / FDA / SEC)
              </button>
            </div>
          </div>

          {/* Quick Sample Selector */}
          <Panel
            title={
              complianceRegion === "TR"
                ? "Türkiye Sektörel Yasaklı Kalıp Test Simülatörü"
                : complianceRegion === "EU"
                ? "European Union Prohibited Claims & Directives Simulator"
                : "United States (US) Prohibited Claims & Federal Simulator"
            }
            sub={
              complianceRegion === "TR"
                ? "Farklı sektörlerde Türkiye Reklam Kurulu ve TİTCK tarafından yasaklanan örnek metinleri anında test edin"
                : complianceRegion === "EU"
                ? "Test real-world violations of Directive (EU) 2024/825 (Greenwashing), EFSA Regulation 1924/2006, MiCA and Directive 2001/83/EC"
                : "Test violations under FTC Act Section 5, FDA FD&C Act / DSHEA, SEC Rule 10b-5, FTC Green Guides, and ABA Model Rules"
            }
          >
            <div className="flex flex-wrap gap-2">
              {(complianceRegion === "TR"
                ? SAMPLE_TEXTS_TR
                : complianceRegion === "EU"
                ? SAMPLE_TEXTS_EU
                : SAMPLE_TEXTS_US
              ).map((sample, idx) => (
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
                placeholder={
                  complianceRegion === "TR"
                    ? "İçeriğinizi buraya yapıştırın veya yazın..."
                    : complianceRegion === "EU"
                    ? "Paste or type your English, German or French marketing copy here..."
                    : "Paste or type your US marketing copy, landing page or ad text here..."
                }
              />
            </div>
          </Panel>

          {/* Compliance Status Alert */}
          {complianceViolations.length > 0 ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-sm space-y-2">
              <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                <span>
                  {complianceRegion === "TR"
                    ? `Yasal İkaz: İçerikte Türkiye Reklam Mevzuatına Aykırı ${complianceViolations.length} İfade Tespit Edildi!`
                    : complianceRegion === "EU"
                    ? `EU Regulatory Alert: ${complianceViolations.length} Prohibited Claim(s) Detected Under European Directives!`
                    : `US Federal Regulatory Alert: ${complianceViolations.length} Prohibited Claim(s) Detected Under FTC/FDA/SEC Rules!`}
                </span>
              </div>
              <p className="text-xs text-rose-600 leading-relaxed">
                {complianceRegion === "TR" ? (
                  <>
                    Türk Ticaret Kanunu, TİTCK Sağlık Hizmetleri Tanıtım Yönetmeliği veya TBB Avukatlık Reklam Yasağı uyarınca aşağıdaki ifadeler sitenize{" "}
                    <strong>Ticaret Bakanlığı Reklam Kurulu tarafından 8.635.800 TL'ye varan idari para cezası</strong>, reklam durdurma veya{" "}
                    <strong>BTK erişim engeli</strong> getirilmesine yol açabilir.
                  </>
                ) : complianceRegion === "EU" ? (
                  <>
                    Under EU Directives (EmpCo 2024/825, EFSA Reg 1924/2006, MiCA 2023/1114, Directive 2001/83/EC), these claims carry risk of{" "}
                    <strong>fines up to 4% of annual turnover under EU consumer law</strong>, product recalls, or national regulatory bans by EU member state authorities.
                  </>
                ) : (
                  <>
                    Under US Federal Law (FTC Act Section 5, 21 U.S.C. FD&C Act, 16 CFR Part 464, SEC Rule 10b-5), these claims carry severe risk of{" "}
                    <strong>FTC civil penalties up to $51,744 per violation</strong>, FDA Warning Letters and product seizures, or SEC enforcement actions for fraudulent claims.
                  </>
                )}
              </p>
            </div>
          ) : (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-sm flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-emerald-800">
                  {complianceRegion === "TR"
                    ? "Mevzuata Tam Uyumlu"
                    : complianceRegion === "EU"
                    ? "Fully Compliant with EU Regulations"
                    : "Fully Compliant with US Federal Regulations"}
                </h4>
                <p className="text-xs text-emerald-700">
                  {complianceRegion === "TR"
                    ? "İçerikte TİTCK sağlık beyanı yasağı, TBB avukatlık üstünlük iddiası, SPK kesin kazanç vaadi veya kanıtlanamayan süperlatif kalıplar bulunmamaktadır."
                    : complianceRegion === "EU"
                    ? "No prohibited health claims (EFSA), greenwashing claims (EmpCo Dir 2024/825), MiCA guaranteed returns or unverified market superlatives found."
                    : "No prohibited disease claims (FDA), deceptive advertising or fake reviews (FTC), SEC guaranteed returns, or PACT Act violations found."}
                </p>
              </div>
            </div>
          )}

          {/* Sector Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-muted whitespace-nowrap">
              {complianceRegion === "TR" ? "Sektör Filtresi:" : "Sector Filter:"}
            </span>
            {(complianceRegion === "TR"
              ? [
                  { id: "ALL", label: "Tüm Sektörler" },
                  { id: "HEALTH_MEDICAL", label: "Sağlık & Medikal (TİTCK)" },
                  { id: "FOOD_SUPPLEMENT", label: "Gıda Takviyeleri & Zayıflama" },
                  { id: "LEGAL_SERVICES", label: "Hukuk & Avukatlık (TBB)" },
                  { id: "FINANCIAL_SERVICES", label: "Finans & Yatırım (SPK/BDDK)" },
                  { id: "SUPERLATIVE_COMMERCIAL", label: "E-Ticaret & Reklam" },
                  { id: "ILLEGAL_BETTING_TOBACCO", label: "Bahis & Tütün" },
                ]
              : complianceRegion === "EU"
              ? [
                  { id: "ALL", label: "All EU Sectors" },
                  { id: "HEALTH_PHARMA", label: "Health & Pharma (Dir 2001/83)" },
                  { id: "FOOD_SUPPLEMENT", label: "Food & Weight Loss (EFSA)" },
                  { id: "GREEN_CLAIMS", label: "Green Claims (Dir 2024/825)" },
                  { id: "CONSUMER_ECOMMERCE", label: "E-Commerce (Omnibus/UCPD)" },
                  { id: "FINANCIAL_SERVICES", label: "Finance & Crypto (MiCA)" },
                  { id: "LEGAL_SERVICES", label: "Legal Services (CCBE)" },
                  { id: "TOBACCO_NICOTINE", label: "Tobacco & Vaping (TPD)" },
                ]
              : [
                  { id: "ALL", label: "All US Sectors" },
                  { id: "HEALTH_FDA", label: "Health & FDA (FD&C Act)" },
                  { id: "SUPPLEMENTS_WEIGHTLOSS", label: "Supplements & Weight Loss (DSHEA)" },
                  { id: "FTC_COMMERCIAL_DECEPTIVE", label: "FTC Deceptive & Reviews (16 CFR)" },
                  { id: "FINANCIAL_SEC_CFPB", label: "Finance & Crypto (SEC 10b-5)" },
                  { id: "GREEN_GUIDES_FTC", label: "Environmental (FTC Green Guides)" },
                  { id: "LEGAL_ABA", label: "Legal Services (ABA 7.1)" },
                  { id: "TOBACCO_PACT", label: "Tobacco & Vapes (PACT Act)" },
                ]
            ).map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setSelectedComplianceSector(sec.id)}
                className={`text-xs px-2.5 py-1 rounded-sm font-medium transition-colors cursor-pointer ${
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
            <Panel
              title={
                complianceRegion === "TR"
                  ? "Tespit Edilen Mevzuat İhlalleri ve Uyumlu Alternatifleri"
                  : complianceRegion === "EU"
                  ? "Detected EU Regulatory Violations & Compliant Alternatives"
                  : "Detected US Regulatory Violations & Compliant Alternatives"
              }
              flush
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2 border-b border-line text-xs font-semibold text-muted uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">{complianceRegion === "TR" ? "Yasaklı İfade" : "Prohibited Phrase"}</th>
                      <th className="py-3 px-3">{complianceRegion === "TR" ? "Sektör" : "Sector"}</th>
                      <th className="py-3 px-3">
                        {complianceRegion === "TR"
                          ? "İhlal Edilen Mevzuat"
                          : complianceRegion === "EU"
                          ? "EU Legal Basis"
                          : "US Legal Basis"}
                      </th>
                      <th className="py-3 px-3">{complianceRegion === "TR" ? "Ceza Riski" : "Penalty / Liability"}</th>
                      <th className="py-3 px-4">
                        {complianceRegion === "TR"
                          ? "Tavsiye Edilen Uyumlu Alternatif"
                          : complianceRegion === "EU"
                          ? "Compliant EU Recommendation"
                          : "Compliant US Recommendation"}
                      </th>
                      <th className="py-3 px-3 text-right">{complianceRegion === "TR" ? "Eylem" : "Action"}</th>
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
                            {complianceRegion === "TR"
                              ? getTrSectorName(v.sector as any)
                              : complianceRegion === "EU"
                              ? getEuSectorName(v.sector as any)
                              : getUsSectorName(v.sector as any)}
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
                            {complianceRegion === "TR" ? "Metinde Düzelt" : "Apply Fix"}
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
