"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Sparkles, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

export default function FirsatlarPage() {
  const router = useRouter();
  const [islemdeIdx, setIslemdeIdx] = useState<number | null>(null);
  const [bildirim, setBildirim] = useState<string | null>(null);

  const firsatlar = [
    {
      kategori: "YÜKSEK GÖSTERİM - DÜŞÜK TIKLAMA",
      sorgu: "otonom seo yazılımı",
      sayfa: "https://flagship-store.com/yazilim",
      gosterim: 42000,
      tiklama: 750,
      mevcutTO: "%1.78",
      hedefTO: "%4.50",
      potansiyelTrafik: "+1.140 Tıklama/Ay",
      aksiyon: "Başlık ve meta açıklamasını kullanıcı arama niyetine odaklanacak şekilde AI ile revize edin.",
      oncekiKod: `<title>SEO Yazılımı | Flagship</title>\n<meta name="description" content="SEO optimizasyon yazılımımız hakkında bilgiler.">`,
      yeniKod: `<title>Otonom AI SEO Yazılımı ve Otomatik Sıralama Yükseltme | Flagship</title>\n<meta name="description" content="Yapay zeka destekli otonom SEO yazılımı ile teknik hataları otomatik onarın, Google'da 1. sayfaya yükselin. Hemen ücretsiz deneyin.">`
    },
    {
      kategori: "2. SAYFA - 1. SAYFAYA YÜKSELTME",
      sorgu: "yapay zeka canonical motoru",
      sayfa: "https://flagship-store.com/ozellikler",
      gosterim: 28500,
      tiklama: 420,
      mevcutTO: "%1.47",
      hedefTO: "%6.00",
      potansiyelTrafik: "+1.290 Tıklama/Ay",
      aksiyon: "Sayfaya güçlü otoriteye sahip blog yazılarından doğrudan bağlamsal iç link ekleyin.",
      oncekiKod: `<!-- /blog/seo-rehberi içinde bağlamsal link yok -->\n<p>Sayfalar arası bağlantı stratejisi önemlidir.</p>`,
      yeniKod: `<!-- Bağlamsal PageRank akışı eklendi -->\n<p>Sayfalar arası bağlantı stratejisi önemlidir; özellikle <a href="/ozellikler" class="text-indigo-400 font-semibold">yapay zeka canonical motoru</a> kullanarak yinelenen içerik risklerini sıfıra indirebilirsiniz.</p>`
    },
    {
      kategori: "ANAHTAR KELİME KANİBALİZASYONU",
      sorgu: "site içi link analizi",
      sayfa: "2 Farklı URL yarışıyor (/blog/linkler ve /ozellikler/link)",
      gosterim: 19400,
      tiklama: 310,
      mevcutTO: "%1.60",
      hedefTO: "%5.20",
      potansiyelTrafik: "+700 Tıklama/Ay",
      aksiyon: "İki sayfayı birleştirin veya rel=canonical ile ana ticari sayfayı yetkilendirin.",
      oncekiKod: `<!-- /blog/linkler sayfasında bağımsız self-canonical -->\n<link rel="canonical" href="https://flagship-store.com/blog/linkler" />`,
      yeniKod: `<!-- Kanibalizasyonu önlemek için ana ticari sayfaya canonical yönlendirmesi -->\n<link rel="canonical" href="https://flagship-store.com/ozellikler/link" />`
    }
  ];

  const handleOptimizasyonOlustur = async (f: typeof firsatlar[0], idx: number) => {
    setIslemdeIdx(idx);
    setBildirim(null);

    await new Promise((r) => setTimeout(r, 700));

    const yeniSetId = `CS-OPP-${Math.floor(1000 + Math.random() * 9000)}`;
    const yeniSet = {
      id: yeniSetId,
      baslik: `Büyüme Fırsatı: "${f.sorgu}" Optimizasyonu`,
      onem: "YÜKSEK",
      etkilenenSayfa: f.sayfa,
      kategori: "BÜYÜME_FIRSATI",
      oneri: f.aksiyon,
      durum: "BEKLİYOR",
      oncekiKod: f.oncekiKod,
      yeniKod: f.yeniKod,
      olusturulmaTarihi: new Date().toLocaleTimeString("tr-TR")
    };

    try {
      const kayitli = localStorage.getItem("seo_platform_changesets") || localStorage.getItem("dentleon_changesets");
      const mevcutListe = kayitli ? JSON.parse(kayitli) : [];
      const guncel = [yeniSet, ...mevcutListe];
      localStorage.setItem("seo_platform_changesets", JSON.stringify(guncel));
      localStorage.setItem("seo_platform_active_changeset_id", yeniSetId);
    } catch (e) {
      console.error(e);
    }

    setIslemdeIdx(null);
    setBildirim(`✓ "${f.sorgu}" fırsatı için otonom optimizasyon seti (#${yeniSetId}) oluşturuldu! Değişiklik sayfasına yönlendiriliyorsunuz...`);

    setTimeout(() => {
      router.push("/changes");
    }, 1000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e4e8] dark:border-[#343633] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#121316] dark:text-white flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-amber-500" />
            <span>Search Console Büyüme Fırsatları (Opportunity Engine)</span>
          </h1>
          <p className="text-sm text-[#656971] dark:text-[#8c8d89] mt-1">
            Yüksek gösterim aldığı halde düşük tıklama alan sorgular ve kanibalizasyon tespitiyle hızlı organik trafik kazançları.
          </p>
        </div>
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

      <div className="space-y-4">
        {firsatlar.map((f, idx) => {
          const yukleniyor = islemdeIdx === idx;

          return (
            <div key={idx} className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-6 hover:border-[#cfd3da] dark:hover:border-[#484a46] transition-all space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e2e4e8] dark:border-[#343633] pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    {f.kategori}
                  </span>
                  <span className="font-bold text-[#121316] dark:text-white text-base">"{f.sorgu}"</span>
                </div>
                <span className="text-xs font-bold text-[#0f927c] dark:text-emerald-400 bg-[#0f927c]/10 dark:bg-emerald-500/10 px-3 py-1 rounded-full border border-[#0f927c]/20 dark:border-emerald-500/20">
                  Tahmini Kazanç: {f.potansiyelTrafik}
                </span>
              </div>

              <div className="text-xs text-[#656971] dark:text-[#8c8d89] font-mono bg-[#f5f6f8] dark:bg-[#171817] p-2.5 rounded border border-[#e2e4e8] dark:border-[#343633]">
                Hedef URL: <span className="text-[#3157e5] dark:text-indigo-300 font-medium">{f.sayfa}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f5f6f8] dark:bg-[#171817] p-3 rounded-lg border border-[#e2e4e8] dark:border-[#343633] text-xs">
                <div>
                  <span className="text-[#8a8e96] dark:text-[#70726d] block">Aylık Gösterim</span>
                  <span className="font-bold text-[#121316] dark:text-white font-mono">{f.gosterim.toLocaleString("tr-TR")}</span>
                </div>
                <div>
                  <span className="text-[#8a8e96] dark:text-[#70726d] block">Mevcut Tıklama</span>
                  <span className="font-bold text-[#121316] dark:text-white font-mono">{f.tiklama.toLocaleString("tr-TR")}</span>
                </div>
                <div>
                  <span className="text-[#8a8e96] dark:text-[#70726d] block">Mevcut TO</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">{f.mevcutTO}</span>
                </div>
                <div>
                  <span className="text-[#8a8e96] dark:text-[#70726d] block">Hedeflenen TO</span>
                  <span className="font-bold text-[#0f927c] dark:text-emerald-400 font-mono">{f.hedefTO}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <p className="text-xs text-[#656971] dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#3157e5] dark:text-indigo-400 shrink-0" />
                  <span>{f.aksiyon}</span>
                </p>
                <button
                  onClick={() => handleOptimizasyonOlustur(f, idx)}
                  disabled={yukleniyor}
                  className="px-4 py-2 bg-[#3157e5] hover:bg-[#2546c7] disabled:bg-[#3157e5]/50 text-white rounded text-xs font-semibold transition-all shadow-xs shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  {yukleniyor ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Optimizasyon Seti Hazırlanıyor...</span>
                    </>
                  ) : (
                    <>
                      <span>Otonom Optimizasyonu Uygula</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
