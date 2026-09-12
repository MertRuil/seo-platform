"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2 } from "lucide-react";

interface SorunItem {
  id: string;
  baslik: string;
  kategori: string;
  onem: "KRİTİK" | "YÜKSEK" | "ORTA" | "DÜŞÜK";
  etkilenenSayfa: string;
  aciklama: string;
  oneri: string;
  oncekiKod: string;
  yeniKod: string;
}

export default function SeoSorunlariPage() {
  const router = useRouter();
  const [filtre, setFiltre] = useState("TÜMÜ");
  const [islemdeId, setIslemdeId] = useState<string | null>(null);
  const [olusturulanSetler, setOlusturulanSetler] = useState<string[]>([]);
  const [bildirim, setBildirim] = useState<string | null>(null);

  const sorunlar: SorunItem[] = [
    {
      id: "ISSUE-01",
      baslik: "Canonical Döngüsü Tespit Edildi (A -> B -> A)",
      kategori: "CANONICAL",
      onem: "KRİTİK",
      etkilenenSayfa: "https://flagship-store.com/urunler/kurumsal",
      aciklama: "Sayfa kendisini başka bir URL'ye canonical olarak gösteriyor, o sayfa da ilk sayfaya geri dönüyor.",
      oneri: "Sayfadaki rel=canonical etiketini doğrudan kendi mutlak URL'sine (self-referential) çevirin.",
      oncekiKod: '<link rel="canonical" href="https://flagship-store.com/urunler/kurumsal-alt" />',
      yeniKod: '<link rel="canonical" href="https://flagship-store.com/urunler/kurumsal" />'
    },
    {
      id: "ISSUE-02",
      baslik: "3 Kademeli Yönlendirme Zinciri (301 -> 301 -> 200)",
      kategori: "YÖNLENDİRME",
      onem: "YÜKSEK",
      etkilenenSayfa: "https://flagship-store.com/blog/eski-yazi",
      aciklama: "Tıklanan URL doğrudan hedefe varmak yerine ara 301 yönlendirmelerinden geçerek tarama bütçesi harcıyor.",
      oneri: "İç bağlantıları doğrudan nihai hedef URL'ye işaret edecek şekilde güncelleyin.",
      oncekiKod: '<a href="https://flagship-store.com/blog/eski-yazi">Rehberi Oku</a>\n<!-- 301 -> /blog/yazi-v2 -> /blog/guncel-rehber -->',
      yeniKod: '<a href="https://flagship-store.com/blog/guncel-rehber">Rehberi Oku</a>\n<!-- Doğrudan 200 OK Nihai Hedef Bağlantısı -->'
    },
    {
      id: "ISSUE-03",
      baslik: "404 Hatası Veren Kırık İç Bağlantı",
      kategori: "KIRIK_LİNK",
      onem: "ORTA",
      etkilenenSayfa: "https://flagship-store.com/hakkimizda",
      aciklama: "Sayfa gövdesinde yer alan /ekip bağlantısı HTTP 404 yanıtı döndürüyor.",
      oneri: "Bağlantıyı güncel çalışan ekip sayfasına yönlendirin veya etiketi kaldırın.",
      oncekiKod: '<a href="/ekip" class="nav-link">Ekibimizle Tanışın</a>\n<!-- Yanıt: HTTP 404 Not Found -->',
      yeniKod: '<a href="/kadromuz" class="nav-link">Ekibimizle Tanışın</a>\n<!-- Yanıt: HTTP 200 OK -->'
    },
    {
      id: "ISSUE-04",
      baslik: "Kısa Meta Açıklaması (Description)",
      kategori: "İÇERİK",
      onem: "DÜŞÜK",
      etkilenenSayfa: "https://flagship-store.com/iletisim",
      aciklama: "Meta açıklaması 45 karakter uzunluğunda; önerilen aralık 120-160 karakterdir.",
      oneri: "Kullanıcı arama niyetini ve harekete geçirici mesajı içeren zengin açıklama ekleyin.",
      oncekiKod: '<meta name="description" content="İletişim sayfası. Bize ulaşın.">',
      yeniKod: '<meta name="description" content="Flagship Store müşteri hizmetleri ve destek ekibine 7/24 ulaşın. Adres, telefon ve canlı destek bilgilerimizle hemen iletişime geçin.">'
    }
  ];

  const STORAGE_KEY_CHANGESETS = "seo_platform_changesets";
  const STORAGE_KEY_ACTIVE_ID = "seo_platform_active_changeset_id";

  useEffect(() => {
    try {
      const kayitli = localStorage.getItem(STORAGE_KEY_CHANGESETS) || localStorage.getItem("dentleon_changesets");
      if (kayitli) {
        const parsed = JSON.parse(kayitli);
        const ids = parsed.map((p: any) => p.sorunId);
        setOlusturulanSetler(ids);
      }
    } catch {
      // Hata durumunda sessizce devam et
    }
  }, []);

  const handleOtonomSetOlustur = async (sorun: SorunItem) => {
    setIslemdeId(sorun.id);
    setBildirim(null);

    await new Promise((resolve) => setTimeout(resolve, 800));

    const yeniSetId = `CS-${Math.floor(1000 + Math.random() * 9000)}`;
    const yeniSet = {
      id: yeniSetId,
      sorunId: sorun.id,
      baslik: sorun.baslik,
      onem: sorun.onem,
      etkilenenSayfa: sorun.etkilenenSayfa,
      kategori: sorun.kategori,
      oneri: sorun.oneri,
      durum: "BEKLİYOR",
      oncekiKod: sorun.oncekiKod,
      yeniKod: sorun.yeniKod,
      olusturulmaTarihi: new Date().toLocaleTimeString("tr-TR")
    };

    try {
      const kayitli = localStorage.getItem(STORAGE_KEY_CHANGESETS) || localStorage.getItem("dentleon_changesets");
      const mevcutListe = kayitli ? JSON.parse(kayitli) : [];
      const guncel = [yeniSet, ...mevcutListe.filter((item: any) => item.sorunId !== sorun.id)];
      localStorage.setItem(STORAGE_KEY_CHANGESETS, JSON.stringify(guncel));
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, yeniSetId);
    } catch (e) {
      console.error("Storage error:", e);
    }

    setOlusturulanSetler((prev) => [...prev, sorun.id]);
    setIslemdeId(null);
    setBildirim(`✓ Otonom Düzeltme Seti (#${yeniSetId}) başarıyla hazırlandı! Diff ve önizleme sayfasına yönlendiriliyorsunuz...`);

    setTimeout(() => {
      router.push("/changes");
    }, 1200);
  };

  const filtrelenmis = filtre === "TÜMÜ" ? sorunlar : sorunlar.filter(s => s.onem === filtre);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e4e8] dark:border-[#343633] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#121316] dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <span>Tespit Edilen SEO Sorunları</span>
          </h1>
          <p className="text-sm text-[#656971] dark:text-[#8c8d89] mt-1">
            Site taramalarında saptanan teknik ve içerik aksaklıkları. Otonom düzeltme seti oluşturarak anında diff incelemesi yapabilir ve uygulayabilirsiniz.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {["TÜMÜ", "KRİTİK", "YÜKSEK", "ORTA", "DÜŞÜK"].map((secenek) => (
            <button
              key={secenek}
              onClick={() => setFiltre(secenek)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filtre === secenek
                  ? "bg-[#3157e5] text-white shadow-xs"
                  : "bg-white dark:bg-[#202120] text-[#656971] dark:text-[#8c8d89] border border-[#dde0e5] dark:border-[#343633] hover:text-[#121316] dark:hover:text-white hover:bg-[#f5f6f8] dark:hover:bg-[#292a28]"
              }`}
            >
              {secenek}
            </button>
          ))}
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
            Hemen Git
          </button>
        </div>
      )}

      <div className="space-y-3">
        {filtrelenmis.map((sorun) => {
          const zatenOlusturuldu = olusturulanSetler.includes(sorun.id);
          const yukleniyor = islemdeId === sorun.id;

          return (
            <div key={sorun.id} className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-5 hover:border-[#cfd3da] dark:hover:border-[#484a46] transition-all space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                    sorun.onem === "KRİTİK" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20" :
                    sorun.onem === "YÜKSEK" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20" :
                    sorun.onem === "ORTA" ? "bg-[#3157e5]/10 text-[#3157e5] dark:text-blue-400 border border-[#3157e5]/20" :
                    "bg-[#f0f1f4] dark:bg-[#2a2b29] text-[#656971] dark:text-[#8c8d89]"
                  }`}>
                    {sorun.onem}
                  </span>
                  <span className="font-semibold text-[#121316] dark:text-white text-base">{sorun.baslik}</span>
                </div>
                <span className="text-xs font-mono text-[#656971] dark:text-[#8c8d89]">{sorun.id}</span>
              </div>

              <p className="text-xs text-[#3157e5] dark:text-indigo-300 bg-[#f5f6f8] dark:bg-[#171817] p-2.5 rounded border border-[#e2e4e8] dark:border-[#343633] font-mono">
                Etkilenen URL: {sorun.etkilenenSayfa}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[#656971] dark:text-[#8c8d89] pt-1">
                <div>
                  <span className="font-semibold text-[#121316] dark:text-slate-200 block mb-0.5">Problem Teşhisi:</span>
                  {sorun.aciklama}
                </div>
                <div>
                  <span className="font-semibold text-[#0f927c] dark:text-emerald-400 block mb-0.5">Önerilen Otomatik Çözüm:</span>
                  {sorun.oneri}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-[#e2e4e8] dark:border-[#343633]">
                <span className="text-[11px] text-[#8a8e96] dark:text-[#70726d] font-medium">
                  Kategori: <strong className="text-[#121316] dark:text-slate-300">{sorun.kategori}</strong>
                </span>

                <div className="flex items-center gap-2">
                  {zatenOlusturuldu && (
                    <button
                      onClick={() => router.push("/changes")}
                      className="px-3 py-1.5 bg-[#0f927c]/10 hover:bg-[#0f927c]/20 text-[#0f927c] dark:text-emerald-400 border border-[#0f927c]/30 rounded text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Set Hazır (İncele)</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOtonomSetOlustur(sorun)}
                    disabled={yukleniyor}
                    className="px-4 py-2 bg-[#3157e5] hover:bg-[#2546c7] disabled:bg-[#3157e5]/50 text-white rounded text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {yukleniyor ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Otonom Düzeltme Seti Hazırlanıyor...</span>
                      </>
                    ) : (
                      <>
                        <span>Otonom Düzeltme Seti Oluştur</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
