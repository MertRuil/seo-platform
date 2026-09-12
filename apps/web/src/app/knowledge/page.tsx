"use client";

import React, { useEffect, useState } from "react";
import { BookOpen, ShieldCheck, Search, CheckCircle2, XCircle, ExternalLink, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE_URL } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, Inset } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Notice } from "@/components/ui/States";

interface SourceItem {
  id: string;
  title: string;
  canonical_url: string;
  authority_level: string;
  status: string;
}

interface SearchChunk {
  chunk_id: string;
  document_title: string;
  heading_path: string[];
  content: string;
  score: number;
  canonical_url: string;
  authority_level: string;
  verification_status: string;
}

interface StatsData {
  total_chunks: number;
  active_chunks: number;
  deprecated_chunks: number;
  verified_chunks: number;
  level_1_official_chunks: number;
  rate_limit_metrics?: { current_rpm: number; rpm_limit: number; daily_request_budget: number; requests_today: number; request_quota_used_pct: number };
}

interface IngestResult {
  verification_status: string;
  chunks_ingested?: number;
  reasons?: string[];
}

const FALLBACK_SOURCES: SourceItem[] = [
  { id: "s1", title: "Google Search Central: Yinelenen URL'leri Birleştirme (Kanonikleştirme)", authority_level: "LEVEL_1_OFFICIAL", status: "ACTIVE", canonical_url: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls" },
  { id: "s2", title: "Google Search Central: Robots.txt Teknik Şartnamesi (RFC 9309)", authority_level: "LEVEL_1_OFFICIAL", status: "ACTIVE", canonical_url: "https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt" },
  { id: "s3", title: "Google Search Central: Robots Meta Etiketleri ve X-Robots-Tag", authority_level: "LEVEL_1_OFFICIAL", status: "ACTIVE", canonical_url: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag" },
  { id: "s4", title: "Google Search Central: Yapılandırılmış Veriye Giriş & Schema.org JSON-LD", authority_level: "LEVEL_1_OFFICIAL", status: "ACTIVE", canonical_url: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data" },
  { id: "s5", title: "W3C & Google: Core Web Vitals Performans Eşikleri", authority_level: "LEVEL_1_OFFICIAL", status: "ACTIVE", canonical_url: "https://developers.google.com/search/docs/appearance/core-web-vitals" },
  { id: "s6", title: "Google Search Central: XML Site Haritaları Protokolü", authority_level: "LEVEL_1_OFFICIAL", status: "ACTIVE", canonical_url: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview" },
  { id: "s7", title: "Google Search Central: Çok Dilli ve Çok Bölgeli Siteler (hreflang)", authority_level: "LEVEL_1_OFFICIAL", status: "ACTIVE", canonical_url: "https://developers.google.com/search/docs/specialty/international/localized-versions" },
  { id: "s8", title: "Google Search: rel=next / rel=prev Sayfalama Yönergesi (emekli)", authority_level: "LEVEL_1_OFFICIAL", status: "DEPRECATED", canonical_url: "https://developers.google.com/search/docs/historical/rel-next-prev" },
  { id: "s9", title: "Google Search: Meta Keywords Etiketi (kullanımdan kalktı)", authority_level: "LEVEL_1_OFFICIAL", status: "DEPRECATED", canonical_url: "https://developers.google.com/search/docs/historical/meta-keywords" },
];

export default function BilgiTabaniPage() {
  const { user, token } = useAuth();
  const canIngest = Boolean(user?.isAdmin || user?.isSuperAdmin || user?.role?.toLowerCase().includes("yönetici") || user?.role === "SEO_MANAGER");

  const [sources, setSources] = useState<SourceItem[]>(FALLBACK_SOURCES);
  const [stats, setStats] = useState<StatsData>({ total_chunks: 44, active_chunks: 39, deprecated_chunks: 5, verified_chunks: 39, level_1_official_chunks: 44 });
  const [live, setLive] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchChunk[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestUrl, setIngestUrl] = useState("");
  const [ingestContent, setIngestContent] = useState("");
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [ingesting, setIngesting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const s = await fetch(`${API_BASE_URL}/knowledge/stats`);
        if (s.ok) {
          setStats(await s.json());
          setLive(true);
        }
        const r = await fetch(`${API_BASE_URL}/knowledge/sources`);
        if (r.ok) {
          const j = await r.json();
          if (j.sources?.length) setSources(j.sources);
        }
      } catch {
        /* varsayılan liste kalır */
      }
    }
    load();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/knowledge/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, top_k: 4 }) });
      if (!res.ok) throw new Error("Arama başarısız oldu.");
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Arka uca ulaşılamadı.");
    } finally {
      setSearching(false);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestTitle || !ingestContent || !ingestUrl) return;
    setIngesting(true);
    setIngestResult(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE_URL}/knowledge/verify-and-ingest`, { method: "POST", headers, body: JSON.stringify({ title: ingestTitle, canonical_url: ingestUrl, content: ingestContent, status: "ACTIVE" }) });
      const data = await res.json();
      if (!res.ok) {
        setIngestResult({ verification_status: "REJECTED", reasons: [data.detail || "Yetkilendirme veya doğrulama hatası."] });
        return;
      }
      setIngestResult(data);
      if (data.verification_status === "VERIFIED") {
        setStats((prev) => ({ ...prev, total_chunks: prev.total_chunks + (data.chunks_ingested || 1), verified_chunks: prev.verified_chunks + (data.chunks_ingested || 1) }));
      }
    } catch (err) {
      setIngestResult({ verification_status: "ERROR", reasons: ["API bağlantı hatası: " + (err instanceof Error ? err.message : String(err))] });
    } finally {
      setIngesting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {!live && <Notice tone="warn">Bilgi tabanı arka ucuna ulaşılamadı; kaynak listesi ve sayılar varsayılan değerler.</Notice>}
      <PageHeader
        icon={<BookOpen className="w-5 h-5" />}
        title="Bilgi tabanı (RAG)"
        description="Ajanların gerekçe için kullandığı resmi kaynaklar: hibrit arama (BM25 + vektör) ve yeni bilgi için doğrulama kapısı."
      />

      <MetricStrip
        items={[
          { label: "Doğrulanmış parça", value: stats.verified_chunks, hint: "BM25 + vektör" },
          { label: "Seviye-1 resmi doküman", value: stats.level_1_official_chunks, hint: "Google Search Central & RFC" },
          { label: "Kullanımdan kalkan parça", value: stats.deprecated_chunks, tone: "muted", hint: "eski yönergeler ayrı tutulur" },
          { label: "Günlük istek", value: stats.rate_limit_metrics ? `${stats.rate_limit_metrics.requests_today} / ${stats.rate_limit_metrics.daily_request_budget}` : "— / 1.500", hint: "oran sınırı" },
        ]}
      />

      <Panel title="Bilgi tabanında ara" sub="Ajanların kullandığı kaynakları anlık sorgulayın">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Örn: duplicate content canonical self-referential" aria-label="Arama sorgusu" />
          <Button type="submit" loading={searching} icon={<Search className="w-3.5 h-3.5" />} className="shrink-0">
            Sorgula
          </Button>
        </form>
        {searchError && (
          <Notice tone="error" className="mt-3">
            {searchError}
          </Notice>
        )}
        {results.length > 0 && (
          <div className="mt-4">
            <div className="font-mono text-2xs uppercase tracking-wider text-muted mb-2">{results.length} parça</div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {results.map((r, i) => (
                <li key={i}>
                  <Inset className="space-y-1.5 h-full">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-accent-ink">{r.document_title}</span>
                      <Badge tone="evidence" mono>
                        {r.score}
                      </Badge>
                    </div>
                    <div className="font-mono text-2xs text-muted">{r.heading_path.join(" › ")}</div>
                    <p className="text-sm text-muted line-clamp-3">{r.content}</p>
                    <a href={r.canonical_url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-accent-ink hover:underline inline-flex items-center gap-1">
                      Resmi kaynak <ExternalLink className="w-3 h-3" aria-hidden />
                    </a>
                  </Inset>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Panel>

      <Panel title="Yeni bilgi doğrulama kapısı" sub="Bir SEO iddiasını sunun; doğrulama motoru resmi kaynaklarla karşılaştırıp kabul ya da reddeder.">
        {canIngest ? (
          <form onSubmit={handleIngest} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="ing-title">Doküman başlığı</Label>
                <Input id="ing-title" value={ingestTitle} onChange={(e) => setIngestTitle(e.target.value)} placeholder="Google Search Central: Sitemaps Protocol Update" required />
              </div>
              <div>
                <Label htmlFor="ing-url">Kanonik URL</Label>
                <Input id="ing-url" type="url" value={ingestUrl} onChange={(e) => setIngestUrl(e.target.value)} placeholder="https://developers.google.com/search/docs/…" mono required />
              </div>
            </div>
            <div>
              <Label htmlFor="ing-content">İçerik / iddia metni</Label>
              <Textarea id="ing-content" value={ingestContent} onChange={(e) => setIngestContent(e.target.value)} rows={3} placeholder="Doğrulanacak içerik veya SEO önermesi" required />
            </div>
            <Button type="submit" variant="evidence" loading={ingesting} icon={<ShieldCheck className="w-3.5 h-3.5" />}>
              Doğrula ve ekle
            </Button>
          </form>
        ) : (
          <Inset className="flex items-start gap-3 text-sm">
            <Lock className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden />
            <div>
              <div className="font-semibold text-ink">Doğrulama kapısı yönetici yetkisi gerektirir</div>
              <p className="text-muted">Yeni kural eklemek platform ve SEO yöneticilerine açıktır; mevcut kaynakları yukarıdan arayabilirsiniz.</p>
            </div>
          </Inset>
        )}

        {ingestResult && (
          <div className="mt-4">
            <Notice tone={ingestResult.verification_status === "VERIFIED" ? "success" : "error"}>
              <div className="inline-flex items-center gap-2">
                {ingestResult.verification_status === "VERIFIED" ? <CheckCircle2 className="w-4 h-4" aria-hidden /> : <XCircle className="w-4 h-4" aria-hidden />}
                {ingestResult.verification_status === "VERIFIED" ? `Doğrulandı: ${ingestResult.chunks_ingested} parça eklendi.` : "Reddedildi: iddia resmi kaynaklarla desteklenmiyor."}
              </div>
              {ingestResult.reasons && ingestResult.reasons.length > 0 && (
                <ul className="list-disc list-inside mt-1 font-normal text-xs">
                  {ingestResult.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </Notice>
          </div>
        )}
      </Panel>

      <Panel flush title={`Resmi kaynaklar (${sources.length})`} sub="Yalnızca Seviye-1 resmi standartlar">
        <ul className="divide-y divide-line">
          {sources.map((k) => (
            <li key={k.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-surface-2 transition-colors">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">{k.title}</div>
                <a href={k.canonical_url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-accent-ink truncate block hover:underline">
                  {k.canonical_url}
                </a>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge tone="accent" mono>
                  {k.authority_level.replace("_", " ")}
                </Badge>
                <Badge tone={k.status === "ACTIVE" ? "evidence" : "neutral"} mono>
                  {k.status === "ACTIVE" ? "AKTİF" : "ESKİ"}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
