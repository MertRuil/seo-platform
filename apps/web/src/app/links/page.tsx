"use client";

import React from "react";
import { Link2, Network, AlertCircle, ArrowUpRight, ArrowRight } from "lucide-react";

export default function IcLinkAnaliziPage() {
  const topSayfalar = [
    { url: "https://flagship-store.com/", pagerank: "0.2450", gelenLink: 85, gidenLink: 42, durum: "Ana Merkez (Hub)" },
    { url: "https://flagship-store.com/urunler/ayakkabi", pagerank: "0.1420", gelenLink: 38, gidenLink: 18, durum: "Güçlü Kategori" },
    { url: "https://flagship-store.com/blog", pagerank: "0.1180", gelenLink: 32, gidenLink: 65, durum: "Otorite Dağıtıcı" },
    { url: "https://flagship-store.com/fiyatlandirma", pagerank: "0.0340", gelenLink: 3, gidenLink: 4, durum: "Yetim / Zayıf Kalan" }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Link2 className="w-6 h-6 text-indigo-400" />
            <span>Site Grafı & İç Link PageRank Analizi</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            NetworkX tabanlı yönlendirilmiş link grafı, tıklama derinliği ve yetim sayfa (orphan page) çözümleri.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-medium">Toplam Link Grafı Düğümü</span>
          <div className="text-3xl font-extrabold text-white mt-2">124 Sayfa</div>
          <span className="text-xs text-slate-400">842 Yönlendirilmiş İç Bağlantı</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-medium">Yetim Sayfa Sayısı</span>
          <div className="text-3xl font-extrabold text-amber-400 mt-2">1 Sayfa</div>
          <span className="text-xs text-amber-500 font-medium">İç link almayan hedef sayfa</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <span className="text-xs text-slate-400 font-medium">Ortalama Tıklama Derinliği</span>
          <div className="text-3xl font-extrabold text-emerald-400 mt-2">1.8 Tık</div>
          <span className="text-xs text-emerald-400 font-medium">Googlebot tarama bütçesi için optimal</span>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800">
          <h3 className="font-semibold text-white text-base">Sayfa İçi PageRank Otorite Sıralaması</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold">
              <tr>
                <th className="p-4">Sayfa URL</th>
                <th className="p-4 text-center">PageRank Skoru</th>
                <th className="p-4 text-center">Gelen Link</th>
                <th className="p-4 text-center">Giden Link</th>
                <th className="p-4 text-right">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {topSayfalar.map((s, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 font-mono text-white text-xs">{s.url}</td>
                  <td className="p-4 text-center font-mono font-bold text-indigo-400">{s.pagerank}</td>
                  <td className="p-4 text-center font-mono text-emerald-400 font-bold">{s.gelenLink}</td>
                  <td className="p-4 text-center font-mono text-slate-300">{s.gidenLink}</td>
                  <td className="p-4 text-right">
                    <span className={`px-2.5 py-1 rounded text-xs font-semibold ${
                      s.durum === "Yetim / Zayıf Kalan" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    }`}>
                      {s.durum}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
