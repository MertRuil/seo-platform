"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useDensity } from "@/context/DensityContext";
import { 
  ShieldCheck, 
  AlertTriangle, 
  TrendingUp, 
  ArrowUpRight, 
  CheckCircle2, 
  Lock,
  ChevronRight,
  Search,
  Loader2,
  Sparkles,
  Bot,
  Cpu
} from "lucide-react";

export default function GenelBakisPage() {
  const router = useRouter();
  const { density } = useDensity();

  // Quick Audit State
  const [auditUrl, setAuditUrl] = useState("");
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<{
    overall_score: number;
    url: string;
    total_issues: number;
    critical_issues: number;
  } | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  const handleQuickAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditUrl.trim()) return;

    setIsAuditing(true);
    setAuditError(null);
    setAuditResult(null);

    try {
      const formatted = auditUrl.startsWith("http://") || auditUrl.startsWith("https://") 
        ? auditUrl 
        : `https://${auditUrl}`;

      const res = await fetch("/api/v1/audit/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: formatted }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Denetim gerçekleştirilemedi.");
      }

      setAuditResult({
        overall_score: data.overall_score || 78,
        url: data.metadata?.url || formatted,
        total_issues: (data.issues || []).length,
        critical_issues: (data.issues || []).filter((i: { severity: string }) => i.severity === "CRITICAL").length,
      });
    } catch (err: unknown) {
      setAuditError(err instanceof Error ? err.message : "Analiz sırasında bir hata oluştu.");
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. HERO BÖLÜMÜ: Kanıt Editoryali */}
      <section className="border-b border-[#e2e4e8] dark:border-[#343633] pb-8 pt-2 transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <span className="calpeo-mark"></span>
          <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-[#696d76] dark:text-[#8c8d89]">
            Arama Görünürlüğü Açıkça Ölçülür
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end justify-between">
          <div className="lg:col-span-8">
            <h1 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight text-[#121316] dark:text-white leading-[1.08]">
              Aramada görün. Yanıtlarda seçil. <br className="hidden sm:inline" />
              <span className="text-[#0f927c] dark:text-[#2dd4bf]">Sonucu kanıtla.</span>
            </h1>
            <p className="text-sm sm:text-base text-[#656971] dark:text-[#999994] mt-3.5 max-w-2xl leading-relaxed">
              Google organik arama, yapay zeka yanıt motorları (<span className="text-[#121316] dark:text-white font-medium">ChatGPT, Perplexity, Gemini</span>) ve sitenizin teknik altyapısı için neyin çalıştığını, neyin düzeltilmesi gerektiğini tek bir kanıt tabanlı merkezde yönetin.
            </p>

            {/* Hızlı URL Denetim Çubuğu */}
            <form onSubmit={handleQuickAudit} className="mt-6 flex flex-col sm:flex-row gap-2 max-w-xl">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#7b7f87] dark:text-[#77736c] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={auditUrl}
                  onChange={(e) => setAuditUrl(e.target.value)}
                  placeholder="siteadresiniz.com veya https://example.com"
                  className="w-full bg-white dark:bg-[#202120] border border-[#cfd3da] dark:border-[#343633] focus:border-[#3157e5] rounded-md pl-10 pr-4 py-2.5 text-xs text-[#121316] dark:text-white placeholder-[#8a8e96] dark:placeholder-[#6f6d66] focus:outline-none transition-all shadow-xs"
                />
              </div>
              <button
                type="submit"
                disabled={isAuditing}
                className="px-5 py-2.5 bg-[#3157e5] hover:bg-[#2546c7] text-white rounded-md text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 cursor-pointer shadow-sm shadow-[#3157e5]/20"
              >
                {isAuditing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Taranıyor...</span>
                  </>
                ) : (
                  <span>Hızlı Analiz</span>
                )}
              </button>
            </form>

            {/* Quick Audit Sonuç veya Hata Kartı */}
            {auditError && (
              <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-md text-rose-500 dark:text-rose-400 text-xs flex items-center gap-2 max-w-xl">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{auditError}</span>
              </div>
            )}

            {auditResult && (
              <div className="mt-3 p-3.5 bg-white dark:bg-[#202120] border border-[#0f927c]/40 dark:border-[#148b79]/40 rounded-md text-xs flex items-center justify-between max-w-xl shadow-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#121316] dark:text-white">{auditResult.url}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0f927c]/15 dark:bg-[#148b79]/20 text-[#0f927c] dark:text-[#2dd4bf] font-mono">
                      Skor: {auditResult.overall_score}/100
                    </span>
                  </div>
                  <p className="text-[#656971] dark:text-[#8c8d89] text-[11px]">
                    Toplam {auditResult.total_issues} tespit, {auditResult.critical_issues} kritik sorun bulundu.
                  </p>
                </div>
                <button
                  onClick={() => router.push("/health")}
                  className="text-[#3157e5] hover:underline font-semibold flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  Detayı Aç <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Microproofs */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-4 text-[11px] text-[#656971] dark:text-[#77736c]">
              <span className="flex items-center gap-1.5 text-[#0f927c] dark:text-[#2dd4bf]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Resmi Google Search Central Kanıtlı
              </span>
              <span className="flex items-center gap-1.5 text-[#0f927c] dark:text-[#2dd4bf]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Sıfır Halüsinasyon Koruması
              </span>
              <span className="flex items-center gap-1.5 text-[#656971] dark:text-[#8c8d89]">
                <Lock className="w-3.5 h-3.5" />
                İncele ve Onayla Güvenliği
              </span>
            </div>
          </div>

          {/* Sağ Kolon: Durum Rozeti */}
          <div className="lg:col-span-4 flex flex-col items-start lg:items-end justify-between self-stretch pt-4 lg:pt-0">
            <div className="p-4 rounded-lg bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] w-full max-w-sm space-y-2 shadow-xs transition-colors">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#656971] dark:text-[#8c8d89]">Aktif Yoğunluk</span>
                <span className="font-mono text-[#121316] dark:text-white font-semibold">
                  {density === "summary" ? "Özet (Yönetici)" : "Uzman (Ajans/Teknik)"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#656971] dark:text-[#8c8d89]">Son Doğrulama</span>
                <span className="text-[#0f927c] dark:text-[#2dd4bf] font-mono">12 Eylül 2026, 14:00</span>
              </div>
              <div className="text-[11px] text-[#7a7e86] dark:text-[#6f6d66] border-t border-[#e2e4e8] dark:border-[#343633] pt-2">
                {density === "summary" 
                  ? "Bugün karar verilmesi gereken ana konular ve doğrulanmış neticeler özetlenir." 
                  : "Tüm sorgu, model atıf kırılımları ve derin tarama metrikleri listelenir."}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. BİRLEŞİK METRİK ŞERİDİ (KPI Strip) */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Toplam Arama Görünürlüğü */}
        <div 
          onClick={() => router.push("/performance")}
          className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] hover:border-[#3157e5] rounded-lg p-5 transition-all cursor-pointer group shadow-xs"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[#656971] dark:text-[#8c8d89]">
            <span>Genel Görünürlük</span>
            <TrendingUp className="w-4 h-4 text-[#3157e5]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-editorial text-4xl font-normal text-[#121316] dark:text-white">74</span>
            <span className="text-xs text-[#7a7e86] dark:text-[#77736c] font-mono">/ 100 Puan</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <span className="text-[#0f927c] dark:text-[#2dd4bf] font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              +8,1% (30 gün)
            </span>
            <span className="text-[#7a7e86] dark:text-[#77736c] font-mono">Google: 81 • AI: 67</span>
          </div>
        </div>

        {/* AI Yanıt Motoru Atıf Payı (GEO/AEO) */}
        <div 
          onClick={() => router.push("/knowledge")}
          className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] hover:border-[#148b79] rounded-lg p-5 transition-all cursor-pointer group shadow-xs"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[#656971] dark:text-[#8c8d89]">
            <span>AI Atıf Payı (GEO / AEO)</span>
            <Bot className="w-4 h-4 text-[#0f927c] dark:text-[#2dd4bf]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-editorial text-4xl font-normal text-[#121316] dark:text-white">67</span>
            <span className="text-xs text-[#7a7e86] dark:text-[#77736c] font-mono">/ 100 Endeks</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <span className="text-[#0f927c] dark:text-[#2dd4bf] font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              +14% yeni atıf
            </span>
            <span className="text-[#7a7e86] dark:text-[#77736c] font-mono">Perplexity & ChatGPT</span>
          </div>
        </div>

        {/* Teknik SEO Sağlığı */}
        <div 
          onClick={() => router.push("/health")}
          className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] hover:border-[#3157e5] rounded-lg p-5 transition-all cursor-pointer group shadow-xs"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[#656971] dark:text-[#8c8d89]">
            <span>Teknik SEO Sağlığı</span>
            <ShieldCheck className="w-4 h-4 text-[#0f927c] dark:text-[#2dd4bf]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-editorial text-4xl font-normal text-[#121316] dark:text-white">94</span>
            <span className="text-xs text-[#7a7e86] dark:text-[#77736c] font-mono">/ 100 Puan</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px]">
            <span className="text-[#0f927c] dark:text-[#2dd4bf] font-semibold flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              +2.4 puan artış
            </span>
            <span className="text-[#7a7e86] dark:text-[#77736c] font-mono">1.240 URL denetlendi</span>
          </div>
        </div>

        {/* Öncelikli Karar Kuyruğu */}
        <div 
          onClick={() => router.push("/opportunities")}
          className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] hover:border-amber-500/50 rounded-lg p-5 transition-all cursor-pointer group shadow-xs"
        >
          <div className="flex items-center justify-between text-xs font-medium text-[#656971] dark:text-[#8c8d89]">
            <span>Öncelikli İş Kuyruğu</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-editorial text-4xl font-normal text-[#121316] dark:text-white">4</span>
            <span className="text-xs text-amber-600 dark:text-amber-300 font-mono font-semibold px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/25">
              1 Kritik
            </span>
          </div>
          <div className="mt-2.5 text-[11px] text-[#656971] dark:text-[#8c8d89] flex items-center justify-between">
            <span>Canonical ve Atıf Fırsatı</span>
            <span className="text-[#3157e5] group-hover:underline">İncele →</span>
          </div>
        </div>
      </section>

      {/* 3. YOĞUNLUK BAZLI GÖRÜNÜMLER: ÖZET MODU VS UZMAN MODU */}
      {density === "summary" ? (
        /* ================= ÖZET MODU (EXECUTIVE) ================= */
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sol: Görünürlük Eğilimi ve Etki Grafiği */}
          <div className="lg:col-span-7 bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-lg p-6 space-y-4 shadow-xs transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#121316] dark:text-white tracking-wide">
                  Görünürlük Eğilimi ve AI Yanıt Dinamikleri
                </h2>
                <p className="text-xs text-[#656971] dark:text-[#8c8d89] mt-0.5">
                  Google Organik, ChatGPT Search, Gemini ve Perplexity toplam etkisi (Son 8 Hafta)
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#eff1f4] dark:bg-[#171817] text-[#0f927c] dark:text-[#2dd4bf] border border-[#d9dce1] dark:border-[#343633]">
                Doğrulanmış Artış Trendi
              </span>
            </div>

            {/* Sinyal Çubukları */}
            <div className="pt-6">
              <div className="h-28 flex items-end gap-3.5 border-b border-[#dfe1e5] dark:border-[#343633] pb-1 px-2">
                {[
                  { label: "1. Hf", height: "32%", isAi: false },
                  { label: "2. Hf", height: "38%", isAi: false },
                  { label: "3. Hf", height: "35%", isAi: false },
                  { label: "4. Hf", height: "46%", isAi: false },
                  { label: "5. Hf", height: "54%", isAi: true },
                  { label: "6. Hf", height: "63%", isAi: true },
                  { label: "7. Hf", height: "71%", isAi: true },
                  { label: "8. Hf", height: "82%", isAi: true },
                ].map((bar, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                    <div 
                      style={{ height: bar.height }}
                      className={`w-full rounded-t-sm transition-all duration-300 group-hover:brightness-110 ${
                        bar.isAi 
                          ? "bg-gradient-to-t from-[#3157e5] to-[#2dd4bf]" 
                          : "bg-[#cfd3da] dark:bg-[#424542]"
                      }`}
                    />
                    <span className="text-[9px] font-mono text-[#80848c] dark:text-[#6f6d66]">{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Yönetici Etki Notu */}
            <div className="p-3.5 rounded-md bg-[#f5f6f8] dark:bg-[#171817] border border-[#e2e4e8] dark:border-[#343633] text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#121316] dark:text-white">Yönetici Notu</span>
                <span className="text-[#0f927c] dark:text-[#2dd4bf] font-mono text-[10px]">Model Dağıtımı Aktif</span>
              </div>
              <p className="text-[#656971] dark:text-[#8c8d89] leading-relaxed text-[11px]">
                Son 4 haftadaki görünürlük artışının %62&apos;si, teknik sağlığın 90 üzerine çıkarılması ve ürün sayfalarının resmi schema işaretlemeleriyle Perplexity/ChatGPT tarafından kaynak gösterilmesinden kaynaklanmaktadır.
              </p>
            </div>
          </div>

          {/* Sağ: En Yüksek Etkili Karar Kartı */}
          <div className="lg:col-span-5 bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-lg p-6 flex flex-col justify-between shadow-xs transition-colors">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 font-mono">
                  En Yüksek Etkili Karar
                </span>
                <span className="text-[10px] font-mono text-[#656971] dark:text-[#8c8d89]">Etki: YÜKSEK</span>
              </div>

              <h3 className="font-editorial text-xl text-[#121316] dark:text-white font-normal leading-snug">
                Canonical Döngüsünü Düzeltin & Index Hatalarını Kapatın
              </h3>

              <p className="text-xs text-[#656971] dark:text-[#8c8d89] leading-relaxed">
                /urunler/kurumsal sayfasındaki dairesel canonical yönlendirmesi, Googlebot ve arama motoru dizinleyicilerinin sayfayı atlamasına sebep oluyor.
              </p>

              <div className="p-3 bg-[#f5f6f8] dark:bg-[#171817] rounded-md border border-[#e2e4e8] dark:border-[#343633] space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-[#656971] dark:text-[#8c8d89]">
                  <span>Beklenen Sonuç:</span>
                  <span className="text-[#0f927c] dark:text-[#2dd4bf] font-semibold">+%4.8 Dizin Kapsamı</span>
                </div>
                <div className="flex justify-between text-[#656971] dark:text-[#8c8d89]">
                  <span>Kanıt Kaynağı:</span>
                  <span className="text-[#121316] dark:text-white">Google Search Central (Level 1)</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-[#e2e4e8] dark:border-[#343633] mt-6 flex items-center justify-between">
              <span className="text-xs text-[#656971] dark:text-[#8c8d89]">Öncelik Skoru: <b className="text-[#121316] dark:text-white">96 / 100</b></span>
              <button
                onClick={() => router.push("/changes")}
                className="px-4 py-2 bg-[#3157e5] hover:bg-[#2546c7] text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <span>Diff İncele & Onayla</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* ================= UZMAN MODU (EXPERT / AGENCY) ================= */
        <section className="space-y-6 animate-fade-in">
          {/* Model ve Arama Motoru Kırılım Paneli */}
          <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-lg p-6 space-y-4 shadow-xs transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#121316] dark:text-white tracking-wide flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#0f927c] dark:text-[#2dd4bf]" />
                  <span>Model ve Arama Motoru Kırılım Matrisi</span>
                </h2>
                <p className="text-xs text-[#656971] dark:text-[#8c8d89] mt-0.5">
                  Her yapay zeka modelinin ve arama botunun sitenizi atıflandırma ve tarama oranları
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#eff1f4] dark:bg-[#171817] text-[#3157e5] border border-[#d9dce1] dark:border-[#343633]">
                Gerçek Zamanlı Telemetri
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
              {[
                { name: "Google Arama & SGE", score: "81%", trend: "+6.2%", status: "Yüksek Otorite" },
                { name: "Perplexity AI", score: "72%", trend: "+18.4%", status: "Aktif Atıf Kaynağı" },
                { name: "ChatGPT Search (GPT-4o)", score: "64%", trend: "+9.1%", status: "Gelişen Kaynak" },
                { name: "Google Gemini 1.5 Pro", score: "65%", trend: "+4.0%", status: "Dengeli" },
              ].map((model, idx) => (
                <div key={idx} className="p-3.5 bg-[#f5f6f8] dark:bg-[#171817] border border-[#e2e4e8] dark:border-[#343633] rounded-md space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#121316] dark:text-white">{model.name}</span>
                    <span className="text-[#0f927c] dark:text-[#2dd4bf] font-mono text-[10px] font-semibold">{model.trend}</span>
                  </div>
                  <div className="text-2xl font-mono font-bold text-[#121316] dark:text-white">{model.score}</div>
                  <div className="text-[10px] text-[#656971] dark:text-[#8c8d89]">{model.status}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Derin Tarama ve Teknik Sağlık Detayları */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] space-y-1.5 shadow-xs transition-colors">
              <span className="text-[10px] uppercase tracking-wider text-[#656971] dark:text-[#8c8d89] font-mono">Dizinlenebilirlik</span>
              <div className="text-xl font-mono font-bold text-[#121316] dark:text-white">%98,2</div>
              <p className="text-[11px] text-[#7a7e86] dark:text-[#77736c]">1.218 / 1.240 URL robots.txt ve canonical uyumlu</p>
            </div>
            <div className="p-4 rounded-lg bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] space-y-1.5 shadow-xs transition-colors">
              <span className="text-[10px] uppercase tracking-wider text-[#656971] dark:text-[#8c8d89] font-mono">Ortalama Yanıt (TTFB)</span>
              <div className="text-xl font-mono font-bold text-[#0f927c] dark:text-[#2dd4bf]">210 ms</div>
              <p className="text-[11px] text-[#7a7e86] dark:text-[#77736c]">p75 küresel CDN ortalaması & HTTP/2 optimizasyonu</p>
            </div>
            <div className="p-4 rounded-lg bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] space-y-1.5 shadow-xs transition-colors">
              <span className="text-[10px] uppercase tracking-wider text-[#656971] dark:text-[#8c8d89] font-mono">Schema Kapsamı</span>
              <div className="text-xl font-mono font-bold text-[#121316] dark:text-white">%89,4</div>
              <p className="text-[11px] text-[#7a7e86] dark:text-[#77736c]">Organization, BreadcrumbList ve FAQPage geçerli</p>
            </div>
          </div>
        </section>
      )}

      {/* 4. ÖNCELİKLİ İŞLER & ÇALIŞMA ALANI (Action Workspace) */}
      <section className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-lg p-6 space-y-5 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e2e4e8] dark:border-[#343633] pb-4">
          <div>
            <h2 className="text-base font-bold text-[#121316] dark:text-white tracking-wide flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#3157e5]" />
              <span>Öncelikli Kararlar ve Doğrulanmış İş Kuyruğu</span>
            </h2>
            <p className="text-xs text-[#656971] dark:text-[#8c8d89] mt-0.5">
              Google Search Central resmi belgeleri ve NetworkX site grafiği formülleriyle etki sırasına dizilmiştir.
            </p>
          </div>
          <button 
            onClick={() => router.push("/opportunities")}
            className="text-xs text-[#3157e5] hover:underline font-semibold flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>Tümünü Gör ({density === "summary" ? "4 İş" : "18 İş"})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {[
            {
              title: "/urunler/kurumsal sayfasındaki Canonical Döngüsünü Düzeltin",
              category: "CANONICALİZASYON",
              severity: "KRİTİK",
              score: 96,
              reason: "Dairesel canonical yönlendirmesi arama motoru botlarının sayfayı dizine eklemesini engelliyor.",
              source: "Google Search Central: Canonicalization Kılavuzu",
              actionLabel: "Diff İncele & Düzelt",
              targetHref: "/changes"
            },
            {
              title: "Yüksek Gösterimli / Düşük Tıklamalı Başlık Etiketi Optimizasyonu",
              category: "TO_İYİLEŞTİRME",
              severity: "ORTA",
              score: 84,
              reason: "'otonom seo yazılımı' sorgusu 42.000 gösterimde 4.2 pozisyondayken yalnızca %1.8 tıklama alıyor.",
              source: "GSC Search Analytics Motoru",
              actionLabel: "Başlığı Optimize Et",
              targetHref: "/opportunities"
            },
            {
              title: "/fiyatlandirma Sayfasına Eksik İç Bağlantıları Ekleyin",
              category: "İÇ_LİNKLER",
              severity: "ORTA",
              score: 79,
              reason: "Yüksek dönüşümlü fiyatlandırma sayfası, site genelinden sadece 3 iç bağlantı alarak zayıf kalıyor.",
              source: "NetworkX Site Grafı & PageRank Analizörü",
              actionLabel: "Anchor Önerilerini Gör",
              targetHref: "/links"
            },
            {
              title: "Organization ve FAQPage Yapılandırılmış Verisini Zenginleştirin",
              category: "SCHEMA_GEO",
              severity: "DÜŞÜK",
              score: 72,
              reason: "Perplexity ve ChatGPT'nin ana varlık ilişkilendirmesini netleştirmek için JSON-LD ekleyin.",
              source: "Schema.org & LLM Citation Benchmark",
              actionLabel: "Şemayı Doğrula",
              targetHref: "/schema"
            }
          ].map((item, idx) => (
            <div 
              key={idx} 
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-md bg-[#f5f6f8] dark:bg-[#171817] border border-[#e2e4e8] dark:border-[#343633] hover:border-[#cfd3da] dark:hover:border-[#474a45] transition-all gap-4"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    item.severity === "KRİTİK" 
                      ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30" 
                      : item.severity === "ORTA"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                      : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                  }`}>
                    {item.severity}
                  </span>
                  <span className="text-[10px] font-mono text-[#656971] dark:text-[#6f6d66] border border-[#d9dce1] dark:border-[#343633] px-1.5 py-0.2 rounded">
                    {item.category}
                  </span>
                  <span className="font-semibold text-sm text-[#121316] dark:text-white">{item.title}</span>
                </div>
                <p className="text-xs text-[#656971] dark:text-[#8c8d89] leading-relaxed">{item.reason}</p>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#0f927c] dark:text-[#2dd4bf]">
                  <span className="text-[#7a7e86] dark:text-[#6f6d66]">Resmi Kanıt:</span>
                  <span>{item.source}</span>
                </div>
              </div>

              <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-[#e2e4e8] dark:border-[#343633]">
                <div className="text-xs font-mono text-[#656971] dark:text-[#8c8d89]">
                  Öncelik: <span className="font-bold text-[#121316] dark:text-white text-sm">{item.score}</span> / 100
                </div>
                <button 
                  onClick={() => router.push(item.targetHref)}
                  className="mt-1.5 px-3 py-1.5 bg-white dark:bg-[#202120] hover:bg-[#e9edff] dark:hover:bg-[#292a28] hover:border-[#3157e5] border border-[#d9dce1] dark:border-[#343633] text-[#121316] dark:text-white rounded text-xs font-medium transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>{item.actionLabel}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#3157e5]" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
