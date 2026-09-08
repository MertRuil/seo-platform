"use client";

import React from "react";
import { ShieldCheck, AlertCircle, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <span>Teknik SEO Sağlığı & Kural Analizi</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            20+ deterministik SEO kuralı taranarak sıfır yapay zeka yanılsaması (zero-hallucination) ile hesaplanmıştır.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Genel Sağlık Skoru</span>
          <div className="text-5xl font-extrabold text-white mt-3">94<span className="text-lg text-slate-500 font-normal">/100</span></div>
          <span className="mt-3 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Arama Motorları İçin İdeal
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 col-span-2 space-y-4">
          <h3 className="font-semibold text-slate-200 text-sm">Puan Kırılma Detayı</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Dizinlenebilirlik & Taranabilirlik</span>
                <span className="font-bold text-emerald-400">%96</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full w-[96%]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Meta Veri & İçerik Uyumu</span>
                <span className="font-bold text-emerald-400">%98</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full w-[98%]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Teknik Yönlendirmeler & HTTP Durumu</span>
                <span className="font-bold text-amber-400">%78</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full w-[78%]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800">
          <h3 className="font-semibold text-white text-base">Deterministik Kural Değerlendirme Listesi</h3>
        </div>
        <div className="divide-y divide-slate-800/80">
          {kurallar.map((item, idx) => (
            <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-all">
              <div className="space-y-0.5">
                <div className="font-medium text-sm text-slate-100">{item.kural}</div>
                <p className="text-xs text-slate-400">{item.aciklama}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-slate-300">{item.puan}</span>
                <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                  item.durum === "Mükemmel" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                  item.durum === "İyi" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                  item.durum === "Uyarı" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                  "bg-red-500/10 text-red-400 border border-red-500/20"
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
