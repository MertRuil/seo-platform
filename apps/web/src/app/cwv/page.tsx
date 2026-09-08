"use client";

import React from "react";
import { Zap, CheckCircle2, Clock, Activity, Move } from "lucide-react";

export default function CoreWebVitalsPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-teal-400" />
            <span>Web Hayati Değerleri (Core Web Vitals - CrUX)</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Chrome Kullanıcı Deneyimi Raporu (CrUX) 75. yüzdelik dilim gerçek kullanıcı saha metrikleri.
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Google Sıralama Kriterini Karşılıyor
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Largest Contentful Paint (LCP)</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-4xl font-extrabold text-emerald-400">1.8 sn</div>
          <div className="text-xs text-slate-300">İyi Eşik Değeri: &le; 2.5 saniye</div>
          <p className="text-xs text-slate-400 pt-2 border-t border-slate-800">
            Sayfanın ana içerik görseli ve metin bloğunun ekrana gelme hızı.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Interaction to Next Paint (INP)</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-4xl font-extrabold text-emerald-400">85 ms</div>
          <div className="text-xs text-slate-300">İyi Eşik Değeri: &le; 200 ms</div>
          <p className="text-xs text-slate-400 pt-2 border-t border-slate-800">
            Kullanıcının butonlara veya bağlantılara tıkladığında tarayıcının tepki süresi.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Cumulative Layout Shift (CLS)</span>
            <Move className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-4xl font-extrabold text-emerald-400">0.02</div>
          <div className="text-xs text-slate-300">İyi Eşik Değeri: &le; 0.1</div>
          <p className="text-xs text-slate-400 pt-2 border-t border-slate-800">
            Sayfa yüklenirken öğelerin beklenmedik biçimde yer değiştirmeme oranı.
          </p>
        </div>
      </div>
    </div>
  );
}
