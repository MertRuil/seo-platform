"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Activity,
  Layers,
  Send,
  Loader2
} from "lucide-react";

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
  rate_limit_metrics?: {
    current_rpm: number;
    rpm_limit: number;
    daily_request_budget: number;
    requests_today: number;
    request_quota_used_pct: number;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const FALLBACK_SOURCES: SourceItem[] = [
  { id: "s1", title: "Google Search Central: Yinelenen URL'leri Birleştirme (Kanonikleştirme)", authority_level: "LEVEL_1_OFFICIAL", status: "ACTIVE", canonical_url: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls" },
  { id: "s2", title: "Google Search Central: Robots.txt Teknik Şartnamesi (RFC 9309)", authority_level: "LEVEL_1_OFFICIAL", status: "ACTIVE", canonical_url: "https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt" },
  { id: "s3", title: "Google Search Central: Robots Meta Etiketleri ve X-Robots-Tag", authority_level: "LEVEL_1_OFFICIAL", status: "ACTIVE", canonical_url: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag" },
  { id: "s4", title: "Google Search Central: Yapılandırılmış Veriye Giriş & Schema.org JSON-LD", authority_level: "LEVEL_1_OFFICIAL", status: "ACTIVE", canonical_url: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data" },
  { id: "s5", title: "W3C & Google: Core Web Vitals (CWV) Performans Eşikleri", authority_level: "LEVEL_1_OFFICIAL", status: "ACTIVE", canonical_url: "https://developers.google.com/search/docs/appearance/core-web-vitals" },
  { id: "s6", title: "Google Search Central: XML Site Haritaları Protokolü (50k/50MB Sınırları)", authority_level: "LEVEL_1_OFFICIAL", status: "ACTIVE", canonical_url: "https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview" },
  { id: "s7", title: "Google Search Central: Çok Dilli ve Çok Bölgeli Siteler (Hreflang RFC 5646)", authority_level: "LEVEL_1_OFFICIAL", status: "ACTIVE", canonical_url: "https://developers.google.com/search/docs/specialty/international/localized-versions" },
  { id: "s8", title: "Google Search: rel=next ve rel=prev Sayfalama Yönergesi (Emekliye Ayrıldı)", authority_level: "LEVEL_1_OFFICIAL", status: "DEPRECATED", canonical_url: "https://developers.google.com/search/docs/historical/rel-next-prev" },
  { id: "s9", title: "Google Search: Meta Keywords Etiketi (Kullanımdan Kaldırıldı)", authority_level: "LEVEL_1_OFFICIAL", status: "DEPRECATED", canonical_url: "https://developers.google.com/search/docs/historical/meta-keywords" }
];

export default function BilgiBeyniPage() {
  const [sources, setSources] = useState<SourceItem[]>(FALLBACK_SOURCES);
  const [stats, setStats] = useState<StatsData>({
    total_chunks: 44,
    active_chunks: 39,
    deprecated_chunks: 5,
    verified_chunks: 39,
    level_1_official_chunks: 44
  });

  // Interactive RAG Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchChunk[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Ingest & Verify state
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestUrl, setIngestUrl] = useState("");
  const [ingestContent, setIngestContent] = useState("");
  const [ingestResult, setIngestResult] = useState<any>(null);
  const [isIngesting, setIsIngesting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const statsRes = await fetch(`${API_BASE}/knowledge/stats`);
        if (statsRes.ok) {
          const statsJson = await statsRes.json();
          setStats(statsJson);
        }

        const sourcesRes = await fetch(`${API_BASE}/knowledge/sources`);
        if (sourcesRes.ok) {
          const sourcesJson = await sourcesRes.json();
          if (sourcesJson.sources && sourcesJson.sources.length > 0) {
            setSources(sourcesJson.sources);
          }
        }
      } catch (e) {
        // Fallback already pre-set
      }
    }
    loadData();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE}/knowledge/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, top_k: 4 })
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleIngestVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingestTitle || !ingestContent || !ingestUrl) return;

    setIsIngesting(true);
    setIngestResult(null);
    try {
      const res = await fetch(`${API_BASE}/knowledge/verify-and-ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: ingestTitle,
          canonical_url: ingestUrl,
          content: ingestContent,
          status: "ACTIVE"
        })
      });
      const data = await res.json();
      setIngestResult(data);
      if (data.verification_status === "VERIFIED") {
        setStats(prev => ({
          ...prev,
          total_chunks: prev.total_chunks + (data.chunks_ingested || 1),
          verified_chunks: prev.verified_chunks + (data.chunks_ingested || 1)
        }));
      }
    } catch (e) {
      setIngestResult({ verification_status: "ERROR", reasons: ["API bağlantı hatası."] });
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 px-4 sm:px-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-400" />
            <span>SEO Bilgi Beyni & Hibrit RAG Doğrulama</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Okapi BM25 + Vektör RAG mimarisi ve deterministik anti-mit doğrulama motoru.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Doğrulanmış Parça Sayısı</span>
          <div className="text-3xl font-extrabold text-white mt-2">{stats.verified_chunks} Parça</div>
          <span className="text-xs text-emerald-400">Okapi BM25 + Yoğun Vektör</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Seviye-1 Resmi Standartlar</span>
          <div className="text-3xl font-extrabold text-indigo-400 mt-2">{stats.level_1_official_chunks} Doküman</div>
          <span className="text-xs text-slate-400">Google Search Central & RFC</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Anti-Mit & Yanılsama Filtresi</span>
          <div className="text-3xl font-extrabold text-emerald-400 mt-2">%100 Aktif</div>
          <span className="text-xs text-slate-400">Asılsız iddialar elenir</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Günlük İstek Limiti</span>
          <div className="text-3xl font-extrabold text-purple-400 mt-2">
            {stats.rate_limit_metrics ? `${stats.rate_limit_metrics.requests_today}/${stats.rate_limit_metrics.daily_request_budget}` : "1.500 / Gün"}
          </div>
          <span className="text-xs text-purple-300">Token Bucket Koruması</span>
        </div>
      </div>

      {/* Interactive RAG Search */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-indigo-400" />
          <span>Hibrit RAG Semantik Arama Testi</span>
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Ajanların kullandığı resmi SEO bilgi tabanını anlık olarak sorgulayın. Okapi BM25 ve RRF sıralamasını test edin.
        </p>

        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Örn: duplicate content canonical self-referential veya robots.txt disallow vs noindex"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span>Sorgula</span>
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="mt-5 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Arama Sonuçları ({searchResults.length} Parça):</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {searchResults.map((r, i) => (
                <div key={i} className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-400">{r.document_title}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">Skor: {r.score}</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">{r.heading_path.join(" > ")}</div>
                  <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">{r.content}</p>
                  <a
                    href={r.canonical_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:underline flex items-center gap-1 pt-1"
                  >
                    <span>Resmi Kaynak Belgesi</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Live Verification & Anti-Myth Engine Playground */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>Yeni Bilgi Doğrulama & Kürasyon Kapısı</span>
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Sisteme yanlış bilgi girmesini engelleyin: Bir SEO iddiasını sisteme sunarak anti-mit denetiminden geçirin.
        </p>

        <form onSubmit={handleIngestVerify} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Doküman Başlığı</label>
              <input
                type="text"
                value={ingestTitle}
                onChange={(e) => setIngestTitle(e.target.value)}
                placeholder="Örn: Google Search Central: Sitemaps Protocol Update"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Kanonik URL (Otorite Alan Adı)</label>
              <input
                type="url"
                value={ingestUrl}
                onChange={(e) => setIngestUrl(e.target.value)}
                placeholder="https://developers.google.com/search/docs/..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Doküman İçeriği / İddia Metni</label>
            <textarea
              value={ingestContent}
              onChange={(e) => setIngestContent(e.target.value)}
              rows={3}
              placeholder="Doküman içeriğini veya doğrulamak istediğiniz SEO önermesini girin..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isIngesting}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {isIngesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>Sorgula, Doğrula ve RAG Deposuna Ekle</span>
          </button>
        </form>

        {ingestResult && (
          <div className={`mt-4 p-4 rounded-lg border ${
            ingestResult.verification_status === "VERIFIED"
              ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              : "bg-red-950/40 border-red-500/30 text-red-300"
          }`}>
            <div className="flex items-center gap-2 font-bold text-sm">
              {ingestResult.verification_status === "VERIFIED" ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>DOĞRULANDI (ONAYLANDI): {ingestResult.chunks_ingested} parça RAG deposuna eklendi!</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-400" />
                  <span>REDDEDİLDİ: Yanılsama veya asılsız SEO miti tespit edildi!</span>
                </>
              )}
            </div>
            {ingestResult.reasons && ingestResult.reasons.length > 0 && (
              <div className="mt-2 text-xs space-y-1">
                <span className="font-semibold text-slate-300">Denetim Gerekçesi:</span>
                <ul className="list-disc list-inside">
                  {ingestResult.reasons.map((r: string, idx: number) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sources List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-base">Güvenilir Resmi Bilgi Kaynakları ({sources.length})</h3>
          <span className="text-xs text-slate-400">Yalnızca Seviye-1 Resmi Standartlar</span>
        </div>
        <div className="divide-y divide-slate-800/80">
          {sources.map((k, idx) => (
            <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-all">
              <div className="space-y-1">
                <div className="font-semibold text-white text-sm">{k.title}</div>
                <div className="font-mono text-xs text-indigo-400 truncate max-w-xl">{k.canonical_url}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {k.authority_level}
                </span>
                <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                  k.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                  "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                }`}>
                  {k.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
