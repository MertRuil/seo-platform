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
import { formatCompact, formatNumber, formatTry } from "@/lib/format";
import { serpFeatureLabel } from "@/lib/terms";
import { useSite } from "@/context/SiteContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { DemoBanner } from "@/components/ui/DemoBanner";
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

function getKdColor(kd: number | null): { text: string; bg: string; label: string } {
  if (kd === null) return { text: "text-muted", bg: "bg-line-strong", label: "Ölçülmedi" };
  if (kd < 30) return { text: "text-evidence", bg: "bg-evidence", label: "Kolay" };
  if (kd < 60) return { text: "text-warn", bg: "bg-warn", label: "Orta" };
  return { text: "text-critical", bg: "bg-critical", label: "Zor" };
}

const newKeywordId = () => `kw-${Date.now()}`;

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

  const ranked = keywords.filter((k): k is KeywordItem & { current_pos: number } => k.current_pos !== null);
  const top3 = ranked.filter((k) => k.current_pos <= 3).length;
  const top10 = ranked.filter((k) => k.current_pos <= 10).length;
  const avgPos = ranked.length
    ? formatNumber(ranked.reduce((acc, curr) => acc + curr.current_pos, 0) / ranked.length, 1)
    : "—";
  const totalVol = keywords.reduce((acc, curr) => acc + (curr.volume ?? 0), 0);

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim()) return;

    const newItem: KeywordItem = {
      id: newKeywordId(),
      keyword: newKeyword.trim(),
      current_pos: null,
      prev_pos: null,
      change: null,
      volume: null,
      difficulty: null,
      cpc: null,
      intent: newIntent,
      target_url: newTargetUrl.trim() || site?.primary_url || "",
      trend_7d: [],
      serp_features: [],
      checked_at: "Henüz ölçülmedi",
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
      id: newKeywordId(),
      keyword: item.keyword,
      current_pos: null,
      prev_pos: null,
      change: null,
      volume: item.volume,
      difficulty: item.difficulty,
      cpc: item.cpc,
      intent: item.intent,
      target_url: site?.primary_url || "",
      trend_7d: [],
      serp_features: item.has_ai_overview ? ["AI Overview"] : [],
      checked_at: "Henüz ölçülmedi",
    };

    setKeywords([newItem, ...keywords]);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14">
      {/* Header */}
      <PageHeader
        icon={<KeyRound className="w-5 h-5 text-accent" />}
        title="Anahtar kelimeler"
        description="Takip ettiğiniz kelimelerin Google sırası, arama hacmi ve zorluk puanı; sonuç sayfasında AI Genel Bakış çıkıp çıkmadığı."
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

      <DemoBanner source="demo" reason="no-endpoint" />

      {/* Metric Strip */}
      <MetricStrip
        items={[
          { label: "Takip Edilen Kelime", value: formatNumber(keywords.length), hint: "Google sırası günlük ölçülüyor" },
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
                aria-label="Kelime veya hedef URL ara"
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
                  <th className="py-3 px-4">Sonuç sayfasında</th>
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
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-xs font-semibold bg-critical-soft text-critical border border-critical/30"
                                title={`TR: ${trViolations[0].title} (${trViolations[0].legalBasis})`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-critical shrink-0" />
                                TR İhlal Riski: {trViolations[0].title}
                              </span>
                            )}
                            {euViolations.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-xs font-semibold bg-warn-soft text-warn border border-warn/30"
                                title={`EU: ${euViolations[0].title} (${euViolations[0].legalBasis})`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-warn shrink-0" />
                                EU Violation: {euViolations[0].title}
                              </span>
                            )}
                            {usViolations.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-xs font-semibold bg-accent-soft text-accent-ink border border-accent/30"
                                title={`US: ${usViolations[0].title} (${usViolations[0].legalBasis})`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-accent shrink-0" />
                                US Violation: {usViolations[0].title}
                              </span>
                            )}
                            {ukViolations.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-xs font-semibold bg-accent-soft text-accent-ink border border-accent/30"
                                title={`UK: ${ukViolations[0].title} (${ukViolations[0].legalBasis})`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-accent shrink-0" />
                                UK Violation: {ukViolations[0].title}
                              </span>
                            )}
                            {asiaViolations.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-xs font-semibold bg-accent-soft text-accent-ink border border-accent/30"
                                title={`Asia: ${asiaViolations[0].title} (${asiaViolations[0].legalBasis})`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-accent shrink-0" />
                                Asia Violation: {asiaViolations[0].title}
                              </span>
                            )}
                            {menaViolations.length > 0 && (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-xs font-semibold bg-evidence-soft text-evidence border border-evidence/30"
                                title={`MENA: ${menaViolations[0].title} (${menaViolations[0].legalBasis})`}
                              >
                                <AlertTriangle className="w-2.5 h-2.5 text-evidence shrink-0" />
                                MENA İhlali: {menaViolations[0].title}
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
                        {item.current_pos === null ? (
                          <span className="text-xs text-muted" title="Google sırası henüz ölçülmedi">—</span>
                        ) : (
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
                        )}
                      </td>

                      {/* Rank Change */}
                      <td className="py-3.5 px-3 text-center">
                        {item.change !== null && item.change > 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-evidence font-mono">
                            <ArrowUpRight className="w-3.5 h-3.5" /> +{item.change}
                          </span>
                        ) : item.change !== null && item.change < 0 ? (
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-critical font-mono">
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
                        {item.volume === null ? "—" : formatNumber(item.volume)}
                      </td>

                      {/* KD % */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-line rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${kdInfo.bg}`}
                              style={{ width: `${item.difficulty ?? 0}%` }}
                            />
                          </div>
                          <span className={`text-xs font-mono font-semibold ${kdInfo.text}`}>
                            {item.difficulty === null ? "—" : `%${item.difficulty}`}
                          </span>
                        </div>
                      </td>

                      {/* CPC */}
                      <td className="py-3.5 px-3 text-right font-mono text-muted">
                        {item.cpc === null ? "—" : formatTry(item.cpc)}
                      </td>

                      {/* Sonuç sayfası özellikleri */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1">
                          {item.serp_features?.map((feat, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-xs font-medium bg-surface-2 text-ink border border-line"
                            >
                              {feat === "AI Overview" && <Sparkles className="w-2.5 h-2.5 text-accent" />}
                              {serpFeatureLabel(feat)}
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
              <h3 className="text-sm font-bold text-ink mb-3">Önerilen kelimeler</h3>
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
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-xs font-semibold bg-critical-soft text-critical border border-critical/30"
                              title={`TR: ${expTr[0].title} (${expTr[0].legalBasis})`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-critical shrink-0" />
                              TR Yasaklı: {expTr[0].title}
                            </span>
                          )}
                          {expEu.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-xs font-semibold bg-warn-soft text-warn border border-warn/30"
                              title={`EU: ${expEu[0].title} (${expEu[0].legalBasis})`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-warn shrink-0" />
                              EU Prohibited: {expEu[0].title}
                            </span>
                          )}
                          {expUs.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-xs font-semibold bg-accent-soft text-accent-ink border border-accent/30"
                              title={`US: ${expUs[0].title} (${expUs[0].legalBasis})`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-accent shrink-0" />
                              US Prohibited: {expUs[0].title}
                            </span>
                          )}
                          {expAsia.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-xs font-semibold bg-accent-soft text-accent-ink border border-accent/30"
                              title={`Asia: ${expAsia[0].title} (${expAsia[0].legalBasis})`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-accent shrink-0" />
                              Asia Prohibited: {expAsia[0].title}
                            </span>
                          )}
                          {expUk.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-xs font-semibold bg-accent-soft text-accent-ink border border-accent/30"
                              title={`UK: ${expUk[0].title} (${expUk[0].legalBasis})`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-accent shrink-0" />
                              UK Prohibited: {expUk[0].title}
                            </span>
                          )}
                          {expMena.length > 0 && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-xs font-semibold bg-evidence-soft text-evidence border border-evidence/30"
                              title={`MENA: ${expMena[0].title} (${expMena[0].legalBasis})`}
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-evidence shrink-0" />
                              MENA Yasaklı: {expMena[0].title}
                            </span>
                          )}
                          {item.has_ai_overview && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-xs font-semibold bg-accent-soft text-accent-ink">
                              <Sparkles className="w-3 h-3 text-accent" /> {serpFeatureLabel("AI Overview")}
                            </span>
                          )}
                          <Badge tone={item.type === "QUESTION" ? "accent" : "neutral"} mono>
                            {item.type === "LONG_TAIL" ? "Uzun Kuyruk" : item.type === "QUESTION" ? "Soru Kalıbı" : "İlgili Arama"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted font-mono">
                          <span>Aylık Hacim: <strong className="text-ink">{formatNumber(item.volume)}</strong></span>
                          <span>KD: <strong className={kd.text}>%{item.difficulty} ({kd.label})</strong></span>
                          <span>Ort. CPC: <strong className="text-ink">{formatTry(item.cpc)}</strong></span>
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
          Kelimenin Google Türkiye sırası her gün ölçülür; sonuç sayfasında AI Genel Bakış çıkıp çıkmadığı da kaydedilir.
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
              <div className="mt-2 p-2.5 bg-critical-soft border border-critical/30 rounded-sm space-y-1">
                <div className="flex items-center gap-1.5 text-critical font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-critical shrink-0" />
                  <span>TR Reklam Mevzuatı Uyarısı: {scanTurkishCompliance(newKeyword)[0].title}</span>
                </div>
                <p className="text-xs text-critical leading-relaxed">
                  "{scanTurkishCompliance(newKeyword)[0].matchedPattern}" ifadesi {scanTurkishCompliance(newKeyword)[0].legalBasis} uyarınca yasaktır. Reklam Kurulu cezası riski taşır.
                </p>
                <p className="text-xs text-evidence font-semibold">
                  Tavsiye Edilen Alternatif: {scanTurkishCompliance(newKeyword)[0].suggestedFix}
                </p>
              </div>
            )}
            {scanEuCompliance(newKeyword).length > 0 && (
              <div className="mt-2 p-2.5 bg-warn-soft border border-warn/30 rounded-sm space-y-1">
                <div className="flex items-center gap-1.5 text-warn font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-warn shrink-0" />
                  <span>EU Regulatory Compliance Warning: {scanEuCompliance(newKeyword)[0].title}</span>
                </div>
                <p className="text-xs text-warn leading-relaxed">
                  "{scanEuCompliance(newKeyword)[0].matchedPattern}" violates {scanEuCompliance(newKeyword)[0].legalBasis}.
                </p>
                <p className="text-xs text-evidence font-semibold">
                  Compliant EU Recommendation: {scanEuCompliance(newKeyword)[0].suggestedFix}
                </p>
              </div>
            )}
            {scanUsCompliance(newKeyword).length > 0 && (
              <div className="mt-2 p-2.5 bg-accent-soft border border-accent/30 rounded-sm space-y-1">
                <div className="flex items-center gap-1.5 text-accent-ink font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>US Federal Compliance Warning: {scanUsCompliance(newKeyword)[0].title}</span>
                </div>
                <p className="text-xs text-accent-ink leading-relaxed">
                  "{scanUsCompliance(newKeyword)[0].matchedPattern}" violates {scanUsCompliance(newKeyword)[0].legalBasis} (FTC/FDA penalty risk).
                </p>
                <p className="text-xs text-evidence font-semibold">
                  Compliant US Recommendation: {scanUsCompliance(newKeyword)[0].suggestedFix}
                </p>
              </div>
            )}
            {scanAsiaCompliance(newKeyword).length > 0 && (
              <div className="mt-2 p-2.5 bg-accent-soft border border-accent/30 rounded-sm space-y-1">
                <div className="flex items-center gap-1.5 text-accent-ink font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>Asia / APAC Regulatory Warning: {scanAsiaCompliance(newKeyword)[0].title}</span>
                </div>
                <p className="text-xs text-accent-ink leading-relaxed">
                  "{scanAsiaCompliance(newKeyword)[0].matchedPattern}" violates {scanAsiaCompliance(newKeyword)[0].legalBasis} ({scanAsiaCompliance(newKeyword)[0].penaltyRisk}).
                </p>
                <p className="text-xs text-evidence font-semibold">
                  Compliant Asia Recommendation: {scanAsiaCompliance(newKeyword)[0].suggestedFix}
                </p>
              </div>
            )}
            {scanTextForUkCompliance(newKeyword).length > 0 && (
              <div className="mt-2 p-2.5 bg-accent-soft border border-accent/30 rounded-sm space-y-1">
                <div className="flex items-center gap-1.5 text-accent-ink font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>UK Regulatory Compliance Warning: {scanTextForUkCompliance(newKeyword)[0].title}</span>
                </div>
                <p className="text-xs text-accent-ink leading-relaxed">
                  "{scanTextForUkCompliance(newKeyword)[0].matchedPattern}" violates {scanTextForUkCompliance(newKeyword)[0].legalBasis} ({scanTextForUkCompliance(newKeyword)[0].penaltyRisk}).
                </p>
                <p className="text-xs text-evidence font-semibold">
                  Compliant UK Recommendation: {scanTextForUkCompliance(newKeyword)[0].suggestedFix}
                </p>
              </div>
            )}
            {scanTextForMenaCompliance(newKeyword).length > 0 && (
              <div className="mt-2 p-2.5 bg-evidence-soft border border-evidence/30 rounded-sm space-y-1">
                <div className="flex items-center gap-1.5 text-evidence font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-evidence shrink-0" />
                  <span>Orta Doğu & Körfez (MENA) Mevzuat Uyarısı: {scanTextForMenaCompliance(newKeyword)[0].title}</span>
                </div>
                <p className="text-xs text-evidence leading-relaxed">
                  "{scanTextForMenaCompliance(newKeyword)[0].matchedPattern}" ifadesi {scanTextForMenaCompliance(newKeyword)[0].legalBasis} ({scanTextForMenaCompliance(newKeyword)[0].penaltyRisk}) ile çelişmektedir.
                </p>
                <p className="text-xs text-evidence font-semibold">
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
