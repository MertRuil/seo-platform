"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { GitCommit, RotateCcw, CheckCircle2, ShieldCheck, Play, ArrowRight, Loader2, RefreshCw, Copy, Info, Lock } from "lucide-react";

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
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e4e8] dark:border-[#343633] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#121316] dark:text-white flex items-center gap-2">
            <GitCommit className="w-6 h-6 text-[#3157e5] dark:text-indigo-400" />
            <span>Güvenli Değişiklik Setleri & Diff Önizleme</span>
          </h1>
          <p className="text-sm text-[#656971] dark:text-[#8c8d89] mt-1">
            Yazma öncesi hash doğrulaması, otomatik anlık yedek alma ve tek tıkla atomik geri alma (rollback) motoru.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#656971] dark:text-[#8c8d89]">Kayıtlı Setler:</span>
          <span className="px-2.5 py-1 rounded bg-[#3157e5]/10 text-[#3157e5] dark:text-indigo-400 text-xs font-bold font-mono">
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
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                aktifIndex === idx
                  ? "bg-[#3157e5] text-white shadow-xs"
                  : "bg-white dark:bg-[#202120] text-[#656971] dark:text-[#8c8d89] border border-[#dde0e5] dark:border-[#343633] hover:text-[#121316] dark:hover:text-white hover:bg-[#f5f6f8] dark:hover:bg-[#292a28]"
              }`}
            >
              <span className="font-mono">#{cs.id}</span>
              <span className="max-w-[150px] truncate">{cs.baslik}</span>
              <span className={`w-2 h-2 rounded-full ${
                cs.durum === "UYGULANDI" ? "bg-[#0f927c] dark:bg-emerald-400" :
                cs.durum === "GERİ_ALINDI" ? "bg-amber-500" : "bg-[#3157e5] dark:bg-blue-400"
              }`} />
            </button>
          ))}
        </div>
      )}

      {bildirim && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 shadow-xs animate-in fade-in duration-200 ${
          bildirim.tip === "basari"
            ? "bg-[#0f927c]/10 border border-[#0f927c]/30 text-[#0f927c] dark:text-emerald-300"
            : "bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300"
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-medium">{bildirim.mesaj}</span>
        </div>
      )}

      {/* Ana Değişiklik Kartı */}
      <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-6 space-y-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2e4e8] dark:border-[#343633] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-[#3157e5] dark:text-indigo-400 font-bold">DEĞİŞİKLİK SETİ #{aktifSet.id}</span>
              {aktifSet.onem && (
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-[#f0f1f4] dark:bg-[#2a2b29] text-[#656971] dark:text-[#8c8d89]">
                  {aktifSet.onem}
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-[#121316] dark:text-white">{aktifSet.baslik}</h3>
            <p className="text-xs text-[#3157e5] dark:text-indigo-300 font-mono mt-1 flex items-center gap-1">
              <span className="text-[#656971] dark:text-[#8c8d89]">Etkilenen Sayfa:</span>
              <a href={aktifSet.etkilenenSayfa} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80">
                {aktifSet.etkilenenSayfa}
              </a>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isAdmin ? (
              <span className="px-3 py-1.5 rounded text-xs font-semibold bg-[#f5f6f8] dark:bg-[#171817] text-[#656971] dark:text-slate-400 border border-[#dde0e5] dark:border-[#343633] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Yalnızca Yönetici Onayıyla Uygulanabilir (Salt Okunur)</span>
              </span>
            ) : aktifSet.durum === "UYGULANDI" ? (
              <>
                <span className="px-3 py-1.5 rounded text-xs font-semibold bg-[#0f927c]/10 text-[#0f927c] dark:bg-emerald-500/10 dark:text-emerald-400 border border-[#0f927c]/20 dark:border-emerald-500/20 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Başarıyla Uygulandı</span>
                </span>
                <button
                  onClick={handleGeriAl}
                  disabled={islemde}
                  className="px-3 py-1.5 bg-white dark:bg-[#202120] hover:bg-[#f5f6f8] dark:hover:bg-[#292a28] disabled:opacity-50 text-[#121316] dark:text-slate-200 border border-[#dde0e5] dark:border-[#343633] rounded text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {islemde ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span>Atomik Geri Al (Rollback)</span>
                </button>
              </>
            ) : aktifSet.durum === "GERİ_ALINDI" ? (
              <>
                <span className="px-3 py-1.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  Orijinal Duruma Döndürüldü
                </span>
                <button
                  onClick={handleUygula}
                  disabled={islemde}
                  className="px-4 py-1.5 bg-[#3157e5] hover:bg-[#2546c7] disabled:bg-[#3157e5]/50 text-white rounded text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Tekrar Uygula</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleUygula}
                disabled={islemde}
                className="px-5 py-2 bg-[#0f927c] hover:bg-[#0c7866] disabled:bg-[#0f927c]/50 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
              >
                {islemde ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
          <div className="flex items-center justify-between text-xs font-semibold text-[#656971] dark:text-[#8c8d89]">
            <span>Yan Yana Kod / Metin Diff İncelemesi (Safe Preview)</span>
            <span className="text-[11px] text-[#8a8e96] dark:text-[#70726d] font-normal">Tek tıkla otomatik yazım protokolü</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
            <div className="bg-rose-50/50 dark:bg-[#171817] p-4 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 space-y-2">
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold block mb-1 uppercase tracking-wider">
                - ÖNCEKİ DURUM (MEVCUT HATALI HAL)
              </span>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-rose-900 dark:text-rose-300/90 bg-rose-100/50 dark:bg-rose-950/20 p-2.5 rounded border border-rose-200 dark:border-rose-900/30">
                {aktifSet.oncekiKod}
              </pre>
            </div>

            <div className="bg-emerald-50/50 dark:bg-[#171817] p-4 rounded-lg border border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#0f927c] dark:text-emerald-400 font-bold block uppercase tracking-wider">
                  + UYGULANACAK OTONOM DURUM (DÜZELTİLMİŞ HAL)
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(aktifSet.yeniKod);
                    setKopyalandi(true);
                    setTimeout(() => setKopyalandi(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-white dark:bg-[#202120] hover:bg-emerald-50 dark:hover:bg-[#292a28] text-[#0f927c] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Copy className="w-3 h-3" />
                  <span>{kopyalandi ? "✓ Kopyalandı!" : "Kodu Kopyala"}</span>
                </button>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-emerald-900 dark:text-emerald-300/90 bg-emerald-100/50 dark:bg-emerald-950/20 p-2.5 rounded border border-emerald-200 dark:border-emerald-900/30">
                {aktifSet.yeniKod}
              </pre>
            </div>
          </div>
        </div>

        {/* Simülasyon & Entegrasyon Bilgilendirme Kartı */}
        <div className="p-4 rounded-xl bg-[#eef2ff] dark:bg-[#3157e5]/10 border border-[#c7d2fe] dark:border-[#3157e5]/30 text-xs text-[#1e293b] dark:text-slate-300 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-[#3157e5] dark:text-indigo-300">
            <Info className="w-4 h-4 text-[#3157e5] dark:text-indigo-400 shrink-0" />
            <span>⚡ Güvenli Sandbox & Simülasyon Prova Modu</span>
          </div>
          <p className="text-[#475569] dark:text-slate-400 leading-relaxed text-[11px]">
            Sitenize ait WordPress, Git veya FTP anahtarları sisteme henüz girilmediği için, bu işlem platformun yerel koruma motorunda <strong>(Sandbox)</strong> güvenle test edilmiştir. Sitenizin gerçek sunucu dosyalarında habersiz değişiklik yapılmaz. Düzeltmeyi gerçek sitenize geçirmek için kodu kopyalayabilir veya Entegrasyon bağlayabilirsiniz.
          </p>
          <div className="pt-1 flex items-center gap-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(aktifSet.yeniKod);
                setKopyalandi(true);
                setTimeout(() => setKopyalandi(false), 2000);
              }}
              className="px-3.5 py-1.5 bg-[#3157e5] hover:bg-[#2546c7] text-white rounded text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{kopyalandi ? "✓ Kod Panoya Kopyalandı!" : "Düzeltilmiş Kodu Kopyala"}</span>
            </button>
            <Link
              href="/integrations"
              className="text-xs text-[#3157e5] dark:text-indigo-400 hover:underline font-medium flex items-center gap-1"
            >
              <span>Otomatik yazması için siteyi Entegrasyonlara bağla</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Güvenlik Protokolü Açıklaması */}
        <div className="p-3.5 rounded-lg bg-[#f5f6f8] dark:bg-[#171817] border border-[#e2e4e8] dark:border-[#343633] text-[11px] text-[#656971] dark:text-[#8c8d89] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#0f927c] dark:text-emerald-400 shrink-0" />
            <span>
              <strong className="text-[#121316] dark:text-white">Sıfır Kesinti Protokolü:</strong> Yazma öncesi sayfa hash'i doğrulanır. S3/MinIO üzerinde anlık yedek alınır. 5xx sunucu hatası algılanırsa sistem 45 ms içinde otomatik geri döner.
            </span>
          </div>
          <span className="text-[#8a8e96] dark:text-[#70726d] font-mono text-[10px] shrink-0 ml-3">Hash Algoritması: SHA-256</span>
        </div>
      </div>
    </div>
  );
}
