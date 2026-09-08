"use client";

import React from "react";
import { Code2, CheckCircle2, ShieldCheck, AlertCircle } from "lucide-react";

export default function YapilandirilmisVeriPage() {
  const semalar = [
    { tur: "Organization", sayfa: "https://flagship-store.com/", durum: "Geçerli", zenginSonuc: "Knowledge Graph", eksik: "Yok" },
    { tur: "Product", sayfa: "https://flagship-store.com/urunler/ayakkabi", durum: "Geçerli", zenginSonuc: "Fiyat & Stok Rozeti", eksik: "Yok" },
    { tur: "Article", sayfa: "https://flagship-store.com/blog/rehber", durum: "Geçerli", zenginSonuc: "Zengin Makale Görünümü", eksik: "Yok" },
    { tur: "BreadcrumbList", sayfa: "Site Geneli (124 Sayfa)", durum: "Geçerli", zenginSonuc: "Hiyerarşik URL Yolu", eksik: "Yok" }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Code2 className="w-6 h-6 text-indigo-400" />
            <span>Schema.org Yapılandırılmış Veri & Zengin Sonuçlar</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Google Search Central standartlarına uygun JSON-LD şemaları ve sıfır-halüsinasyon doğrulaması.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-base">Aktif JSON-LD Şema Varlıkları</h3>
          <span className="text-xs text-emerald-400 font-semibold px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
            Sözdizimi Hatası Yok
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase font-semibold">
              <tr>
                <th className="p-4">Şema Türü (@type)</th>
                <th className="p-4">Uygulanan Sayfa</th>
                <th className="p-4">Uygun Zengin Sonuç</th>
                <th className="p-4 text-center">Doğrulama Durumu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {semalar.map((s, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 font-mono font-bold text-indigo-300">{s.tur}</td>
                  <td className="p-4 font-mono text-slate-400 text-xs">{s.sayfa}</td>
                  <td className="p-4 font-medium text-white">{s.zenginSonuc}</td>
                  <td className="p-4 text-center">
                    <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
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
