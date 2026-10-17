"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, CheckCircle2, ArrowRight, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  featureTitle?: string;
  featureDescription?: string;
  targetPlanCode?: string;
}

const PRO_POINTS = [
  "Ayda 50.000 sayfa tarama kapasitesi",
  "Ayda 500 AI kredisi (öneri ve içerik üretimi)",
  "Bağlı CMS veya kod deposuna onaylı düzeltme yayını",
  "JavaScript ile oluşturulan sayfaların taranması",
  "SEO deneyleri ve etki ölçümü",
];

export function UpgradeModal({
  isOpen,
  onClose,
  orgId,
  featureTitle = "Bu özellik üst planlarda kullanılabilir",
  featureDescription = "Onaylı düzeltme yayını, JavaScript taraması ve daha yüksek AI kredisi için Pro plana geçin.",
  targetPlanCode = "pro",
}: UpgradeModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ücretli plan yalnız ödeme sayfasıyla etkinleşir; ödeme açılamazsa plan değiştirilmez.
  const handleUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const checkout = await api.createCheckoutSession(orgId, {
        plan_code: targetPlanCode,
        interval: "month",
        return_url: window.location.href,
      });
      if (!checkout?.checkout_url) throw new Error("Ödeme sayfası adresi alınamadı.");
      window.location.href = checkout.checkout_url;
    } catch (e: any) {
      setError(`Ödeme sayfası açılamadı: ${e?.message || "bilinmeyen hata"}. Planınız değiştirilmedi.`);
      setLoading(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} title={featureTitle} icon={<Sparkles className="w-4 h-4" />}>
      <p className="text-sm text-muted">{featureDescription}</p>
      <div className="mt-4 text-2xs font-mono uppercase tracking-wider text-muted font-semibold">Pro planda</div>
      <ul className="mt-2 space-y-2 text-sm text-ink">
        {PRO_POINTS.map((p) => (
          <li key={p} className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-evidence shrink-0 mt-0.5" aria-hidden />
            <span>{p}</span>
          </li>
        ))}
      </ul>
      {error && (
        <Notice tone="error" className="mt-4">
          {error}
        </Notice>
      )}
      <div className="pt-5 flex flex-col sm:flex-row gap-2">
        <Button onClick={handleUpgrade} loading={loading} icon={<Zap className="w-4 h-4" aria-hidden />} className="flex-1">
          {loading ? "Ödeme sayfası açılıyor…" : "Pro plana geç ($119/ay)"}
        </Button>
        <Button
          variant="secondary"
          icon={<ArrowRight className="w-4 h-4" aria-hidden />}
          onClick={() => {
            onClose();
            router.push("/billing");
          }}
        >
          Tüm planlar
        </Button>
      </div>
    </Modal>
  );
}
