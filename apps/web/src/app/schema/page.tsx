"use client";

import React from "react";
import { Code2 } from "lucide-react";

export default function YapilandirilmisVeriPage() {
  const semalar = [
    { tur: "Organization", sayfa: "https://flagship-store.com/", durum: "Geçerli", zenginSonuc: "Knowledge Graph", eksik: "Yok" },
    { tur: "Product", sayfa: "https://flagship-store.com/urunler/ayakkabi", durum: "Geçerli", zenginSonuc: "Fiyat & Stok Rozeti", eksik: "Yok" },
    { tur: "Article", sayfa: "https://flagship-store.com/blog/rehber", durum: "Geçerli", zenginSonuc: "Zengin Makale Görünümü", eksik: "Yok" },
    { tur: "BreadcrumbList", sayfa: "Site Geneli (124 Sayfa)", durum: "Geçerli", zenginSonuc: "Hiyerarşik URL Yolu", eksik: "Yok" }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e4e8] dark:border-[#343633] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#121316] dark:text-white flex items-center gap-2">
            <Code2 className="w-6 h-6 text-[#3157e5] dark:text-indigo-400" />
            <span>Schema.org Yapılandırılmış Veri & Zengin Sonuçlar</span>
          </h1>
          <p className="text-sm text-[#656971] dark:text-[#8c8d89] mt-1">
            Google Search Central standartlarına uygun JSON-LD şemaları ve sıfır-halüsinasyon doğrulaması.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-[#e2e4e8] dark:border-[#343633] bg-[#fafbfc] dark:bg-[#171817] flex items-center justify-between">
          <h3 className="font-semibold text-[#121316] dark:text-white text-base">Aktif JSON-LD Şema Varlıkları</h3>
          <span className="text-xs text-[#0f927c] dark:text-emerald-400 font-semibold px-2.5 py-1 rounded bg-[#0f927c]/10 dark:bg-emerald-500/10 border border-[#0f927c]/20 dark:border-emerald-500/20">
            Sözdizimi Hatası Yok
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#4b4f58] dark:text-[#c4c6cd]">
            <thead className="bg-[#f5f6f8] dark:bg-[#171817] text-[#656971] dark:text-[#8c8d89] border-b border-[#e2e4e8] dark:border-[#343633] uppercase font-semibold">
              <tr>
                <th className="p-4">Şema Türü (@type)</th>
                <th className="p-4">Uygulanan Sayfa</th>
                <th className="p-4">Uygun Zengin Sonuç</th>
                <th className="p-4 text-center">Doğrulama Durumu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e4e8] dark:divide-[#343633]">
              {semalar.map((s, idx) => (
                <tr key={idx} className="hover:bg-[#f9fafb] dark:hover:bg-[#262725] transition-colors">
                  <td className="p-4 font-mono font-bold text-[#3157e5] dark:text-indigo-300">{s.tur}</td>
                  <td className="p-4 font-mono text-[#656971] dark:text-slate-400 text-xs">{s.sayfa}</td>
                  <td className="p-4 font-medium text-[#121316] dark:text-white">{s.zenginSonuc}</td>
                  <td className="p-4 text-center">
                    <span className="px-2.5 py-1 rounded text-xs font-semibold bg-[#0f927c]/10 text-[#0f927c] dark:bg-emerald-500/10 dark:text-emerald-400 border border-[#0f927c]/20 dark:border-emerald-500/20">
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
