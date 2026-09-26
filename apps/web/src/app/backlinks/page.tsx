"use client";

import React, { useState, useMemo } from "react";
import {
  Link2,
  ShieldAlert,
  Download,
  Filter,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Plus,
  RefreshCw,
  Globe,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useSite } from "@/context/SiteContext";

export interface WebBacklinkItem {
  id: string;
  source_url: string;
  source_domain: string;
  target_url: string;
  anchor_text: string;
  anchor_category: "BRAND" | "EXACT_MATCH" | "PARTIAL_MATCH" | "GENERIC" | "NAKED_URL";
  is_dofollow: boolean;
  domain_authority: number; // 1-100 DR
  page_authority: number;   // 1-100 UR
  spam_score: number;       // 0-100
  is_toxic: boolean;
  toxicity_reasons: string[];
  first_seen: string;
  status: "ACTIVE" | "LOST";
}

export const INITIAL_BACKLINKS: WebBacklinkItem[] = [
  {
    id: "bl-1",
    source_url: "https://techcrunch.com/2026/02/top-enterprise-seo-platforms",
    source_domain: "techcrunch.com",
    target_url: "https://acmestore.io",
    anchor_text: "Acme Store Platform",
    anchor_category: "BRAND",
    is_dofollow: true,
    domain_authority: 91,
    page_authority: 78,
    spam_score: 1,
    is_toxic: false,
    toxicity_reasons: [],
    first_seen: "2026-02-14",
    status: "ACTIVE",
  },
  {
    id: "bl-2",
    source_url: "https://searchengineland.com/geo-ai-search-optimization-guide",
    source_domain: "searchengineland.com",
    target_url: "https://acmestore.io/geo",
    anchor_text: "yapay zeka seo araçları ve geo",
    anchor_category: "EXACT_MATCH",
    is_dofollow: true,
    domain_authority: 86,
    page_authority: 71,
    spam_score: 2,
    is_toxic: false,
    toxicity_reasons: [],
    first_seen: "2026-03-01",
    status: "ACTIVE",
  },
  {
    id: "bl-3",
    source_url: "https://medium.com/@seoguru/best-ecommerce-practices-2026",
    source_domain: "medium.com",
    target_url: "https://acmestore.io/blog/ecommerce-seo",
    anchor_text: "https://acmestore.io/blog/ecommerce-seo",
    anchor_category: "NAKED_URL",
    is_dofollow: false,
    domain_authority: 82,
    page_authority: 54,
    spam_score: 3,
    is_toxic: false,
    toxicity_reasons: [],
    first_seen: "2026-03-10",
    status: "ACTIVE",
  },
  {
    id: "bl-4",
    source_url: "https://e-ticaret-rehberi.org/baglantilar",
    source_domain: "e-ticaret-rehberi.org",
    target_url: "https://acmestore.io",
    anchor_text: "tıklayın",
    anchor_category: "GENERIC",
    is_dofollow: true,
    domain_authority: 42,
    page_authority: 36,
    spam_score: 12,
    is_toxic: false,
    toxicity_reasons: [],
    first_seen: "2026-01-20",
    status: "ACTIVE",
  },
  {
    id: "bl-5",
    source_url: "https://free-crypto-casino-bonus.xyz/links-list",
    source_domain: "free-crypto-casino-bonus.xyz",
    target_url: "https://acmestore.io",
    anchor_text: "online casino baccarat win free",
    anchor_category: "EXACT_MATCH",
    is_dofollow: true,
    domain_authority: 4,
    page_authority: 6,
    spam_score: 88,
    is_toxic: true,
    toxicity_reasons: [
      "Yüksek riskli spam TLD uzantısı (.xyz)",
      "Yasaklı kumar/bahis anahtar kelimesi ('casino')",
      "Kritik alan adı spam skoru (%88)",
    ],
    first_seen: "2026-03-18",
    status: "ACTIVE",
  },
  {
    id: "bl-6",
    source_url: "https://auto-traffic-pbn.top/directory-scrape",
    source_domain: "auto-traffic-pbn.top",
    target_url: "https://acmestore.io/products",
    anchor_text: "cheap replica watches payday",
    anchor_category: "EXACT_MATCH",
    is_dofollow: true,
    domain_authority: 3,
    page_authority: 5,
    spam_score: 92,
    is_toxic: true,
    toxicity_reasons: [
      "Yüksek riskli PBN uzantısı (.top)",
      "Yapay link çiftliği tespit edildi",
      "Kritik alan adı spam skoru (%92)",
    ],
    first_seen: "2026-03-22",
    status: "ACTIVE",
  },
  {
    id: "bl-7",
    source_url: "https://webmaster-turkey.net/forum/seo-tartisma",
    source_domain: "webmaster-turkey.net",
    target_url: "https://acmestore.io/hakkimizda",
    anchor_text: "Acme Store uzman incelemesi",
    anchor_category: "PARTIAL_MATCH",
    is_dofollow: true,
    domain_authority: 56,
    page_authority: 48,
    spam_score: 8,
    is_toxic: false,
    toxicity_reasons: [],
    first_seen: "2026-02-05",
    status: "ACTIVE",
  },
  {
    id: "bl-8",
    source_url: "https://spambot-linkfarm.click/viagra-cialis",
    source_domain: "spambot-linkfarm.click",
    target_url: "https://acmestore.io",
    anchor_text: "buy viagra online overnight",
    anchor_category: "EXACT_MATCH",
    is_dofollow: true,
    domain_authority: 2,
    page_authority: 3,
    spam_score: 96,
    is_toxic: true,
    toxicity_reasons: [
      "Yüksek riskli şüpheli uzantı (.click)",
      "Yasaklı spam anahtar kelime ('viagra')",
      "Otomatik link çiftliği sinyalleri",
    ],
    first_seen: "2026-03-24",
    status: "ACTIVE",
  },
];

export default function BacklinksPage() {
  const { site } = useSite();
  const [backlinks, setBacklinks] = useState<WebBacklinkItem[]>(INITIAL_BACKLINKS);
  const [filter, setFilter] = useState<"ALL" | "TOXIC" | "DOFOLLOW" | "NOFOLLOW" | "HIGH_DR">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [newAnchor, setNewAnchor] = useState("");

  const toxicCount = backlinks.filter((b) => b.is_toxic).length;
  const dofollowCount = backlinks.filter((b) => b.is_dofollow).length;
  const uniqueDomains = new Set(backlinks.map((b) => b.source_domain)).size;
  const avgDa = Math.round(backlinks.reduce((acc, b) => acc + b.domain_authority, 0) / (backlinks.length || 1));
  const dofollowRatio = Math.round((dofollowCount / (backlinks.length || 1)) * 100);

  const filteredLinks = useMemo(() => {
    return backlinks.filter((b) => {
      if (filter === "TOXIC" && !b.is_toxic) return false;
      if (filter === "DOFOLLOW" && !b.is_dofollow) return false;
      if (filter === "NOFOLLOW" && b.is_dofollow) return false;
      if (filter === "HIGH_DR" && b.domain_authority < 60) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          b.source_domain.toLowerCase().includes(q) ||
          b.source_url.toLowerCase().includes(q) ||
          b.anchor_text.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [backlinks, filter, searchQuery]);

  const handleDownloadDisavow = () => {
    const toxicItems = backlinks.filter((b) => b.is_toxic);
    const dateStr = new Date().toISOString().slice(0, 19).replace("T", " ");
    
    const lines = [
      "# ----------------------------------------------------------------",
      "# Google Search Console - Disavow Links File",
      `# Generated for domain: ${site?.domain || "acmestore.io"}`,
      `# Generated At: ${dateStr} UTC`,
      `# Total Toxic Domains Identified: ${new Set(toxicItems.map((b) => b.source_domain)).size}`,
      "# Submit this file at: https://search.google.com/search-console/disavow-links",
      "# ----------------------------------------------------------------",
      "",
    ];

    const addedDomains = new Set<string>();
    toxicItems.forEach((item) => {
      if (!addedDomains.has(item.source_domain)) {
        lines.push(`# Reason: ${item.toxicity_reasons.join(" | ")}`);
        lines.push(`domain:${item.source_domain}`);
        addedDomains.add(item.source_domain);
      }
    });

    lines.push("");
    lines.push("# End of Disavow File");

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `google_disavow_${site?.domain || "acmestore"}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddBacklink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSourceUrl.trim()) return;

    let domain = newSourceUrl.trim();
    try {
      const parsed = new URL(newSourceUrl.trim().startsWith("http") ? newSourceUrl.trim() : `https://${newSourceUrl.trim()}`);
      domain = parsed.hostname;
    } catch {
      domain = newSourceUrl.trim().replace(/^https?:\/\//, "").split("/")[0];
    }

    const isSuspicious = domain.endsWith(".xyz") || domain.endsWith(".top") || domain.endsWith(".click") || (newAnchor.toLowerCase().includes("casino") || newAnchor.toLowerCase().includes("viagra"));
    const spamScore = isSuspicious ? Math.floor(Math.random() * 20) + 75 : Math.floor(Math.random() * 8) + 1;

    const newItem: WebBacklinkItem = {
      id: `bl-${Date.now()}`,
      source_url: newSourceUrl.trim().startsWith("http") ? newSourceUrl.trim() : `https://${newSourceUrl.trim()}`,
      source_domain: domain,
      target_url: site?.primary_url || "https://acmestore.io",
      anchor_text: newAnchor.trim() || domain,
      anchor_category: "BRAND",
      is_dofollow: true,
      domain_authority: isSuspicious ? Math.floor(Math.random() * 10) + 2 : Math.floor(Math.random() * 40) + 40,
      page_authority: isSuspicious ? 5 : 35,
      spam_score: spamScore,
      is_toxic: isSuspicious,
      toxicity_reasons: isSuspicious ? ["Kullanıcı tarafından eklenen şüpheli link", "Yüksek riskli TLD / spam profili"] : [],
      first_seen: new Date().toISOString().slice(0, 10),
      status: "ACTIVE",
    };

    setBacklinks([newItem, ...backlinks]);
    setNewSourceUrl("");
    setNewAnchor("");
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14">
      {/* Header */}
      <PageHeader
        icon={<Link2 className="w-5 h-5 text-accent" />}
        title="Backlink Analizi & Toksik Link Dedektörü"
        description="Ahrefs ve Moz standartlarında gelen bağlantı profili, Domain Rating (DR), Dofollow/Nofollow oranları, spam skorları ve Google Penguin cezalarından korunmak için tek tıkla Google Disavow dosyası oluşturucu."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              icon={<Download className="w-4 h-4 text-warn" />}
              onClick={handleDownloadDisavow}
            >
              Google Disavow (.txt) İndir
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddModalOpen(true)}
            >
              Yeni Backlink Tara
            </Button>
          </div>
        }
      />

      {/* KPI Metric Strip */}
      <MetricStrip
        items={[
          {
            label: "Toplam Backlink",
            value: backlinks.length.toString(),
            unit: "bağlantı",
            hint: `${uniqueDomains} benzersiz alan adı`,
          },
          {
            label: "Referring Domains",
            value: uniqueDomains.toString(),
            unit: "domain",
            tone: "evidence",
          },
          {
            label: "Dofollow Oranı",
            value: `%${dofollowRatio}`,
            tone: dofollowRatio > 60 ? "evidence" : "default",
            hint: `${dofollowCount} dofollow link`,
          },
          {
            label: "Ortalama Otorite (DR)",
            value: avgDa.toString(),
            unit: "/100",
            tone: avgDa > 45 ? "evidence" : "warn",
          },
          {
            label: "Toksik / Spam Link",
            value: toxicCount.toString(),
            unit: "zararlı",
            tone: toxicCount > 0 ? "warn" : "evidence",
            hint: toxicCount > 0 ? "Google cezası riski!" : "Temiz link profili",
          },
        ]}
      />

      {/* Toxic Alert Banner */}
      {toxicCount > 0 && (
        <div className="p-4 rounded-xl border border-warn/30 bg-warn/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-warn shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-ink">
                {toxicCount} Adet Toksik Backlink Saptandı (Google Penguin & Spam Uyarısı)
              </h4>
              <p className="text-xs text-muted mt-0.5">
                Kumar, PBN veya spam link ağlarından gelen bu bağlantılar alan adınızın PageRank değerini düşürebilir ve manuel işlem (Manual Action) cezasına neden olabilir.
              </p>
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleDownloadDisavow}
            className="shrink-0 bg-warn hover:bg-warn/90 text-white"
          >
            Disavow Dosyası Oluştur (.txt)
          </Button>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-1.5 bg-surface-subtle p-1 rounded-xl border border-line">
          {[
            { id: "ALL", label: `Tümü (${backlinks.length})` },
            { id: "TOXIC", label: `🚨 Toksik / Zararlı (${toxicCount})` },
            { id: "DOFOLLOW", label: `Dofollow (${dofollowCount})` },
            { id: "NOFOLLOW", label: `Nofollow (${backlinks.length - dofollowCount})` },
            { id: "HIGH_DR", label: "Otoriter (DR > 60)" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filter === f.id
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted hover:text-ink hover:bg-surface"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Input
            placeholder="Domain veya anchor text ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Backlinks Table Panel */}
      <Panel flush title={`Geri Bağlantılar (${filteredLinks.length})`} sub="Sitenize doğrudan bağlantı veren sayfalar ve metinler">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-subtle border-b border-line text-muted uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Kaynak Sayfa & Domain</th>
                <th className="py-3 px-3">Bağlantı Metni (Anchor)</th>
                <th className="py-3 px-3 text-center">DR / Otorite</th>
                <th className="py-3 px-3 text-center">Spam Skoru</th>
                <th className="py-3 px-3">Tür</th>
                <th className="py-3 px-3">Durum & Risk</th>
                <th className="py-3 px-4 text-right">İlk Görülme</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredLinks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">
                    Filtre kriterlerine uygun backlink bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredLinks.map((item) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-surface-subtle transition-colors ${
                      item.is_toxic ? "bg-warn/5" : ""
                    }`}
                  >
                    <td className="py-3 px-4 max-w-[260px]">
                      <div className="font-semibold text-ink flex items-center gap-1.5 truncate">
                        <span>{item.source_domain}</span>
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted hover:text-accent"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="text-muted font-mono text-[11px] truncate" title={item.source_url}>
                        {item.source_url.replace(/^https?:\/\//, "")}
                      </div>
                    </td>

                    <td className="py-3 px-3 max-w-[220px]">
                      <div className="font-medium text-ink truncate" title={item.anchor_text}>
                        "{item.anchor_text}"
                      </div>
                      <div className="mt-1">
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface border border-line text-muted">
                          {item.anchor_category}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="font-mono font-bold text-ink">
                        {item.domain_authority}
                      </span>
                      <span className="text-[10px] text-muted block">UR: {item.page_authority}</span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          item.spam_score > 60
                            ? "bg-warn/20 text-warn"
                            : item.spam_score > 25
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-evidence/20 text-evidence"
                        }`}
                      >
                        %{item.spam_score}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <Badge tone={item.is_dofollow ? "evidence" : "neutral"}>
                        {item.is_dofollow ? "Dofollow" : "Nofollow"}
                      </Badge>
                    </td>

                    <td className="py-3 px-3">
                      {item.is_toxic ? (
                        <div>
                          <Badge tone="warn">Toksik Link</Badge>
                          {item.toxicity_reasons.length > 0 && (
                            <p className="text-[10px] text-warn mt-1 max-w-[180px] leading-tight">
                              {item.toxicity_reasons[0]}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Badge tone="evidence">Güvenli</Badge>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono text-muted text-[11px]">
                      {item.first_seen}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Add Backlink Modal */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Yeni Backlink Kaynağı Tara"
      >
        <p className="text-xs text-muted mb-4">
          Harici bir web sitesinden alan adınıza gelen yeni bir bağlantıyı anlık analiz edin.
        </p>
        <form onSubmit={handleAddBacklink} className="space-y-4">
          <div>
            <Label htmlFor="source_url">Kaynak Web Sayfası URL</Label>
            <Input
              id="source_url"
              placeholder="https://example.com/blog-post-with-link"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              required
            />
          </div>

          <div>
            <Label htmlFor="anchor_text">Bağlantı Metni (Anchor Text)</Label>
            <Input
              id="anchor_text"
              placeholder="Örn: En İyi SEO Platformu"
              value={newAnchor}
              onChange={(e) => setNewAnchor(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={() => setIsAddModalOpen(false)}>
              İptal
            </Button>
            <Button variant="primary" type="submit">
              Analiz Et ve Ekle
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
