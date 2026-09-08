"use client";

import React from "react";
import { BookOpen, ShieldCheck, Database, CheckCircle2 } from "lucide-react";

export default function BilgiBeyniPage() {
  const kaynaklar = [
    { baslik: "Google Search Central: Yinelenen URL'leri Birleştirme", yetki: "SEVİYE 1 RESMİ", durum: "GÜNCEL", url: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls" },
    { baslik: "Google Search Central: Robots.txt Teknik Şartnamesi (RFC 9309)", yetki: "SEVİYE 1 RESMİ", durum: "GÜNCEL", url: "https://developers.google.com/search/docs/crawling-indexing/robots/robots_txt" },
    { baslik: "Google Search Central: Robots Meta Etiketleri ve X-Robots-Tag", yetki: "SEVİYE 1 RESMİ", durum: "GÜNCEL", url: "https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag" },
    { baslik: "Google Search Central: Yapılandırılmış Veriye Giriş & Schema.org", yetki: "SEVİYE 1 RESMİ", durum: "GÜNCEL", url: "https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data" },
    { baslik: "W3C & Google: Core Web Vitals (CWV) Performans Eşikleri", yetki: "SEVİYE 1 RESMİ", durum: "GÜNCEL", url: "https://developers.google.com/search/docs/appearance/core-web-vitals" },
    { baslik: "Google Search: Meta Keywords Etiketi Desteği (Kullanımdan Kaldırıldı)", yetki: "SEVİYE 1 RESMİ", durum: "GEÇERSİZ KILINDI", url: "https://developers.google.com/search/docs/historical/meta-keywords" }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-400" />
            <span>SEO Bilgi Beyni & Hibrit RAG Arama</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Yapay zekanın ürettiği tüm öneriler Google'ın resmi seviye-1 dokümantasyonuyla çapraz eşleştirilerek doğrulanır.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-medium">İndekslenen Doküman Parçaları</span>
          <div className="text-3xl font-extrabold text-white mt-2">1.450 Parça</div>
          <span className="text-xs text-emerald-400">Vektör + BM25 Sözcüksel İndeks</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-medium">Yanılsama Önleme Güvencesi</span>
          <div className="text-3xl font-extrabold text-emerald-400 mt-2">%100</div>
          <span className="text-xs text-slate-400">Yalnızca resmi kılavuzlardan alıntı</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-medium">Eski Kılavuz Filtresi</span>
          <div className="text-3xl font-extrabold text-purple-400 mt-2">Aktif</div>
          <span className="text-xs text-slate-400">Geçersiz SEO pratikleri önerilmez</span>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800">
          <h3 className="font-semibold text-white text-base">Güvenilir Bilgi Kaynakları Koleksiyonu</h3>
        </div>
        <div className="divide-y divide-slate-800/80">
          {kaynaklar.map((k, idx) => (
            <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-all">
              <div className="space-y-1">
                <div className="font-semibold text-white text-sm">{k.baslik}</div>
                <div className="font-mono text-xs text-indigo-400">{k.url}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {k.yetki}
                </span>
                <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                  k.durum === "GÜNCEL" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                  "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}>
                  {k.durum}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
