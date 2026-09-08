"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Filter, CheckCircle2, ChevronRight, ShieldAlert, Loader2, ArrowRight, Sparkles } from "lucide-react";

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

  useEffect(() => {
    // Daha önce oluşturulmuş setleri yükle
    try {
      const kayitli = localStorage.getItem("dentleon_changesets");
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

    // Gerçekçi işlem ve analiz simülasyonu
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
      const kayitli = localStorage.getItem("dentleon_changesets");
      const mevcutListe = kayitli ? JSON.parse(kayitli) : [];
      // Mevcut varsa güncelle veya başa ekle
      const guncel = [yeniSet, ...mevcutListe.filter((item: any) => item.sorunId !== sorun.id)];
      localStorage.setItem("dentleon_changesets", JSON.stringify(guncel));
      localStorage.setItem("dentleon_active_changeset_id", yeniSetId);
    } catch (e) {
      console.error("Storage error:", e);
    }

    setOlusturulanSetler((prev) => [...prev, sorun.id]);
    setIslemdeId(null);
    setBildirim(`✓ Otonom Düzeltme Seti (#${yeniSetId}) başarıyla hazırlandı! Diff ve önizleme sayfasına yönlendiriliyorsunuz...`);

    // Kullanıcıyı doğrudan Diff & Önizleme sayfasına aktar
    setTimeout(() => {
      router.push("/changes");
    }, 1200);
  };

  const filtrelenmis = filtre === "TÜMÜ" ? sorunlar : sorunlar.filter(s => s.onem === filtre);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
            <span>Tespit Edilen SEO Sorunları</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
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
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              {secenek}
            </button>
          ))}
        </div>
      </div>

      {bildirim && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{bildirim}</span>
          </div>
          <button
            onClick={() => router.push("/changes")}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded text-xs transition-all shrink-0 ml-4"
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
            <div key={sorun.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                    sorun.onem === "KRİTİK" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                    sorun.onem === "YÜKSEK" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                    sorun.onem === "ORTA" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                    "bg-slate-700 text-slate-300"
                  }`}>
                    {sorun.onem}
                  </span>
                  <span className="font-semibold text-white text-base">{sorun.baslik}</span>
                </div>
                <span className="text-xs font-mono text-slate-400">{sorun.id}</span>
              </div>

              <p className="text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded border border-slate-800/80 font-mono text-indigo-300">
                Etkilenen URL: {sorun.etkilenenSayfa}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-400 pt-1">
                <div>
                  <span className="font-semibold text-slate-200 block mb-0.5">Problem Teşhisi:</span>
                  {sorun.aciklama}
                </div>
                <div>
                  <span className="font-semibold text-emerald-400 block mb-0.5">Önerilen Otomatik Çözüm:</span>
                  {sorun.oneri}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-800/60">
                <span className="text-[11px] text-slate-500 font-medium">
                  Kategori: <strong className="text-slate-400">{sorun.kategori}</strong>
                </span>

                <div className="flex items-center gap-2">
                  {zatenOlusturuldu && (
                    <button
                      onClick={() => router.push("/changes")}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 rounded text-xs font-semibold transition-all flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Set Hazır (İncele)</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOtonomSetOlustur(sorun)}
                    disabled={yukleniyor}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded text-xs font-semibold transition-all shadow flex items-center gap-1.5 cursor-pointer"
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
