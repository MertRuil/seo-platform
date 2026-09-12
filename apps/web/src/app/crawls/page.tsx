"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Layers, Play, CheckCircle2, AlertTriangle, ShieldCheck, Globe, Loader2, ChevronRight } from "lucide-react";

export default function SiteTaramalariPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [hedefUrl, setHedefUrl] = useState("https://example.com");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [analizSonucu, setAnalizSonucu] = useState<any>(null);
  const [hataMesaji, setHataMesaji] = useState<string | null>(null);
  const [bildirim, setBildirim] = useState<string | null>(null);

  const handleSorunDuzeltmeSetiOlustur = (iss: any) => {
    const yeniSetId = `CS-LIVE-${Math.floor(1000 + Math.random() * 9000)}`;
    const yeniSet = {
      id: yeniSetId,
      baslik: `Canlı Tarama Düzeltmesi: ${iss.title}`,
      onem: iss.severity || "ORTA",
      etkilenenSayfa: hedefUrl,
      kategori: iss.category || "TEKNİK",
      oneri: iss.recommendation,
      durum: "BEKLİYOR",
      oncekiKod: `<!-- ${hedefUrl} üzerinde tespit edilen hata: ${iss.rule_id} -->\n${iss.description}`,
      yeniKod: `<!-- Otonom Düzeltilmiş Çözüm Kodu -->\n${iss.recommendation}`,
      olusturulmaTarihi: new Date().toLocaleTimeString("tr-TR")
    };

    try {
      const kayitli = localStorage.getItem("seo_platform_changesets") || localStorage.getItem("dentleon_changesets");
      const mevcutListe = kayitli ? JSON.parse(kayitli) : [];
      localStorage.setItem("seo_platform_changesets", JSON.stringify([yeniSet, ...mevcutListe]));
      localStorage.setItem("seo_platform_active_changeset_id", yeniSetId);
    } catch (e) {
      console.error(e);
    }

    setBildirim(`✓ "${iss.title}" için otonom düzeltme seti (#${yeniSetId}) oluşturuldu! Değişiklik sayfasına yönlendiriliyorsunuz...`);
    setTimeout(() => {
      router.push("/changes");
    }, 800);
  };

  const gecmisTaramalar = [
    { id: "CRAWL-9842", mod: "Googlebot Simülasyonu", durum: "TAMAMLANDI", sayfalar: 124, hata: 0, sure: "34 sn", tarih: "Bugün 00:15" },
    { id: "CRAWL-9820", mod: "Site Sahibi Tam Denetimi", durum: "TAMAMLANDI", sayfalar: 118, hata: 1, sure: "42 sn", tarih: "Dün 14:30" }
  ];

  const handleCanliTarama = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hedefUrl) return;

    const trimmed = hedefUrl.trim();
    if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
      setHataMesaji("Lütfen geçerli bir web adresi girin (http:// veya https:// ile başlamalıdır).");
      return;
    }

    setYukleniyor(true);
    setHataMesaji(null);
    setAnalizSonucu(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/v1/audit/quick", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: hedefUrl, max_pages: 10 })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Siteye erişilemedi veya analiz hatası oluştu.");
      }

      const data = await res.json();
      setAnalizSonucu(data);
    } catch (err: any) {
      setHataMesaji(err.message || "Bilinmeyen bir hata oluştu.");
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors">
      <div className="border-b border-[#e2e4e8] dark:border-[#343633] pb-5">
        <h1 className="text-2xl font-bold text-[#121316] dark:text-white flex items-center gap-2">
          <Layers className="w-6 h-6 text-[#3157e5] dark:text-indigo-400" />
          <span>Canlı Site Taraması & Otonom SEO Denetimi</span>
        </h1>
        <p className="text-sm text-[#656971] dark:text-[#8c8d89] mt-1">
          Dilediğiniz web sitesi adresini girin; crawler anında tarasın, deterministik kuralları çalıştırsın ve yapay zeka önerilerini çıkarsın.
        </p>
      </div>

      {bildirim && (
        <div className="p-4 rounded-xl bg-[#0f927c]/10 border border-[#0f927c]/30 text-[#0f927c] dark:text-emerald-300 text-xs flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#0f927c] dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{bildirim}</span>
          </div>
          <button
            onClick={() => router.push("/changes")}
            className="px-3 py-1 bg-[#0f927c] hover:bg-[#0c7866] text-white font-semibold rounded text-xs transition-all shrink-0 ml-4 cursor-pointer"
          >
            Hemen İncele
          </button>
        </div>
      )}

      {/* Canlı URL Giriş Kutusu */}
      <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-6 shadow-xs">
        <form onSubmit={handleCanliTarama} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#656971] dark:text-[#8c8d89] uppercase tracking-wider mb-2">
              Analiz Edilecek Hedef Web Sitesi (URL)
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Globe className="w-4 h-4 text-[#8a8e96] dark:text-[#6f6d66] absolute left-3.5 top-3.5" />
                <input
                  type="url"
                  required
                  placeholder="https://siteniz.com"
                  value={hedefUrl}
                  onChange={(e) => setHedefUrl(e.target.value)}
                  className="w-full bg-white dark:bg-[#171817] border border-[#cfd3da] dark:border-[#343633] rounded-lg pl-10 pr-4 py-3 text-sm text-[#121316] dark:text-white placeholder-[#8a8e96] dark:placeholder-[#6f6d66] focus:outline-none focus:border-[#3157e5] transition-all font-mono shadow-xs"
                />
              </div>
              <button
                type="submit"
                disabled={yukleniyor}
                className="px-6 py-3 bg-[#3157e5] hover:bg-[#2546c7] disabled:bg-[#3157e5]/50 text-white rounded-lg text-sm font-semibold transition-all shadow-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                {yukleniyor ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Canlı Taranıyor & Analiz Ediliyor...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Canlı Taramayı ve Analizi Başlat</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {hataMesaji && (
          <div className="mt-4 p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Hata: {hataMesaji}</span>
          </div>
        )}
      </div>

      {/* Canlı Analiz Sonuçları */}
      {analizSonucu && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-5 shadow-xs">
              <span className="text-xs text-[#656971] dark:text-[#8c8d89] font-medium">Teknik SEO Sağlık Skoru</span>
              <div className="text-4xl font-extrabold text-[#0f927c] dark:text-emerald-400 mt-2">
                {analizSonucu.health_score} <span className="text-xs text-[#8a8e96] dark:text-slate-500 font-normal">/ 100</span>
              </div>
              <span className="text-xs text-[#0f927c] dark:text-emerald-400 mt-1 block font-medium">Deterministik Kural Motoru</span>
            </div>

            <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-5 shadow-xs">
              <span className="text-xs text-[#656971] dark:text-[#8c8d89] font-medium">HTTP Yanıt Kodu</span>
              <div className="text-4xl font-extrabold text-[#121316] dark:text-white mt-2 font-mono">
                {analizSonucu.status_code}
              </div>
              <span className="text-xs text-[#656971] dark:text-[#8c8d89] mt-1 block">Yanıt Süresi: {analizSonucu.page_info?.response_time_ms} ms</span>
            </div>

            <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-5 shadow-xs">
              <span className="text-xs text-[#656971] dark:text-[#8c8d89] font-medium">Gövde Kelime Sayısı</span>
              <div className="text-4xl font-extrabold text-[#121316] dark:text-white mt-2 font-mono">
                {analizSonucu.page_info?.word_count || 0}
              </div>
              <span className="text-xs text-[#656971] dark:text-[#8c8d89] mt-1 block">İçerik Derinliği</span>
            </div>

            <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-5 shadow-xs">
              <span className="text-xs text-[#656971] dark:text-[#8c8d89] font-medium">Bulunan SEO Sorunları</span>
              <div className="text-4xl font-extrabold text-amber-600 dark:text-amber-400 mt-2 font-mono">
                {analizSonucu.issues?.length || 0}
              </div>
              <span className="text-xs text-amber-600 dark:text-amber-500 mt-1 block font-medium">Aksiyon Gerektiren</span>
            </div>
          </div>

          {/* Sayfa Detayları */}
          <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-6 space-y-3 shadow-xs">
            <h3 className="text-sm font-bold text-[#121316] dark:text-white uppercase tracking-wider">Taranan Sayfa Meta Verileri</h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded bg-[#f5f6f8] dark:bg-[#171817] border border-[#e2e4e8] dark:border-[#343633] flex justify-between">
                <span className="text-[#656971] dark:text-[#8c8d89]">Sayfa Başlığı (&lt;title&gt;):</span>
                <span className="text-[#121316] dark:text-white font-semibold">{analizSonucu.page_info?.title || "(Eksik)"}</span>
              </div>
              <div className="p-2.5 rounded bg-[#f5f6f8] dark:bg-[#171817] border border-[#e2e4e8] dark:border-[#343633] flex justify-between">
                <span className="text-[#656971] dark:text-[#8c8d89]">Meta Açıklaması:</span>
                <span className="text-[#121316] dark:text-white">{analizSonucu.page_info?.meta_description || "(Eksik - Arama motoru rastgele metin çekecek)"}</span>
              </div>
              <div className="p-2.5 rounded bg-[#f5f6f8] dark:bg-[#171817] border border-[#e2e4e8] dark:border-[#343633] flex justify-between">
                <span className="text-[#656971] dark:text-[#8c8d89]">Canonical Etiketi:</span>
                <span className="text-[#3157e5] dark:text-indigo-400">{analizSonucu.page_info?.canonical_url || "(Belirtilmemiş)"}</span>
              </div>
            </div>
          </div>

          {/* Tespit Edilen Kural İhlalleri */}
          <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl overflow-hidden shadow-xs">
            <div className="p-5 border-b border-[#e2e4e8] dark:border-[#343633] bg-[#fafbfc] dark:bg-[#171817]">
              <h3 className="font-semibold text-[#121316] dark:text-white text-base">Deterministik Kural İhlalleri ve Çözümleri</h3>
            </div>
            <div className="divide-y divide-[#e2e4e8] dark:divide-[#343633]">
              {analizSonucu.issues?.map((iss: any, idx: number) => (
                <div key={idx} className="p-4 space-y-2 hover:bg-[#f9fafb] dark:hover:bg-[#262725] transition-colors">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      iss.severity === "CRITICAL" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" :
                      iss.severity === "HIGH" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20" :
                      "bg-[#3157e5]/10 text-[#3157e5] dark:text-blue-400 border border-[#3157e5]/20"
                    }`}>
                      {iss.severity}
                    </span>
                    <span className="font-semibold text-[#121316] dark:text-white text-sm">{iss.title}</span>
                    <span className="text-[#8a8e96] dark:text-[#70726d] font-mono text-xs">({iss.rule_id})</span>
                  </div>
                  <p className="text-xs text-[#656971] dark:text-slate-300">{iss.description}</p>
                  <p className="text-xs text-[#0f927c] dark:text-emerald-400 font-medium">Öneri: {iss.recommendation}</p>
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleSorunDuzeltmeSetiOlustur(iss)}
                      className="px-3 py-1.5 bg-[#3157e5] hover:bg-[#2546c7] text-white rounded text-xs font-semibold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <span>Bu Sorun İçin Otonom Düzeltme Seti Oluştur</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Uzman Ajan Önerileri */}
          <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-6 space-y-4 shadow-xs">
            <h3 className="font-bold text-[#121316] dark:text-white text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#3157e5] dark:text-indigo-400" />
              <span>Yapay Zeka Uzman Ajan Önerileri (Google Search Central RAG Kaynaklı)</span>
            </h3>
            <div className="space-y-3">
              {analizSonucu.ai_recommendations?.map((rec: any, idx: number) => (
                <div key={idx} className="p-4 rounded-lg bg-[#f5f6f8] dark:bg-[#171817] border border-[#e2e4e8] dark:border-[#343633] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#3157e5] dark:text-indigo-300">{rec.title}</span>
                    <span className="text-xs font-bold text-[#0f927c] dark:text-emerald-400 bg-[#0f927c]/10 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded border border-[#0f927c]/20 dark:border-emerald-500/20">
                      Öncelik Puanı: {rec.priority_score}
                    </span>
                  </div>
                  <p className="text-xs text-[#656971] dark:text-slate-300">{rec.description}</p>
                  <p className="text-xs text-[#8a8e96] dark:text-[#70726d]">Teknik Gerekçe: {rec.reason}</p>
                  <div className="pt-2 border-t border-[#e2e4e8] dark:border-[#343633] text-[11px] text-[#656971] dark:text-slate-400">
                    Beklenen Etki: <span className="text-[#121316] dark:text-slate-200 font-medium">{rec.expected_impact}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Geçmiş Taramalar */}
      <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-[#e2e4e8] dark:border-[#343633] bg-[#fafbfc] dark:bg-[#171817]">
          <h3 className="font-semibold text-[#121316] dark:text-white text-base">Geçmiş Tarama Kayıtları</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#4b4f58] dark:text-[#c4c6cd]">
            <thead className="bg-[#f5f6f8] dark:bg-[#171817] text-[#656971] dark:text-[#8c8d89] border-b border-[#e2e4e8] dark:border-[#343633] uppercase font-semibold">
              <tr>
                <th className="p-4">Tarama Kimliği</th>
                <th className="p-4">Tarama Modu</th>
                <th className="p-4 text-center">Durum</th>
                <th className="p-4 text-right">Taranan Sayfa</th>
                <th className="p-4 text-right">Hata</th>
                <th className="p-4 text-right">Süre</th>
                <th className="p-4 text-right">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e4e8] dark:divide-[#343633]">
              {gecmisTaramalar.map((t, idx) => (
                <tr key={idx} className="hover:bg-[#f9fafb] dark:hover:bg-[#262725] transition-colors">
                  <td className="p-4 font-mono font-bold text-[#3157e5] dark:text-indigo-300">{t.id}</td>
                  <td className="p-4 font-medium text-[#121316] dark:text-white">{t.mod}</td>
                  <td className="p-4 text-center">
                    <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-[#0f927c]/10 text-[#0f927c] dark:bg-emerald-500/10 dark:text-emerald-400 border border-[#0f927c]/20 dark:border-emerald-500/20">
                      {t.durum}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-[#121316] dark:text-slate-200">{t.sayfalar}</td>
                  <td className="p-4 text-right font-mono text-[#656971] dark:text-slate-300">{t.hata}</td>
                  <td className="p-4 text-right font-mono text-[#8a8e96] dark:text-slate-400">{t.sure}</td>
                  <td className="p-4 text-right text-[#8a8e96] dark:text-slate-400">{t.tarih}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
