"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Users,
  Target,
  TrendingUp,
  Plus,
  ArrowRight,
  ShieldCheck,
  Globe,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Layers,
} from "lucide-react";
import { DEMO_COMPETITORS, type CompetitorItem, type CompetitorGapItem } from "@/lib/demo";
import { formatCompact, formatNumber } from "@/lib/format";
import { useSite } from "@/context/SiteContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

export default function CompetitorsPage() {
  const { site } = useSite();
  const [competitors, setCompetitors] = useState<CompetitorItem[]>(DEMO_COMPETITORS.competitors);
  const [keywordGap, setKeywordGap] = useState<CompetitorGapItem[]>(DEMO_COMPETITORS.keywordGap);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCompetitorDomain, setNewCompetitorDomain] = useState("");
  const [newCompetitorName, setNewCompetitorName] = useState("");

  const myDomain = site?.domain || DEMO_COMPETITORS.myDomain;

  const handleAddCompetitor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompetitorDomain.trim()) return;

    const cleanDomain = newCompetitorDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const newComp: CompetitorItem = {
      id: `comp-${Date.now()}`,
      name: newCompetitorName.trim() || cleanDomain,
      domain: cleanDomain,
      seo_score: Math.floor(Math.random() * 20) + 75,
      organic_traffic: Math.floor(Math.random() * 80000) + 20000,
      ranked_keywords: Math.floor(Math.random() * 6000) + 1200,
      backlinks: Math.floor(Math.random() * 45000) + 6000,
      geo_visibility: Math.floor(Math.random() * 35) + 55,
      top_keywords: ["online servis", "en ucuz teklif", "kullanıcı rehberi"],
    };

    setCompetitors([...competitors, newComp]);
    setNewCompetitorDomain("");
    setNewCompetitorName("");
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14">
      {/* Header */}
      <PageHeader
        icon={<Users className="w-5 h-5 text-accent" />}
        title="Rakip Analizi & Keyword Gap"
        description="Ahrefs ve Semrush standartlarında başa baş rakip karşılaştırması, pazar payı ve rakiplerin ilk sayfada olduğu sizin eksik kaldığınız anahtar kelime açıkları (Keyword Gap)."
        actions={
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Yeni Rakip Ekle
          </Button>
        }
      />

      {/* Metric Strip */}
      <MetricStrip
        items={[
          { label: "Aktif Rakip Sayısı", value: formatNumber(competitors.length), hint: "İzlenen alan adları" },
          { label: "Ortalama Rakip Skoru", value: "93 / 100", hint: "Pazar liderleri" },
          { label: "Keyword Gap Fırsatı", value: `${keywordGap.length} Terim`, tone: "warn", hint: "Rakiplerin önde olduğu kelimeler" },
          { label: "Bizim GEO Görünürlüğümüz", value: `%${DEMO_COMPETITORS.myGeoVisibility}`, tone: "evidence", hint: "Yapay zeka pazar payı" },
        ]}
      />

      {/* Head to Head Domain Comparison */}
      <Panel title="Başa Başa Alan Adı Karşılaştırma Matrisi" sub="Organik trafik, otorite ve arama görünürlüğü dengesi">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 border-b border-line text-xs font-semibold text-muted uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Alan Adı / Oyuncu</th>
                <th className="py-3 px-3 text-center">SEO Sağlık Skoru</th>
                <th className="py-3 px-3 text-right">Aylık Organik Trafik</th>
                <th className="py-3 px-3 text-right">Sıralanan Kelime</th>
                <th className="py-3 px-3 text-right">Backlink Ağı</th>
                <th className="py-3 px-3 text-center">GEO (AI Görünürlük)</th>
                <th className="py-3 px-4">En Güçlü Terimleri</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {/* Our Site */}
              <tr className="bg-accent-soft/30 font-semibold border-b-2 border-accent">
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-accent" />
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-ink font-bold">{myDomain}</span>
                        <Badge tone="accent" mono>SİZİN SİTENİZ</Badge>
                      </div>
                      <span className="text-xs text-muted font-mono font-normal">Birincil Mülk</span>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-3 text-center">
                  <span className="inline-flex items-center px-2 py-1 rounded-sm bg-evidence-soft text-evidence font-mono font-bold text-xs">
                    {DEMO_COMPETITORS.mySeoScore} / 100
                  </span>
                </td>
                <td className="py-4 px-3 text-right font-mono font-bold text-ink">
                  {formatCompact(DEMO_COMPETITORS.myOrganicTraffic)}
                </td>
                <td className="py-4 px-3 text-right font-mono font-bold text-ink">
                  {formatNumber(DEMO_COMPETITORS.myRankedKeywords)}
                </td>
                <td className="py-4 px-3 text-right font-mono font-bold text-ink">
                  {formatCompact(DEMO_COMPETITORS.myBacklinks)}
                </td>
                <td className="py-4 px-3 text-center font-mono font-bold text-accent-ink">
                  %{DEMO_COMPETITORS.myGeoVisibility}
                </td>
                <td className="py-4 px-4">
                  <div className="flex flex-wrap gap-1">
                    <span className="px-2 py-0.5 rounded-xs text-2xs bg-surface border border-line text-ink">otonom seo</span>
                    <span className="px-2 py-0.5 rounded-xs text-2xs bg-surface border border-line text-ink">yapay zeka canonical</span>
                  </div>
                </td>
              </tr>

              {/* Competitors */}
              {competitors.map((comp) => (
                <tr key={comp.id} className="hover:bg-surface-2 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted shrink-0" />
                      <div>
                        <span className="font-semibold text-ink block">{comp.name}</span>
                        <a
                          href={`https://${comp.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted hover:text-accent-ink font-mono flex items-center gap-1"
                        >
                          {comp.domain}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono font-semibold text-ink">
                    {comp.seo_score} / 100
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-ink">
                    {formatCompact(comp.organic_traffic)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-ink">
                    {formatCompact(comp.ranked_keywords)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-muted">
                    {formatCompact(comp.backlinks)}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono font-semibold text-accent-ink">
                    %{comp.geo_visibility}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1">
                      {comp.top_keywords.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-xs text-2xs bg-surface-2 text-muted border border-line">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Keyword Gap Matrix */}
      <Panel
        title="Keyword Gap Analizi (Rakiplerin Sıralandığı, Sizin Eksik Olduğunuz Terimler)"
        sub="Rakiplerinizin ilk sayfadan organik trafik çektiği ancak sitenizin henüz sıralanmadığı yüksek potansiyelli açıklar."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-2 border-b border-line text-xs font-semibold text-muted uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Açık Anahtar Kelime (Gap)</th>
                <th className="py-3 px-3 text-right">Aylık Hacim</th>
                <th className="py-3 px-3 text-center">Bizim Sıramız</th>
                <th className="py-3 px-3 text-center">Semrush Sırası</th>
                <th className="py-3 px-3 text-center">Ahrefs Sırası</th>
                <th className="py-3 px-3 text-center">Fırsat Skoru</th>
                <th className="py-3 px-4">Tavsiye Edilen Eylem</th>
                <th className="py-3 px-3 text-right">Eylem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {keywordGap.map((gap, idx) => (
                <tr key={idx} className="hover:bg-surface-2 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-ink">
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-accent shrink-0" />
                      <span>{gap.keyword}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-3 text-right font-mono font-medium text-ink">
                    {formatNumber(gap.volume)}
                  </td>

                  <td className="py-3.5 px-3 text-center">
                    {gap.my_position ? (
                      <span className="font-mono font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-sm text-xs">
                        Sıra {gap.my_position}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-sm text-xs">
                        <AlertCircle className="w-3 h-3" /> Sıralama Yok
                      </span>
                    )}
                  </td>

                  <td className="py-3.5 px-3 text-center font-mono font-bold text-ink">
                    #{gap.competitor_positions["semrush.com"] || "—"}
                  </td>

                  <td className="py-3.5 px-3 text-center font-mono font-bold text-ink">
                    #{gap.competitor_positions["ahrefs.com"] || "—"}
                  </td>

                  <td className="py-3.5 px-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-sm bg-accent-soft text-accent-ink font-mono font-bold text-xs">
                      {gap.opportunity_score} / 100
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-xs text-muted max-w-[240px]">
                    {gap.recommended_action}
                  </td>

                  <td className="py-3.5 px-3 text-right">
                    <Link
                      href="/content"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline whitespace-nowrap"
                    >
                      İçerik Yaz <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Add Competitor Modal */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Yeni Rakip Alan Adı Ekle"
      >
        <p className="text-xs text-muted mb-4">
          Rakibinizin domain adresini girin. Algoritmamız sitenin organik anahtar kelimelerini, trafik tahminlerini ve SERP çakışmalarını hesaplar.
        </p>
        <form onSubmit={handleAddCompetitor} className="space-y-4">
          <div>
            <Label htmlFor="comp-domain">Rakip Web Sitesi / Domain</Label>
            <Input
              id="comp-domain"
              placeholder="ör. rakipfirma.com"
              value={newCompetitorDomain}
              onChange={(e) => setNewCompetitorDomain(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="comp-name">Görünecek İsim (Opsiyonel)</Label>
            <Input
              id="comp-name"
              placeholder="ör. Rakip Firma A"
              value={newCompetitorName}
              onChange={(e) => setNewCompetitorName(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-line">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              İptal
            </Button>
            <Button variant="primary" type="submit">
              Rakibi Ekle ve Analiz Et
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
