"use client";

import React from "react";
import { TrendingUp, MousePointerClick, Eye, Hash, ArrowUpRight } from "lucide-react";

export default function AramaPerformansiPage() {
  const sorgular = [
    { sorgu: "otonom seo platformu", tiklama: 14200, gosterim: 128000, to: "%11.09", pozisyon: "2.1" },
    { sorgu: "yapay zeka seo işletim sistemi", tiklama: 9840, gosterim: 94500, to: "%10.41", pozisyon: "1.8" },
    { sorgu: "teknik seo denetim yazılımı", tiklama: 6510, gosterim: 82000, to: "%7.93", pozisyon: "3.4" },
    { sorgu: "otomatik canonical düzeltme", tiklama: 4200, gosterim: 68000, to: "%6.17", pozisyon: "4.2" },
    { sorgu: "sayfa hızı ve lcp optimizasyonu", tiklama: 3150, gosterim: 54000, to: "%5.83", pozisyon: "5.1" }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-400" />
            <span>Google Search Console Arama Performansı</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Organik arama sonuçlarındaki tıklama, gösterim, tıklama oranı (TO) ve ortalama sıra pozisyonu.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-400 font-medium">Toplam Organik Tıklama</div>
          <div className="text-3xl font-extrabold text-white mt-2">142.8B</div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Son 28 günde +%8.1 artış</span>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-400 font-medium">Toplam Gösterim</div>
          <div className="text-3xl font-extrabold text-white mt-2">2.41M</div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+%14.2 artış</span>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-400 font-medium">Ortalama Tıklama Oranı (TO)</div>
          <div className="text-3xl font-extrabold text-indigo-400 mt-2">%5.95</div>
          <div className="text-xs text-slate-400 mt-1">Sektör ortalamasının üzerinde</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-400 font-medium">Ortalama Sıra Pozisyonu</div>
          <div className="text-3xl font-extrabold text-white mt-2">6.8</div>
          <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+1.4 sıra yükselme</span>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800">
          <h3 className="font-semibold text-white text-base">En Çok Trafik Getiren Arama Sorguları</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold">
              <tr>
                <th className="p-4">Hedef Arama Sorgusu</th>
                <th className="p-4 text-right">Tıklama</th>
                <th className="p-4 text-right">Gösterim</th>
                <th className="p-4 text-right">Tıklama Oranı (TO)</th>
                <th className="p-4 text-right">Ort. Sıra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {sorgular.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 font-semibold text-white">{item.sorgu}</td>
                  <td className="p-4 text-right font-mono text-emerald-400 font-bold">{item.tiklama.toLocaleString("tr-TR")}</td>
                  <td className="p-4 text-right font-mono text-slate-300">{item.gosterim.toLocaleString("tr-TR")}</td>
                  <td className="p-4 text-right font-mono text-indigo-400 font-bold">{item.to}</td>
                  <td className="p-4 text-right font-mono text-white font-bold">{item.pozisyon}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
