"use client";

import React from "react";
import { 
  ShieldCheck, 
  AlertTriangle, 
  MousePointerClick, 
  TrendingUp, 
  Zap, 
  ArrowUpRight, 
  CheckCircle2, 
  Lock,
  Sparkles,
  ExternalLink,
  ChevronRight
} from "lucide-react";

export default function GenelBakisPage() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Üst Başlık & Rozetler */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>Platform Genel Bakışı</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Demo Veri
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Örnek site sağlık skoru, Google Search Console trafik verileri ve optimizasyon görünümü. Canlı veriler entegrasyon sayfalarında gösterilir.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Sıfır Halüsinasyon Koruması Aktif
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Lock className="w-3.5 h-3.5" />
            Yürütme Modu: İncele ve Onayla
          </span>
        </div>
      </div>

      {/* Ana Performans Göstergeleri (KPI Kartları) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* SEO Sağlık Skoru */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Teknik SEO Sağlığı</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">94</span>
            <span className="text-xs text-slate-500">/ 100 Puan</span>
          </div>
          <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>Son taramaya göre +2.4 puan artış</span>
          </div>
        </div>

        {/* Kritik Sorunlar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Kritik Teknik Sorunlar</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">3</span>
            <span className="text-xs text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">Aksiyon Gerekli</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            1 canonical döngüsü, 2 yönlendirme zinciri
          </p>
        </div>

        {/* 28 Günlük Organik Tıklama */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>28 Günlük Organik Tıklama (GSC)</span>
            <MousePointerClick className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white">142.8B</span>
            <span className="text-xs text-emerald-400 font-semibold">+%8.1</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Toplam Gösterim: 2.4M (Ortalama TO: %5.95)
          </p>
        </div>

        {/* Core Web Vitals */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Web Hayati Değerleri (CrUX p75)</span>
            <Zap className="w-4 h-4 text-teal-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400">BAŞARILI</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            LCP: 1.8sn | INP: 85ms | CLS: 0.02
          </p>
        </div>
      </div>

      {/* Yüksek Öncelikli Yapay Zeka SEO Önerileri */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Öncelikli Yapay Zeka Önerileri ve Fırsatlar</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Google Search Central seviye-1 belgeleriyle doğrulanmış ve etki formülü ile sıralanmıştır.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Öncelik Puanına Göre Sıralı</span>
        </div>

        <div className="space-y-3">
          {[
            {
              title: "/urunler/kurumsal sayfasındaki Canonical Döngüsünü Düzeltin",
              category: "CANONICALİZASYON",
              severity: "KRİTİK",
              score: 96,
              reason: "Dairesel canonical yönlendirmeleri arama motoru botlarının sayfayı dizine eklemesini engeller.",
              source: "Google Search Central: Canonicalization Kılavuzu",
              actionLabel: "Diff İncele & Düzelt"
            },
            {
              title: "Yüksek Gösterimli / Düşük Tıklamalı Başlık Etiketi Optimizasyonu",
              category: "TO_İYİLEŞTİRME",
              severity: "ORTA",
              score: 84,
              reason: "'otonom seo yazılımı' sorgusu 42.000 gösterimde 4.2 pozisyondayken yalnızca %1.8 tıklama alıyor.",
              source: "GSC Search Analytics Motoru",
              actionLabel: "Başlığı Optimize Et"
            },
            {
              title: "/fiyatlandirma Sayfasına Eksik İç Bağlantıları Ekleyin",
              category: "İÇ_LİNKLER",
              severity: "ORTA",
              score: 79,
              reason: "Yüksek dönüşümlü fiyatlandırma sayfası, site genelinden sadece 3 iç bağlantı alarak zayıf kalıyor.",
              source: "NetworkX Site Grafı & PageRank Analizörü",
              actionLabel: "Anchor Önerilerini Gör"
            }
          ].map((item, idx) => (
            <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    item.severity === "KRİTİK" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}>
                    {item.severity}
                  </span>
                  <span className="font-semibold text-sm text-slate-100">{item.title}</span>
                </div>
                <p className="text-xs text-slate-400">{item.reason}</p>
                <p className="text-[11px] text-indigo-400 font-mono flex items-center gap-1">
                  <span>Resmi Kanıt Kaynağı:</span>
                  <span className="text-slate-300">{item.source}</span>
                </p>
              </div>

              <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-800">
                <div className="text-sm font-bold text-white">
                  {item.score} <span className="text-xs text-slate-500 font-normal">/ 100 Puan</span>
                </div>
                <button className="mt-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-all shadow-sm flex items-center gap-1">
                  <span>{item.actionLabel}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
