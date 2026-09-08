"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Play, CheckCircle2, AlertTriangle, ShieldCheck, Globe, ArrowRight, Loader2, Sparkles, ChevronRight } from "lucide-react";

export default function SiteTaramalariPage() {
  const router = useRouter();
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
      const kayitli = localStorage.getItem("dentleon_changesets");
      const mevcutListe = kayitli ? JSON.parse(kayitli) : [];
      localStorage.setItem("dentleon_changesets", JSON.stringify([yeniSet, ...mevcutListe]));
      localStorage.setItem("dentleon_active_changeset_id", yeniSetId);
    } catch (e) {
      console.error(e);
    }

    setBildirim(`✓ "${iss.title}" için otonom düzeltme seti (#${yeniSetId}) oluşturuldu!`);
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

    setYukleniyor(true);
    setHataMesaji(null);
    setAnalizSonucu(null);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ||
        (process.env.NODE_ENV === "production" ? "/api/v1" : "http://localhost:8000/api/v1");
      const res = await fetch(`${baseUrl}/audit/quick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Layers className="w-6 h-6 text-indigo-400" />
          <span>Canlı Site Taraması & Otonom SEO Denetimi</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Dilediğiniz web sitesi adresini girin; crawler anında tarlasın, deterministik kuralları çalıştırsın ve yapay zeka önerilerini çıkarsın.
        </p>
      </div>

      {/* Canlı URL Giriş Kutusu */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <form onSubmit={handleCanliTarama} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Analiz Edilecek Hedef Web Sitesi (URL)
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Globe className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="url"
                  required
                  placeholder="https://siteniz.com"
                  value={hedefUrl}
                  onChange={(e) => setHedefUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={yukleniyor}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all shadow flex items-center justify-center gap-2 shrink-0"
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
          <div className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Hata: {hataMesaji}</span>
          </div>
        )}
      </div>

      {/* Canlı Analiz Sonuçları */}
      {analizSonucu && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <span className="text-xs text-slate-400 font-medium">Teknik SEO Sağlık Skoru</span>
              <div className="text-4xl font-extrabold text-emerald-400 mt-2">
                {analizSonucu.health_score} <span className="text-xs text-slate-500 font-normal">/ 100</span>
              </div>
              <span className="text-xs text-emerald-400 mt-1 block">Deterministik Kural Motoru</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <span className="text-xs text-slate-400 font-medium">HTTP Yanıt Kodu</span>
              <div className="text-4xl font-extrabold text-white mt-2 font-mono">
                {analizSonucu.status_code}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">Yanıt Süresi: {analizSonucu.page_info?.response_time_ms} ms</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <span className="text-xs text-slate-400 font-medium">Gövde Kelime Sayısı</span>
              <div className="text-4xl font-extrabold text-white mt-2 font-mono">
                {analizSonucu.page_info?.word_count || 0}
              </div>
              <span className="text-xs text-slate-400 mt-1 block">İçerik Derinliği</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <span className="text-xs text-slate-400 font-medium">Bulunan SEO Sorunları</span>
              <div className="text-4xl font-extrabold text-amber-400 mt-2 font-mono">
                {analizSonucu.issues?.length || 0}
              </div>
              <span className="text-xs text-amber-500 mt-1 block">Aksiyon Gerektiren</span>
            </div>
          </div>

          {/* Sayfa Detayları */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Taranan Sayfa Meta Verileri</h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Sayfa Başlığı (&lt;title&gt;):</span>
                <span className="text-white font-semibold">{analizSonucu.page_info?.title || "(Eksik)"}</span>
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Meta Açıklaması:</span>
                <span className="text-white">{analizSonucu.page_info?.meta_description || "(Eksik - Arama motoru rastgele metin çekecek)"}</span>
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex justify-between">
                <span className="text-slate-400">Canonical Etiketi:</span>
                <span className="text-indigo-400">{analizSonucu.page_info?.canonical_url || "(Belirtilmemiş)"}</span>
              </div>
            </div>
          </div>

          {/* Tespit Edilen Kural İhlalleri */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-800">
              <h3 className="font-semibold text-white text-base">Deterministik Kural İhlalleri ve Çözümleri</h3>
            </div>
            <div className="divide-y divide-slate-800">
              {analizSonucu.issues?.map((iss: any, idx: number) => (
                <div key={idx} className="p-4 space-y-2 hover:bg-slate-800/30 transition-all">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      iss.severity === "CRITICAL" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                      iss.severity === "HIGH" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                      "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    }`}>
                      {iss.severity}
                    </span>
                    <span className="font-semibold text-white text-sm">{iss.title}</span>
                    <span className="text-slate-500 font-mono text-xs">({iss.rule_id})</span>
                  </div>
                  <p className="text-xs text-slate-300">{iss.description}</p>
                  <p className="text-xs text-emerald-400 font-medium">Öneri: {iss.recommendation}</p>
                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleSorunDuzeltmeSetiOlustur(iss)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-all shadow flex items-center gap-1 cursor-pointer"
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
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <span>Yapay Zeka Uzman Ajan Önerileri (Google Search Central RAG Kaynaklı)</span>
            </h3>
            <div className="space-y-3">
              {analizSonucu.ai_recommendations?.map((rec: any, idx: number) => (
                <div key={idx} className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-indigo-300">{rec.title}</span>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
                      Öncelik Puanı: {rec.priority_score}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{rec.description}</p>
                  <p className="text-xs text-slate-400">Teknik Gerekçe: {rec.reason}</p>
                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                    Beklenen Etki: <span className="text-slate-200">{rec.expected_impact}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Geçmiş Taramalar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800">
          <h3 className="font-semibold text-white text-base">Geçmiş Tarama Kayıtları</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold">
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
            <tbody className="divide-y divide-slate-800/80">
              {gecmisTaramalar.map((t, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 font-mono font-bold text-indigo-300">{t.id}</td>
                  <td className="p-4 font-medium text-white">{t.mod}</td>
                  <td className="p-4 text-center">
                    <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {t.durum}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-slate-200">{t.sayfalar}</td>
                  <td className="p-4 text-right font-mono text-slate-300">{t.hata}</td>
                  <td className="p-4 text-right font-mono text-slate-400">{t.sure}</td>
                  <td className="p-4 text-right text-slate-400">{t.tarih}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
