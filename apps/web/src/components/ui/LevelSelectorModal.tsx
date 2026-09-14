"use client";

import React, { useState } from "react";
import { useDensity, DensityMode } from "@/context/DensityContext";
import { Sparkles, Gauge, Check, X, ShieldCheck, ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

export function LevelSelectorModal() {
  const { density, showLevelModal, setShowLevelModal, selectLevel } = useDensity();
  const [selected, setSelected] = useState<DensityMode>(density || "summary");

  if (!showLevelModal) return null;

  const handleConfirm = () => {
    selectLevel(selected);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-2xl bg-surface border border-line rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-headline"
      >
        {/* Üst dekoratif başlık */}
        <div className="p-6 pb-4 border-b border-line flex items-start justify-between gap-4 bg-surface-2/40">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-accent-ink font-semibold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-accent" aria-hidden />
              <span>Kişiselleştirilmiş Deneyim</span>
            </div>
            <h2 id="modal-headline" className="text-xl sm:text-2xl font-bold text-ink mt-1">
              CALPEO'ya Hoş Geldiniz!
            </h2>
            <p className="text-sm text-muted mt-1 text-balance">
              Platformu sizin ihtiyaçlarınıza göre optimize edelim. SEO bilginize en uygun görünümü seçin:
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowLevelModal(false)}
            aria-label="Kapat"
            className="p-1.5 rounded-md text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seçenek Kartları */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Sade Mod */}
            <div
              onClick={() => setSelected("summary")}
              className={cn(
                "relative flex flex-col p-5 rounded-lg border-2 cursor-pointer transition-all duration-200 text-left",
                selected === "summary"
                  ? "border-accent bg-accent/5 shadow-md"
                  : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg bg-evidence/10 text-evidence flex items-center justify-center font-bold text-lg">
                  🌱
                </div>
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                    selected === "summary"
                      ? "border-accent bg-accent text-white"
                      : "border-muted/40 bg-transparent"
                  )}
                >
                  {selected === "summary" && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              <div className="inline-block mb-1">
                <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-evidence/15 text-evidence-ink">
                  Önerilen · Kolay
                </span>
              </div>
              <h3 className="text-base font-bold text-ink">Sade & Otomatik Mod</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                İşletme sahipleri ve SEO'ya yeni başlayanlar için tasarlandı.
              </p>

              <ul className="mt-4 space-y-2 text-xs text-ink/80 border-t border-line/60 pt-3 flex-1">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-evidence shrink-0 mt-0.5" />
                  <span>Sade Türkçe durum ve trafik özeti</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-evidence shrink-0 mt-0.5" />
                  <span>Teknik terimler ve kodlar gizlenir</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-evidence shrink-0 mt-0.5" />
                  <span>Yapay zekanın <strong>1-tıkla düzeltme</strong> butonları</span>
                </li>
              </ul>
            </div>

            {/* 2. Uzman Modu */}
            <div
              onClick={() => setSelected("expert")}
              className={cn(
                "relative flex flex-col p-5 rounded-lg border-2 cursor-pointer transition-all duration-200 text-left",
                selected === "expert"
                  ? "border-accent bg-accent/5 shadow-md"
                  : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-bold text-lg">
                  ⚡
                </div>
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                    selected === "expert"
                      ? "border-accent bg-accent text-white"
                      : "border-muted/40 bg-transparent"
                  )}
                >
                  {selected === "expert" && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>
              </div>

              <div className="inline-block mb-1">
                <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-accent/15 text-accent-ink">
                  Ajans & Uzman
                </span>
              </div>
              <h3 className="text-base font-bold text-ink">Uzman & Analitik Mod</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                SEO profesyonelleri ve derin analiz isteyen ajanslar için.
              </p>

              <ul className="mt-4 space-y-2 text-xs text-ink/80 border-t border-line/60 pt-3 flex-1">
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                  <span>Çoklu GSC & AI zaman eğrileri (TrendChart)</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                  <span>Hızlı URL denetimi ve crawl telemetrisi</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                  <span>TTFB, Şema, Dizinleme ve DiD deneyleri</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-surface-2 rounded-lg text-xs text-muted">
            <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
            <span>
              Bu tercihi istediğiniz an ekranın sağ üst köşesindeki düğmeden tek tıkla değiştirebilirsiniz.
            </span>
          </div>
        </div>

        {/* Alt buton */}
        <div className="p-4 sm:p-6 border-t border-line bg-surface-2/40 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-md bg-accent hover:bg-accent-strong text-accent-contrast font-semibold text-sm shadow-sm transition-colors cursor-pointer"
          >
            <span>{selected === "summary" ? "Sade Mod İle Başla" : "Uzman Modu İle Başla"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
