"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldAlert,
  Zap,
  Loader2,
  Lock,
} from "lucide-react";
import { api } from "@/lib/api";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  featureTitle?: string;
  featureDescription?: string;
  targetPlanCode?: string;
}

export function UpgradeModal({
  isOpen,
  onClose,
  orgId,
  featureTitle = "Bu özellik üst planlarda kullanılabilir",
  featureDescription = "Otomatik kod ve içerik düzeltmeleri, JavaScript render motoru ve yüksek AI kredileri için Pro plana geçin.",
  targetPlanCode = "pro",
}: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const checkout = await api.createCheckoutSession(orgId, {
        plan_code: targetPlanCode,
        interval: "month",
        return_url: window.location.href,
      });

      if (checkout.checkout_url) {
        window.location.href = checkout.checkout_url;
      }
    } catch (e: any) {
      // Eğer checkout session sandbox modunda ise veya yerel dev ise plan switch dene
      try {
        await api.switchPlan(orgId, targetPlanCode);
        window.location.reload();
      } catch (err: any) {
        setError(e?.message || "Ödeme oturumu başlatılamadı");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
      <div
        className="relative w-full max-w-lg bg-surface border border-line rounded-lg shadow-pop overflow-hidden text-ink"
        role="dialog"
        aria-modal="true"
      >
        {/* Kapatma Butonu */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-ink p-1 rounded-sm hover:bg-surface-2 transition-colors cursor-pointer z-10"
          aria-label="Kapat"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Başlık ve Vurgulu Üst Banner */}
        <div className="bg-accent-soft/40 border-b border-line p-6 relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-accent text-accent-ink flex items-center justify-center shrink-0 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-semibold bg-accent-soft text-accent-ink mb-1">
                <Lock className="w-3 h-3" /> PRO YÜKSELTME
              </div>
              <h2 className="text-base font-bold text-ink leading-tight">{featureTitle}</h2>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted leading-relaxed">{featureDescription}</p>
        </div>

        {/* Avantajlar Listesi */}
        <div className="p-6 space-y-4">
          <div className="text-2xs font-mono uppercase tracking-wider text-muted font-semibold">
            Pro Plan ile Dahil Olanlar
          </div>
          <ul className="space-y-2.5 text-xs text-ink">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>
                <strong>50.000 Sayfa / Ay</strong> tarama kapasitesi ve limitsiz denetim
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>
                <strong>500 Aylık AI Kredisi</strong> ile otonom karar ve roadmap üretimi
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>
                <strong>Otomatik Düzeltme (Auto-Fix)</strong>: CMS ve kod tabanına tek tıkla güvenli patch
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>
                <strong>Headless Chrome JS Rendering</strong> (React, Vue, SPA taraması)
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>
                <strong>SEO Deneyleri (Causal Impact)</strong> & A/B Diff testi
              </span>
            </li>
          </ul>

          {error && (
            <div className="p-3 bg-critical-soft border border-critical/30 rounded-sm text-xs text-critical flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Eylem Butonları */}
          <div className="pt-3 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-accent-ink hover:bg-accent-hover font-semibold text-xs rounded-sm transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Yönlendiriliyor...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Hemen Pro Plana Geç ($119 / Ay)</span>
                </>
              )}
            </button>
            <Link
              href="/billing"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-surface-2 hover:bg-surface text-ink text-xs font-medium rounded-sm border border-line transition-colors text-center"
            >
              <span>Tüm Planlar</span>
              <ArrowRight className="w-3.5 h-3.5 text-muted" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
