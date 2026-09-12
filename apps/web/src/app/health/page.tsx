"use client";

import React from "react";
import { ShieldCheck, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

export default function SiteSagligiPage() {
  const kurallar = [
    { kural: "Canonical Doğruluğu", durum: "Uyarı", puan: "85/100", aciklama: "1 sayfada canonical döngüsü tespit edildi." },
    { kural: "Robots.txt & Noindex Uyumu", durum: "Mükemmel", puan: "100/100", aciklama: "Robots tarafından engellenen noindex sayfası bulunmuyor." },
    { kural: "Yönlendirme Zincirleri", durum: "Kritik", puan: "60/100", aciklama: "2 adet 3 veya daha fazla atlamalı yönlendirme zinciri mevcut." },
    { kural: "Başlık Etiketi (Title)", durum: "Mükemmel", puan: "100/100", aciklama: "Tüm taranan sayfalarda benzersiz başlık etiketi mevcut." },
    { kural: "Meta Açıklamaları (Description)", durum: "Mükemmel", puan: "95/100", aciklama: "Boş veya eksik meta açıklaması yok." },
    { kural: "Yapılandırılmış Veri Sözdizimi", durum: "Mükemmel", puan: "100/100", aciklama: "JSON-LD şemalarında syntax hatası bulunmadı." },
    { kural: "HTTP Yanıt Kodları", durum: "İyi", puan: "90/100", aciklama: "Kritik 5xx sunucu hatası yok, yalnızca 1 adet 404 bulundu." }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e4e8] dark:border-[#343633] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#121316] dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#0f927c] dark:text-emerald-400" />
            <span>Teknik SEO Sağlığı & Kural Analizi</span>
          </h1>
          <p className="text-sm text-[#656971] dark:text-[#8c8d89] mt-1">
            20+ deterministik SEO kuralı taranarak sıfır yapay zeka yanılsaması (zero-hallucination) ile hesaplanmıştır.
          </p>
        </div>
        <Link
          href="/crawls"
          className="px-4 py-2 bg-[#3157e5] hover:bg-[#2546c7] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs shrink-0"
        >
          <span>Yeni Canlı Tarama Başlat</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-xs">
          <span className="text-xs font-semibold text-[#656971] dark:text-[#8c8d89] uppercase tracking-wider">Genel Sağlık Skoru</span>
          <div className="text-5xl font-extrabold text-[#121316] dark:text-white mt-3">
            94<span className="text-lg text-[#8a8e96] dark:text-[#6f6d66] font-normal">/100</span>
          </div>
          <span className="mt-3 px-3 py-1 rounded-full text-xs font-semibold bg-[#0f927c]/10 text-[#0f927c] dark:bg-emerald-500/10 dark:text-emerald-400 border border-[#0f927c]/20 dark:border-emerald-500/20">
            Arama Motorları İçin İdeal
          </span>
        </div>

        <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-6 col-span-2 space-y-4 shadow-xs">
          <h3 className="font-semibold text-[#121316] dark:text-white text-sm">Puan Kırılma Detayı</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-[#656971] dark:text-[#8c8d89] mb-1">
                <span>Dizinlenebilirlik & Taranabilirlik</span>
                <span className="font-bold text-[#0f927c] dark:text-emerald-400">%96</span>
              </div>
              <div className="w-full h-2 bg-[#e2e4e8] dark:bg-[#2c2d2b] rounded-full overflow-hidden">
                <div className="bg-[#0f927c] dark:bg-emerald-500 h-full rounded-full w-[96%]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-[#656971] dark:text-[#8c8d89] mb-1">
                <span>Meta Veri & İçerik Uyumu</span>
                <span className="font-bold text-[#0f927c] dark:text-emerald-400">%98</span>
              </div>
              <div className="w-full h-2 bg-[#e2e4e8] dark:bg-[#2c2d2b] rounded-full overflow-hidden">
                <div className="bg-[#0f927c] dark:bg-emerald-500 h-full rounded-full w-[98%]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-[#656971] dark:text-[#8c8d89] mb-1">
                <span>Teknik Yönlendirmeler & HTTP Durumu</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">%78</span>
              </div>
              <div className="w-full h-2 bg-[#e2e4e8] dark:bg-[#2c2d2b] rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full w-[78%]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-[#e2e4e8] dark:border-[#343633] bg-[#fafbfc] dark:bg-[#171817]">
          <h3 className="font-semibold text-[#121316] dark:text-white text-base">Deterministik Kural Değerlendirme Listesi</h3>
        </div>
        <div className="divide-y divide-[#e2e4e8] dark:divide-[#343633]">
          {kurallar.map((item, idx) => (
            <div key={idx} className="p-4 flex items-center justify-between hover:bg-[#f8f9fa] dark:hover:bg-[#252624] transition-colors">
              <div className="space-y-0.5">
                <div className="font-medium text-sm text-[#121316] dark:text-white">{item.kural}</div>
                <p className="text-xs text-[#656971] dark:text-[#8c8d89]">{item.aciklama}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-[#656971] dark:text-[#8c8d89] font-medium">{item.puan}</span>
                <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                  item.durum === "Mükemmel" ? "bg-[#0f927c]/10 text-[#0f927c] dark:bg-emerald-500/10 dark:text-emerald-400 border border-[#0f927c]/20 dark:border-emerald-500/20" :
                  item.durum === "İyi" ? "bg-[#3157e5]/10 text-[#3157e5] dark:bg-blue-500/10 dark:text-blue-400 border border-[#3157e5]/20 dark:border-blue-500/20" :
                  item.durum === "Uyarı" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20" :
                  "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                }`}>
                  {item.durum}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
