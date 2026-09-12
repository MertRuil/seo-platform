"use client";

import React, { useState } from "react";
import { FileText, CheckCircle2, XCircle, Search } from "lucide-react";

export default function TarananSayfalarPage() {
  const [arama, setArama] = useState("");

  const sayfalar = [
    { url: "https://flagship-store.com/", durum: 200, baslik: "Ana Sayfa | Otonom E-Ticaret Deneyimi", canonical: "Kendisi", indeks: true, kelime: 1420 },
    { url: "https://flagship-store.com/urunler/ayakkabi", durum: 200, baslik: "Spor ve Koşu Ayakkabıları Modelleri", canonical: "Kendisi", indeks: true, kelime: 980 },
    { url: "https://flagship-store.com/urunler/kurumsal", durum: 200, baslik: "Kurumsal Satış & Toplu Tedarik", canonical: "Döngü (Hatalı)", indeks: false, kelime: 640 },
    { url: "https://flagship-store.com/blog/eski-yazi", durum: 301, baslik: "Yönlendirme Sayfası", canonical: "-", indeks: false, kelime: 0 },
    { url: "https://flagship-store.com/404-broken", durum: 404, baslik: "Sayfa Bulunamadı", canonical: "-", indeks: false, kelime: 30 },
    { url: "https://flagship-store.com/fiyatlandirma", durum: 200, baslik: "Fiyatlandırma & Şeffaf Paketler", canonical: "Kendisi", indeks: true, kelime: 1100 }
  ];

  const filtrelenmis = sayfalar.filter(s => s.url.toLowerCase().includes(arama.toLowerCase()) || s.baslik.toLowerCase().includes(arama.toLowerCase()));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e4e8] dark:border-[#343633] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#121316] dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#3157e5] dark:text-indigo-400" />
            <span>Taranan Sayfalar ve İndeks Durumu</span>
          </h1>
          <p className="text-sm text-[#656971] dark:text-[#8c8d89] mt-1">
            Web tarayıcısının keşfettiği URL'ler, HTTP yanıt kodları, canonical hedefleri ve indeks uygunluğu.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-[#8a8e96] dark:text-[#6f6d66] absolute left-3 top-3" />
          <input
            type="text"
            placeholder="URL veya başlık ara..."
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            className="w-full bg-white dark:bg-[#202120] border border-[#cfd3da] dark:border-[#343633] rounded-lg pl-9 pr-4 py-2 text-xs text-[#121316] dark:text-white placeholder-[#8a8e96] dark:placeholder-[#6f6d66] focus:outline-none focus:border-[#3157e5] transition-all shadow-xs"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#4b4f58] dark:text-[#c4c6cd]">
            <thead className="bg-[#f5f6f8] dark:bg-[#171817] text-[#656971] dark:text-[#8c8d89] border-b border-[#e2e4e8] dark:border-[#343633] uppercase font-semibold">
              <tr>
                <th className="p-4">Sayfa URL & Başlık</th>
                <th className="p-4 text-center">HTTP Kodu</th>
                <th className="p-4">Canonical Durumu</th>
                <th className="p-4 text-center">İndekslenebilir</th>
                <th className="p-4 text-right">Kelime Sayısı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e4e8] dark:divide-[#343633]">
              {filtrelenmis.map((sayfa, idx) => (
                <tr key={idx} className="hover:bg-[#f9fafb] dark:hover:bg-[#262725] transition-colors">
                  <td className="p-4 max-w-md">
                    <div className="font-semibold text-[#121316] dark:text-white text-sm truncate">{sayfa.baslik}</div>
                    <div className="font-mono text-[#3157e5] dark:text-indigo-400 text-[11px] truncate flex items-center gap-1 mt-0.5">
                      <span>{sayfa.url}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-0.5 rounded font-bold font-mono text-xs ${
                      sayfa.durum === 200 ? "bg-[#0f927c]/10 text-[#0f927c] dark:bg-emerald-500/10 dark:text-emerald-400 border border-[#0f927c]/20 dark:border-emerald-500/20" :
                      sayfa.durum === 301 ? "bg-[#3157e5]/10 text-[#3157e5] dark:bg-blue-500/10 dark:text-blue-400 border border-[#3157e5]/20 dark:border-blue-500/20" :
                      "bg-rose-500/10 text-rose-600 dark:text-red-400 border border-rose-500/20"
                    }`}>
                      {sayfa.durum}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-[#121316] dark:text-slate-300 text-xs">
                    {sayfa.canonical === "Döngü (Hatalı)" ? (
                      <span className="text-rose-600 dark:text-red-400 font-semibold">{sayfa.canonical}</span>
                    ) : (
                      sayfa.canonical
                    )}
                  </td>
                  <td className="p-4 text-center">
                    {sayfa.indeks ? (
                      <CheckCircle2 className="w-4 h-4 text-[#0f927c] dark:text-emerald-400 mx-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-500 dark:text-red-400 mx-auto" />
                    )}
                  </td>
                  <td className="p-4 text-right font-mono text-[#656971] dark:text-slate-300">
                    {sayfa.kelime > 0 ? sayfa.kelime.toLocaleString("tr-TR") : "-"}
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
