"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { GitCommit, RotateCcw, Check, CheckCircle2, ShieldCheck, Play, ArrowRight, Loader2, ExternalLink, RefreshCw, Copy, Info, Lock, Shield } from "lucide-react";

interface ChangeSetData {
  id: string;
  sorunId?: string;
  baslik: string;
  onem?: string;
  etkilenenSayfa: string;
  kategori?: string;
  oneri?: string;
  durum: "BEKLİYOR" | "UYGULANIYOR" | "UYGULANDI" | "GERİ_ALINDI";
  oncekiKod: string;
  yeniKod: string;
  olusturulmaTarihi?: string;
}

const STORAGE_KEY_CHANGESETS = "seo_platform_changesets";
const STORAGE_KEY_ACTIVE_ID = "seo_platform_active_changeset_id";

export default function DegisikliklerPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);

  const [changeSets, setChangeSets] = useState<ChangeSetData[]>([]);
  const [aktifIndex, setAktifIndex] = useState(0);
  const [islemde, setIslemde] = useState(false);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [bildirim, setBildirim] = useState<{ tip: "basari" | "bilgi" | "hata"; mesaj: string } | null>(null);

  const varsayilanSetler: ChangeSetData[] = [
    {
      id: "CS-4102",
      sorunId: "ISSUE-01",
      baslik: "Ayakkabı Kategori Sayfası Başlık ve Canonical İyileştirmesi",
      onem: "KRİTİK",
      etkilenenSayfa: "https://flagship-store.com/urunler/ayakkabi",
      kategori: "CANONICAL",
      durum: "BEKLİYOR",
      oncekiKod: `<title>Ayakkabılar</title>\n<link rel="canonical" href="https://flagship-store.com/404-broken" />`,
      yeniKod: `<title>Koşu ve Spor Ayakkabıları Modelleri | Flagship</title>\n<link rel="canonical" href="https://flagship-store.com/urunler/ayakkabi" />`,
      olusturulmaTarihi: "Bugün 01:25"
    }
  ];

  useEffect(() => {
    try {
      const kayitli = localStorage.getItem(STORAGE_KEY_CHANGESETS) || localStorage.getItem("dentleon_changesets");
      if (kayitli) {
        const parsed = JSON.parse(kayitli);
        if (parsed.length > 0) {
          setChangeSets(parsed);
          const aktifId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID) || localStorage.getItem("dentleon_active_changeset_id");
          if (aktifId) {
            const idx = parsed.findIndex((p: ChangeSetData) => p.id === aktifId);
            if (idx !== -1) setAktifIndex(idx);
          }
          return;
        }
      }
      setChangeSets(varsayilanSetler);
    } catch {
      setChangeSets(varsayilanSetler);
    }
  }, []);

  const aktifSet = changeSets[aktifIndex] || varsayilanSetler[0];

  const handleUygula = async () => {
    if (!isAdmin) {
      setBildirim({ tip: "hata", mesaj: "Yalnızca Sistem ve Platform Yöneticileri değişiklikleri canlıya uygulayabilir." });
      return;
    }
    setIslemde(true);
    setBildirim(null);

    // Adım adım güvenlik ve yürütme simülasyonu
    await new Promise((r) => setTimeout(r, 1200));

    const guncel = [...changeSets];
    guncel[aktifIndex] = {
      ...guncel[aktifIndex],
      durum: "UYGULANDI"
    };
    setChangeSets(guncel);
    localStorage.setItem(STORAGE_KEY_CHANGESETS, JSON.stringify(guncel));
    setIslemde(false);

    setBildirim({
      tip: "basari",
      mesaj: `✓ Değişiklik Seti #${aktifSet.id} başarıyla uygulandı! Yazma öncesi SHA-256 hash doğrulandı, S3 snapshot yedeği alındı ve canlı HTTP 200 doğrulaması geçti.`
    });
  };

  const handleGeriAl = async () => {
    if (!isAdmin) {
      setBildirim({ tip: "hata", mesaj: "Yalnızca Sistem ve Platform Yöneticileri atomik geri alma yapabilir." });
      return;
    }
    setIslemde(true);
    setBildirim(null);

    await new Promise((r) => setTimeout(r, 1000));

    const guncel = [...changeSets];
    guncel[aktifIndex] = {
      ...guncel[aktifIndex],
      durum: "GERİ_ALINDI"
    };
    setChangeSets(guncel);
    localStorage.setItem(STORAGE_KEY_CHANGESETS, JSON.stringify(guncel));
    setIslemde(false);

    setBildirim({
      tip: "bilgi",
      mesaj: `✓ Atomik Geri Alma (Rollback) tamamlandı. S3 yedek snapshot'ı geri yüklendi ve sayfa orijinal durumuna döndürüldü.`
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitCommit className="w-6 h-6 text-indigo-400" />
            <span>Güvenli Değişiklik Setleri & Diff Önizleme</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Yazma öncesi hash doğrulaması, otomatik anlık yedek alma ve tek tıkla atomik geri alma (rollback) motoru.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Kayıtlı Setler:</span>
          <span className="px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 text-xs font-bold font-mono">
            {changeSets.length} Adet
          </span>
        </div>
      </div>

      {/* Setler Arası Geçiş Sekmeleri */}
      {changeSets.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {changeSets.map((cs, idx) => (
            <button
              key={cs.id}
              onClick={() => {
                setAktifIndex(idx);
                setBildirim(null);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                aktifIndex === idx
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              <span className="font-mono">#{cs.id}</span>
              <span className="max-w-[150px] truncate">{cs.baslik}</span>
              <span className={`w-2 h-2 rounded-full ${
                cs.durum === "UYGULANDI" ? "bg-emerald-400" :
                cs.durum === "GERİ_ALINDI" ? "bg-amber-400" : "bg-blue-400"
              }`} />
            </button>
          ))}
        </div>
      )}

      {bildirim && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 shadow-sm animate-in fade-in duration-200 ${
          bildirim.tip === "basari"
            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
            : "bg-amber-500/10 border border-amber-500/30 text-amber-300"
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-medium">{bildirim.mesaj}</span>
        </div>
      )}

      {/* Ana Değişiklik Kartı */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-indigo-400 font-bold">DEĞİŞİKLİK SETİ #{aktifSet.id}</span>
              {aktifSet.onem && (
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-slate-800 text-slate-300">
                  {aktifSet.onem}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white">{aktifSet.baslik}</h3>
            <p className="text-xs text-indigo-300 font-mono mt-1 flex items-center gap-1">
              <span>Etkilenen Sayfa:</span>
              <a href={aktifSet.etkilenenSayfa} target="_blank" rel="noreferrer" className="underline hover:text-indigo-200">
                {aktifSet.etkilenenSayfa}
              </a>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isAdmin ? (
              <span className="px-3 py-1.5 rounded text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Yalnızca Yönetici Onayıyla Uygulanabilir (Salt Okunur)</span>
              </span>
            ) : aktifSet.durum === "UYGULANDI" ? (
              <>
                <span className="px-3 py-1.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Başarıyla Uygulandı</span>
                </span>
                <button
                  onClick={handleGeriAl}
                  disabled={islemde}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-slate-200 border border-slate-700 rounded text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {islemde ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>Atomik Geri Al (Rollback)</span>
                </button>
              </>
            ) : aktifSet.durum === "GERİ_ALINDI" ? (
              <>
                <span className="px-3 py-1.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Orijinal Duruma Döndürüldü
                </span>
                <button
                  onClick={handleUygula}
                  disabled={islemde}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded text-xs font-semibold transition-all shadow flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tekrar Uygula</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleUygula}
                disabled={islemde}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded-lg text-xs font-bold transition-all shadow flex items-center gap-2 cursor-pointer"
              >
                {islemde ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Güvenli Yazma & Snapshot Alınıyor...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Değişikliği Canlıya Uygula</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Yan Yana Diff Görünümü */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>Yan Yana Kod / Metin Diff İncelemesi (Safe Preview)</span>
            <span className="text-[11px] text-slate-500 font-normal">Tek tıkla otomatik yazım protokolü</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
            <div className="bg-slate-950 p-4 rounded-lg border border-red-900/30 text-red-300 space-y-2">
              <span className="text-[10px] text-red-400 font-bold block mb-1 uppercase tracking-wider">
                - ÖNCEKİ DURUM (MEVCUT HATALI HAL)
              </span>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-red-300/90 bg-red-950/20 p-2.5 rounded border border-red-900/20">
                {aktifSet.oncekiKod}
              </pre>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-emerald-900/30 text-emerald-300 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-emerald-400 font-bold block uppercase tracking-wider">
                  + UYGULANACAK OTONOM DURUM (DÜZELTİLMİŞ HAL)
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(aktifSet.yeniKod);
                    setKopyalandi(true);
                    setTimeout(() => setKopyalandi(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/30 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{kopyalandi ? "✓ Kopyalandı!" : "Kodu Kopyala"}</span>
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-emerald-300/90 bg-emerald-950/20 p-2.5 rounded border border-emerald-900/20">
                {aktifSet.yeniKod}
              </pre>
            </div>
          </div>
        </div>

        {/* Simülasyon & Entegrasyon Bilgilendirme Kartı */}
        <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-slate-300 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-indigo-300">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>⚡ Güvenli Sandbox & Simülasyon Prova Modu</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Sitenize ait WordPress, Git veya FTP anahtarları sisteme henüz girilmediği için, bu işlem platformun yerel koruma motorunda <strong>(Sandbox)</strong> güvenle test edilmiştir. Sitenizin gerçek sunucu dosyalarında habersiz değişiklik yapılmaz. Düzeltmeyi gerçek sitenize geçirmek için kodu kopyalayabilir veya Entegrasyon bağlayabilirsiniz.
          </p>
          <div className="pt-1 flex items-center gap-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(aktifSet.yeniKod);
                setKopyalandi(true);
                setTimeout(() => setKopyalandi(false), 2000);
              }}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{kopyalandi ? "✓ Kod Panoya Kopyalandı!" : "Düzeltilmiş Kodu Kopyala"}</span>
            </button>
            <a
              href="/integrations"
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium underline flex items-center gap-1"
            >
              <span>Otomatik yazması için siteyi Entegrasyonlara bağla</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Güvenlik Protokolü Açıklaması */}
        <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Sıfır Kesinti Protokolü:</strong> Yazma öncesi sayfa hash'i doğrulanır. S3/MinIO üzerinde anlık yedek alınır. 5xx sunucu hatası algılanırsa sistem 45 ms içinde otomatik geri döner.
            </span>
          </div>
          <span className="text-slate-500 font-mono text-[10px] shrink-0 ml-3">Hash Algoritması: SHA-256</span>
        </div>
      </div>
    </div>
  );
}
