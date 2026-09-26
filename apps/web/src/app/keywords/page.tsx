"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  KeyRound,
  TrendingUp,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  ExternalLink,
  SlidersHorizontal,
  CheckCircle2,
  HelpCircle,
  Compass,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { DEMO_KEYWORDS, type KeywordItem, type KeywordResearchItem } from "@/lib/demo";
import { formatCompact, formatNumber } from "@/lib/format";
import { useSite } from "@/context/SiteContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { scanTurkishCompliance } from "@/lib/compliance-tr";
import { scanEuCompliance } from "@/lib/compliance-eu";
import { scanUsCompliance } from "@/lib/compliance-us";
import { scanAsiaCompliance } from "@/lib/compliance-asia";
import { scanTextForUkCompliance } from "@/lib/compliance-uk";
import { scanTextForMenaCompliance } from "@/lib/compliance-mena";

function getIntentTone(intent: string): Tone {
  switch (intent) {
    case "TRANSACTIONAL":
      return "evidence";
    case "COMMERCIAL":
      return "accent";
    case "INFORMATIONAL":
      return "neutral";
    case "NAVIGATIONAL":
      return "warn";
    default:
      return "neutral";
  }
}

function getIntentLabel(intent: string): string {
  switch (intent) {
    case "TRANSACTIONAL":
      return "İşlemsel";
    case "COMMERCIAL":
      return "Ticari";
    case "INFORMATIONAL":
      return "Bilgi";
    case "NAVIGATIONAL":
      return "Gezinme";
    default:
      return intent;
  }
}

function getKdColor(kd: number): { text: string; bg: string; label: string } {
  if (kd < 30) return { text: "text-emerald-500", bg: "bg-emerald-500", label: "Kolay" };
  if (kd < 60) return { text: "text-amber-500", bg: "bg-amber-500", label: "Orta" };
  return { text: "text-rose-500", bg: "bg-rose-500", label: "Zor" };
}

export default function KeywordsPage() {
  const { site } = useSite();
  const [activeTab, setActiveTab] = useState<"tracker" | "explorer">("tracker");
  const [keywords, setKeywords] = useState<KeywordItem[]>(DEMO_KEYWORDS.keywords);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIntent, setSelectedIntent] = useState<string>("ALL");

  // Add keyword modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newTargetUrl, setNewTargetUrl] = useState("");
  const [newIntent, setNewIntent] = useState<"COMMERCIAL" | "TRANSACTIONAL" | "INFORMATIONAL" | "NAVIGATIONAL">("COMMERCIAL");

  // Explorer research state
  const [researchQuery, setResearchQuery] = useState("");
  const [researchResults, setResearchResults] = useState<KeywordResearchItem[]>(DEMO_KEYWORDS.researchSuggestions);

  const filteredKeywords = keywords.filter((item) => {
    const matchesQuery = item.keyword.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.target_url.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesIntent = selectedIntent === "ALL" || item.intent === selectedIntent;
    return matchesQuery && matchesIntent;
  });

  const top3 = keywords.filter((k) => k.current_pos <= 3).length;
  const top10 = keywords.filter((k) => k.current_pos <= 10).length;
  const avgPos = (keywords.reduce((acc, curr) => acc + curr.current_pos, 0) / (keywords.length || 1)).toFixed(1);
  const totalVol = keywords.reduce((acc, curr) => acc + curr.volume, 0);

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    const newItem: KeywordItem = {
      id: `kw-${Date.now()}`,
      keyword: newKeyword.trim(),
      current_pos: Math.floor(Math.random() * 15) + 2,
      prev_pos: Math.floor(Math.random() * 20) + 4,
      change: 2,
      volume: (Math.floor(Math.random() * 60) + 10) * 100,
      difficulty: Math.floor(Math.random() * 45) + 20,
      cpc: Number((Math.random() * 18 + 4).toFixed(2)),
      intent: newIntent,
      target_url: newTargetUrl.trim() || site?.primary_url || "https://flagship-store.com",
      trend_7d: [8, 7, 6, 5, 4, 3, 2],
      serp_features: ["AI Overview", "People Also Ask"],
      checked_at: "Yeni eklendi",
    };

    setKeywords([newItem, ...keywords]);
    setNewKeyword("");
    setNewTargetUrl("");
    setIsAddOpen(false);
  };

  const handleAddFromExplorer = (item: KeywordResearchItem) => {
    const exists = keywords.some((k) => k.keyword.toLowerCase() === item.keyword.toLowerCase());
    if (exists) return;

    const newItem: KeywordItem = {
      id: `kw-${Date.now()}`,
      keyword: item.keyword,
      current_pos: Math.floor(Math.random() * 18) + 4,
      prev_pos: Math.floor(Math.random() * 25) + 6,
      change: 2,
      volume: item.volume,
      difficulty: item.difficulty,
      cpc: item.cpc,
      intent: item.intent,
      target_url: site?.primary_url || "https://flagship-store.com",
      trend_7d: [9, 8, 7, 7, 6, 5, 4],
      serp_features: item.has_ai_overview ? ["AI Overview", "People Also Ask"] : ["Featured Snippet"],
      checked_at: "Yeni eklendi",
    };

    setKeywords([newItem, ...keywords]);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14">
      {/* Header */}
      <PageHeader
        icon={<KeyRound className="w-5 h-5 text-accent" />}
        title="Anahtar Kelimeler & Sıralama Takibi"
        description="Semrush ve Ahrefs kalitesinde SERP pozisyon takibi, arama hacimleri, zorluk skorları ve 2026 AI Overview SERP özellikleri."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddOpen(true)}
            >
              Yeni Kelime Ekle
            </Button>
          </div>
        }
      />

      {/* Metric Strip */}
      <MetricStrip
        items={[
          { label: "Takip Edilen Kelime", value: formatNumber(keywords.length), hint: "Aktif SERP takibi" },
          { label: "İlk 3'te", value: formatNumber(top3), tone: "evidence", hint: "En yüksek CTR dilimi" },
          { label: "İlk 10'da (Sayfa 1)", value: formatNumber(top10), tone: "default", hint: "Organik trafik üretenler" },
          { label: "Ortalama Sıralama", value: avgPos, hint: "Tüm portföy" },
          { label: "Toplam Arama Hacmi", value: formatCompact(totalVol), hint: "Aylık potansiyel" },
        ]}
      />

      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-line pb-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("tracker")}
            className={`px-4 py-2 text-sm font-semibold rounded-t-sm transition-colors border-b-2 ${
              activeTab === "tracker"
                ? "border-accent text-accent-ink bg-surface-2"
                : "border-transparent text-muted hover:text-ink hover:bg-surface-2"
            }`}
          >
            Pozisyon Takibi ({keywords.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("explorer")}
            className={`px-4 py-2 text-sm font-semibold rounded-t-sm transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === "explorer"
                ? "border-accent text-accent-ink bg-surface-2"
                : "border-transparent text-muted hover:text-ink hover:bg-surface-2"
            }`}
          >
            <Compass className="w-4 h-4 text-accent" />
            Kelime Araştırması & Fikirler
          </button>
        </div>
      </div>

      {activeTab === "tracker" ? (
        <Panel flush>
          {/* Filter Bar */}
          <div className="p-4 border-b border-line flex flex-col md:flex-row items-center justify-between gap-3 bg-surface-2">
            <div className="w-full md:w-80">
              <Input
                placeholder="Kelime veya hedef URL ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-4 h-4 text-faint" />}
              />
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <span className="text-xs font-semibold text-muted whitespace-nowrap">Arama Niyeti:</span>
              {(["ALL", "COMMERCIAL", "TRANSACTIONAL", "INFORMATIONAL", "NAVIGATIONAL"] as const).map((intent) => (
                <button
                  key={intent}
                  type="button"
                  onClick={() => setSelectedIntent(intent)}
                  className={`text-xs px-2.5 py-1 rounded-sm font-medium transition-colors ${
                    selectedIntent === intent
                      ? "bg-accent-fill text-white font-semibold"
                      : "bg-surface text-muted border border-line hover:text-ink"
                  }`}
                >
                  {intent === "ALL" ? "Tümü" : getIntentLabel(intent)}
                </button>
              ))}
            </div>
          </div>

          {/* Keywords Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 border-b border-line text-xs font-semibold text-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Anahtar Kelime</th>
                  <th className="py-3 px-3 text-center">Sıra</th>
                  <th className="py-3 px-3 text-center">Değişim</th>
                  <th className="py-3 px-3 text-center">7 Günlük Trend</th>
                  <th className="py-3 px-3 text-right">Aylık Hacim</th>
                  <th className="py-3 px-3">Zorluk (KD%)</th>
                  <th className="py-3 px-3 text-right">CPC</th>
                  <th className="py-3 px-4">SERP Özellikleri</th>
                  <th className="py-3 px-4">Hedef Sayfa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredKeywords.map((item) => {
                  const kdInfo = getKdColor(item.difficulty);
                  const trViolations = scanTurkishCompliance(item.keyword);
                  const euViolations = scanEuCompliance(item.keyword);
                  const usViolations = scanUsCompliance(item.keyword);
                  const asiaViolations = scanAsiaCompliance(item.keyword);
                  const ukViolations = scanTextForUkCompliance(item.keyword);
                  const menaViolations = scanTextForMenaCompliance(item.keyword);
                  return (
                    <tr key={item.id} className="hover:bg-surface-2 transition-colors">
                      {/* Keyword + Intent */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-ink">{item.keyword}</span>
                            {trViolations.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-2xs font-semibold bg-rose-50 text-rose-600 border border-rose-200"
                                title={`TR: ${trViolations[0].title} (${trViolations[0].legalBasis})`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                                🇹🇷 TR İhlal Riski: {trViolations[0].title}
                              </span>
                            )}
                            {euViolations.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-2xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                                title={`EU: ${euViolations[0].title} (${euViolations[0].legalBasis})`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                🇪🇺 EU Violation: {euViolations[0].title}
                              </span>
                            )}
                            {usViolations.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-2xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                                title={`US: ${usViolations[0].title} (${usViolations[0].legalBasis})`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                                🇺🇸 US Violation: {usViolations[0].title}
                              </span>
                            )}
                            {ukViolations.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-2xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
                                title={`UK: ${ukViolations[0].title} (${ukViolations[0].legalBasis})`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                                🇬🇧 UK Violation: {ukViolations[0].title}
                              </span>
                            )}
                            {asiaViolations.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-2xs font-semibold bg-purple-50 text-purple-700 border border-purple-200"
                                title={`Asia: ${asiaViolations[0].title} (${asiaViolations[0].legalBasis})`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                                🌏 Asia Violation: {asiaViolations[0].title}
                              </span>
                            )}
                            {menaViolations.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                                title={`MENA: ${menaViolations[0].title} (${menaViolations[0].legalBasis})`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                🇦🇪 MENA İhlali: {menaViolations[0].title}
                              </span>
                            )}
                          </div>

                          <div>
                            <Badge tone={getIntentTone(item.intent)} mono>
                              {getIntentLabel(item.intent)}
                            </Badge>
                          </div>
                        </div>
                      </td>

                      {/* Rank Position */}
                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-sm font-mono font-bold text-sm ${
                            item.current_pos <= 3
                              ? "bg-evidence-soft text-evidence border border-evidence"
                              : item.current_pos <= 10
                              ? "bg-accent-soft text-accent-ink border border-accent"
                              : "bg-surface-2 text-ink border border-line"
                          }`}
                        >
                          {item.current_pos}
                        </span>
                      </td>

                      {/* Rank Change */}
                      <td className="py-3.5 px-3 text-center">
                        {item.change > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600 font-mono">
                            <ArrowUpRight className="w-3.5 h-3.5" /> +{item.change}
                          </span>
                        ) : item.change < 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-rose-500 font-mono">
                            <ArrowDownRight className="w-3.5 h-3.5" /> {item.change}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs text-muted font-mono">
                            <Minus className="w-3 h-3" />
                          </span>
                        )}
                      </td>

                      {/* 7-Day Trend Mini Sparkline */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-end justify-center gap-1 h-6">
                          {item.trend_7d.map((val, idx) => {
                            // Inverted height because rank 1 is best
                            const heightPct = Math.max(15, 100 - val * 6);
                            return (
                              <div
                                key={idx}
                                title={`${idx + 1}. gün: Sıra ${val}`}
                                className={`w-1.5 rounded-xs ${
                                  idx === item.trend_7d.length - 1 ? "bg-accent" : "bg-line-strong"
                                }`}
                                style={{ height: `${heightPct}%` }}
                              />
                            );
                          })}
                        </div>
                      </td>

                      {/* Search Volume */}
                      <td className="py-3.5 px-3 text-right font-mono font-medium text-ink">
                        {formatNumber(item.volume)}
                      </td>

                      {/* KD % */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-line rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${kdInfo.bg}`}
                              style={{ width: `${item.difficulty}%` }}
                            />
                          </div>
                          <span className={`text-xs font-mono font-semibold ${kdInfo.text}`}>
                            %{item.difficulty}
                          </span>
                        </div>
                      </td>

                      {/* CPC */}
                      <td className="py-3.5 px-3 text-right font-mono text-muted">
                        ₺{item.cpc.toFixed(2)}
                      </td>

                      {/* SERP Features */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {item.serp_features?.map((feat, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-2xs font-medium bg-surface-2 text-ink border border-line"
                            >
                              {feat === "AI Overview" && <Sparkles className="w-2.5 h-2.5 text-accent" />}
                              {feat}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Target Page URL */}
                      <td className="py-3.5 px-4">
                        <a
                          href={item.target_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline font-mono truncate max-w-[180px]"
                        >
                          {item.target_url.replace(/^https?:\/\//, "")}
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        /* Explorer Tab */
        <div className="space-y-5">
          <Panel title="Anahtar Kelime Araştırması ve Fırsat Önerileri">
            <div className="p-4 bg-surface-2 rounded-sm border border-line flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Hedef konunuzu veya ana kelimenizi yazın (ör: seo analizi, ecommerce cwv)..."
                  value={researchQuery}
                  onChange={(e) => setResearchQuery(e.target.value)}
                  icon={<Search className="w-4 h-4 text-faint" />}
                />
              </div>
              <Button variant="primary" icon={<Sparkles className="w-4 h-4" />}>
                Yapay Zeka ile Araştır
              </Button>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-bold text-ink mb-3">Önerilen Yüksek Potansiyelli Terimler (2026 SERP Analizi)</h3>
              <div className="divide-y divide-line border border-line rounded-sm overflow-hidden">
                {researchResults.map((item, idx) => {
                  const isTracked = keywords.some((k) => k.keyword.toLowerCase() === item.keyword.toLowerCase());
                  const kd = getKdColor(item.difficulty);
                  const expTr = scanTurkishCompliance(item.keyword);
                  const expEu = scanEuCompliance(item.keyword);
                  const expUs = scanUsCompliance(item.keyword);
                  const expAsia = scanAsiaCompliance(item.keyword);
                  const expUk = scanTextForUkCompliance(item.keyword);
                  const expMena = scanTextForMenaCompliance(item.keyword);
                  return (
                    <div key={idx} className="p-4 bg-surface hover:bg-surface-2 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-ink text-sm">{item.keyword}</span>
                          {expTr.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-2xs font-semibold bg-rose-50 text-rose-600 border border-rose-200"
                              title={`TR: ${expTr[0].title} (${expTr[0].legalBasis})`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
                              🇹🇷 TR Yasaklı: {expTr[0].title}
                            </span>
                          )}
                          {expEu.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-2xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"
                              title={`EU: ${expEu[0].title} (${expEu[0].legalBasis})`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                              🇪🇺 EU Prohibited: {expEu[0].title}
                            </span>
                          )}
                          {expUs.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-2xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                              title={`US: ${expUs[0].title} (${expUs[0].legalBasis})`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                              🇺🇸 US Prohibited: {expUs[0].title}
                            </span>
                          )}
                          {expAsia.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-2xs font-semibold bg-purple-50 text-purple-700 border border-purple-200"
                              title={`Asia: ${expAsia[0].title} (${expAsia[0].legalBasis})`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                              🌏 Asia Prohibited: {expAsia[0].title}
                            </span>
                          )}
                          {expUk.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-2xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200"
                              title={`UK: ${expUk[0].title} (${expUk[0].legalBasis})`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-indigo-600 shrink-0" />
                              🇬🇧 UK Prohibited: {expUk[0].title}
                            </span>
                          )}
                          {expMena.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"
                              title={`MENA: ${expMena[0].title} (${expMena[0].legalBasis})`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                              🇦🇪 MENA Yasaklı: {expMena[0].title}
                            </span>
                          )}
                          {item.has_ai_overview && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-2xs font-semibold bg-accent-soft text-accent-ink">
                              <Sparkles className="w-3 h-3 text-accent" /> AI Overview SERP
                            </span>
                          )}
                          <Badge tone={item.type === "QUESTION" ? "accent" : "neutral"} mono>
                            {item.type === "LONG_TAIL" ? "Uzun Kuyruk" : item.type === "QUESTION" ? "Soru Kalıbı" : "İlgili Arama"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted font-mono">
                          <span>Aylık Hacim: <strong className="text-ink">{formatNumber(item.volume)}</strong></span>
                          <span>KD: <strong className={kd.text}>%{item.difficulty} ({kd.label})</strong></span>
                          <span>Ort. CPC: <strong className="text-ink">₺{item.cpc.toFixed(2)}</strong></span>
                        </div>
                      </div>

                      <div>
                        {isTracked ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-evidence">
                            <CheckCircle2 className="w-4 h-4" /> Takip Ediliyor
                          </span>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Plus className="w-3.5 h-3.5" />}
                            onClick={() => handleAddFromExplorer(item)}
                          >
                            Takibe Ekle
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Add Keyword Modal */}
      <Modal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Yeni Anahtar Kelimeyi Takibe Al"
      >
        <p className="text-xs text-muted mb-4">
          Sıralama robotumuz Google Türkiye SERP sonuçlarını günlük tarayarak pozisyon grafiği ve AI Overview görünürlüğünü kaydeder.
        </p>
        <form onSubmit={handleAddKeyword} className="space-y-4">
          <div>
            <Label htmlFor="kw-name">Anahtar Kelime</Label>
            <Input
              id="kw-name"
              placeholder="ör. kurumsal e-ticaret seo optimizasyonu"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              required
            />
            {scanTurkishCompliance(newKeyword).length > 0 && (
              <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-sm space-y-1">
                <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>🇹🇷 TR Reklam Mevzuatı Uyarısı: {scanTurkishCompliance(newKeyword)[0].title}</span>
                </div>
                <p className="text-2xs text-rose-600 leading-relaxed">
                  "{scanTurkishCompliance(newKeyword)[0].matchedPattern}" ifadesi {scanTurkishCompliance(newKeyword)[0].legalBasis} uyarınca yasaktır. Reklam Kurulu cezası riski taşır.
                </p>
                <p className="text-2xs text-emerald-700 font-semibold">
                  Tavsiye Edilen Alternatif: {scanTurkishCompliance(newKeyword)[0].suggestedFix}
                </p>
              </div>
            )}
            {scanEuCompliance(newKeyword).length > 0 && (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-sm space-y-1">
                <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>🇪🇺 EU Regulatory Compliance Warning: {scanEuCompliance(newKeyword)[0].title}</span>
                </div>
                <p className="text-2xs text-amber-700 leading-relaxed">
                  "{scanEuCompliance(newKeyword)[0].matchedPattern}" violates {scanEuCompliance(newKeyword)[0].legalBasis}.
                </p>
                <p className="text-2xs text-emerald-700 font-semibold">
                  Compliant EU Recommendation: {scanEuCompliance(newKeyword)[0].suggestedFix}
                </p>
              </div>
            )}
            {scanUsCompliance(newKeyword).length > 0 && (
              <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-sm space-y-1">
                <div className="flex items-center gap-1.5 text-blue-800 font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>🇺🇸 US Federal Compliance Warning: {scanUsCompliance(newKeyword)[0].title}</span>
                </div>
                <p className="text-2xs text-blue-700 leading-relaxed">
                  "{scanUsCompliance(newKeyword)[0].matchedPattern}" violates {scanUsCompliance(newKeyword)[0].legalBasis} (FTC/FDA penalty risk).
                </p>
                <p className="text-2xs text-emerald-700 font-semibold">
                  Compliant US Recommendation: {scanUsCompliance(newKeyword)[0].suggestedFix}
                </p>
              </div>
            )}
            {scanAsiaCompliance(newKeyword).length > 0 && (
              <div className="mt-2 p-2.5 bg-purple-50 border border-purple-200 rounded-sm space-y-1">
                <div className="flex items-center gap-1.5 text-purple-800 font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>🌏 Asia / APAC Regulatory Warning: {scanAsiaCompliance(newKeyword)[0].title}</span>
                </div>
                <p className="text-2xs text-purple-700 leading-relaxed">
                  "{scanAsiaCompliance(newKeyword)[0].matchedPattern}" violates {scanAsiaCompliance(newKeyword)[0].legalBasis} ({scanAsiaCompliance(newKeyword)[0].penaltyRisk}).
                </p>
                <p className="text-2xs text-emerald-700 font-semibold">
                  Compliant Asia Recommendation: {scanAsiaCompliance(newKeyword)[0].suggestedFix}
                </p>
              </div>
            )}
            {scanTextForUkCompliance(newKeyword).length > 0 && (
              <div className="mt-2 p-2.5 bg-indigo-50 border border-indigo-200 rounded-sm space-y-1">
                <div className="flex items-center gap-1.5 text-indigo-800 font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>🇬🇧 UK Regulatory Compliance Warning: {scanTextForUkCompliance(newKeyword)[0].title}</span>
                </div>
                <p className="text-2xs text-indigo-700 leading-relaxed">
                  "{scanTextForUkCompliance(newKeyword)[0].matchedPattern}" violates {scanTextForUkCompliance(newKeyword)[0].legalBasis} ({scanTextForUkCompliance(newKeyword)[0].penaltyRisk}).
                </p>
                <p className="text-2xs text-emerald-700 font-semibold">
                  Compliant UK Recommendation: {scanTextForUkCompliance(newKeyword)[0].suggestedFix}
                </p>
              </div>
            )}
            {scanTextForMenaCompliance(newKeyword).length > 0 && (
              <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-sm space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>🇦🇪 Orta Doğu & Körfez (MENA) Mevzuat Uyarısı: {scanTextForMenaCompliance(newKeyword)[0].title}</span>
                </div>
                <p className="text-2xs text-emerald-700 leading-relaxed">
                  "{scanTextForMenaCompliance(newKeyword)[0].matchedPattern}" ifadesi {scanTextForMenaCompliance(newKeyword)[0].legalBasis} ({scanTextForMenaCompliance(newKeyword)[0].penaltyRisk}) ile çelişmektedir.
                </p>
                <p className="text-2xs text-emerald-800 font-semibold">
                  Önerilen Uyumlu Alternatif: {scanTextForMenaCompliance(newKeyword)[0].suggestedFix}
                </p>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="target-url">Hedef URL (Opsiyonel)</Label>
            <Input
              id="target-url"
              placeholder="https://flagship-store.com/hizmetler/seo"
              value={newTargetUrl}
              onChange={(e) => setNewTargetUrl(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="intent-select">Arama Niyeti</Label>
            <select
              id="intent-select"
              value={newIntent}
              onChange={(e) => setNewIntent(e.target.value as any)}
              className="w-full h-9 bg-surface border border-line-strong rounded-sm px-3 text-sm text-ink focus:outline-none focus:border-accent"
            >
              <option value="COMMERCIAL">Ticari (Commercial) - Ürün ve Hizmet Karşılaştırma</option>
              <option value="TRANSACTIONAL">İşlemsel (Transactional) - Satın Alma / Kayıt</option>
              <option value="INFORMATIONAL">Bilgi (Informational) - Kılavuz & Blog</option>
              <option value="NAVIGATIONAL">Gezinme (Navigational) - Marka Araması</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button variant="ghost" onClick={() => setIsAddOpen(false)}>
              İptal
            </Button>
            <Button variant="primary" type="submit">
              Kaydet ve Takibe Başla
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
