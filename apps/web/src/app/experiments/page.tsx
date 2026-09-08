"use client";

import React from "react";
import { FlaskConical, TrendingUp, CheckCircle2, ArrowUpRight } from "lucide-react";

export default function SeoDeneyleriPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-purple-400" />
            <span>SEO Deneyleri & Nedensellik Analizi (Diff-in-Diff)</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Mevsimsellik ve Google algoritma güncellemelerini ayrıştırarak Varyant vs Kontrol sayfalarının net organik etkisini ölçer.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
          <div>
            <span className="text-xs font-semibold text-purple-400 px-2.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
              56 Günlük Kohort Testi
            </span>
            <h3 className="text-base font-bold text-white mt-1">Ürün Kategori Başlıklarında Harekete Geçirici Mesaj (CTA) Testi</h3>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            İstatiksel Olarak Anlamlı
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Varyant Büyümesi (Değişen Sayfalar)</span>
            <div className="text-2xl font-bold text-emerald-400 mt-1">+%25.0</div>
            <p className="text-[11px] text-slate-400 mt-1">10 sayfalık test grubu</p>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 font-medium">Kontrol Büyümesi (Değişmeyenler)</span>
            <div className="text-2xl font-bold text-slate-300 mt-1">+%5.0</div>
            <p className="text-[11px] text-slate-400 mt-1">10 sayfalık kontrol grubu (genel pazar artışı)</p>
          </div>
          <div className="bg-slate-950/60 p-4 rounded-lg border border-purple-500/30">
            <span className="text-xs text-purple-300 font-medium">Net Nedensel Büyüme (Diff-in-Diff)</span>
            <div className="text-2xl font-bold text-purple-400 mt-1">+%20.0 Net Artış</div>
            <p className="text-[11px] text-purple-300 mt-1">Algoritma dalgalanması hariç net platform etkisi</p>
          </div>
        </div>
      </div>
    </div>
  );
}
