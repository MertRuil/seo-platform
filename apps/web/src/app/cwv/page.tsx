"use client";

import React from "react";
import { Zap, Clock, Activity, Move } from "lucide-react";

export default function CoreWebVitalsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e4e8] dark:border-[#343633] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#121316] dark:text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-[#0f927c] dark:text-teal-400" />
            <span>Web Hayati Değerleri (Core Web Vitals - CrUX)</span>
          </h1>
          <p className="text-sm text-[#656971] dark:text-[#8c8d89] mt-1">
            Chrome Kullanıcı Deneyimi Raporu (CrUX) 75. yüzdelik dilim gerçek kullanıcı saha metrikleri.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#0f927c]/10 text-[#0f927c] dark:bg-emerald-500/10 dark:text-emerald-400 border border-[#0f927c]/20 dark:border-emerald-500/20">
          Google Sıralama Kriterini Karşılıyor
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-6 space-y-3 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#656971] dark:text-[#8c8d89] font-medium">
            <span>Largest Contentful Paint (LCP)</span>
            <Clock className="w-4 h-4 text-[#0f927c] dark:text-emerald-400" />
          </div>
          <div className="text-4xl font-extrabold text-[#0f927c] dark:text-emerald-400">1.8 sn</div>
          <div className="text-xs text-[#656971] dark:text-slate-300">İyi Eşik Değeri: &le; 2.5 saniye</div>
          <p className="text-xs text-[#656971] dark:text-[#8c8d89] pt-2 border-t border-[#e2e4e8] dark:border-[#343633]">
            Sayfanın ana içerik görseli ve metin bloğunun ekrana gelme hızı.
          </p>
        </div>

        <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-6 space-y-3 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#656971] dark:text-[#8c8d89] font-medium">
            <span>Interaction to Next Paint (INP)</span>
            <Activity className="w-4 h-4 text-[#0f927c] dark:text-emerald-400" />
          </div>
          <div className="text-4xl font-extrabold text-[#0f927c] dark:text-emerald-400">85 ms</div>
          <div className="text-xs text-[#656971] dark:text-slate-300">İyi Eşik Değeri: &le; 200 ms</div>
          <p className="text-xs text-[#656971] dark:text-[#8c8d89] pt-2 border-t border-[#e2e4e8] dark:border-[#343633]">
            Kullanıcının butonlara veya bağlantılara tıkladığında tarayıcının tepki süresi.
          </p>
        </div>

        <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-6 space-y-3 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#656971] dark:text-[#8c8d89] font-medium">
            <span>Cumulative Layout Shift (CLS)</span>
            <Move className="w-4 h-4 text-[#0f927c] dark:text-emerald-400" />
          </div>
          <div className="text-4xl font-extrabold text-[#0f927c] dark:text-emerald-400">0.02</div>
          <div className="text-xs text-[#656971] dark:text-slate-300">İyi Eşik Değeri: &le; 0.1</div>
          <p className="text-xs text-[#656971] dark:text-[#8c8d89] pt-2 border-t border-[#e2e4e8] dark:border-[#343633]">
            Sayfa yüklenirken öğelerin beklenmedik biçimde yer değiştirmeme oranı.
          </p>
        </div>
      </div>
    </div>
  );
}
