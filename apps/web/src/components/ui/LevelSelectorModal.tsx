"use client";

import React, { useEffect, useState } from "react";
import { useDensity, DensityMode } from "@/context/DensityContext";
import { Check, Gauge, Sprout, ArrowRight } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const OPTIONS: Array<{ value: DensityMode; title: string; tag: string; lead: string; points: string[]; Icon: React.ComponentType<{ className?: string }> }> = [
  {
    value: "summary",
    title: "Sade görünüm",
    tag: "Önerilen",
    lead: "İşletme sahipleri ve SEO'ya yeni başlayanlar için.",
    points: ["Sitenin durumu tek cümleyle", "Teknik kod ve ham veriler gizli", "Önce yapılacak işler öne çıkar"],
    Icon: Sprout,
  },
  {
    value: "expert",
    title: "Uzman görünüm",
    tag: "Ajans ve uzman",
    lead: "Ayrıntılı analiz isteyen SEO uzmanları ve ajanslar için.",
    points: ["Trafik ve görünürlük eğrileri", "Önce/sonra kod karşılaştırmaları", "Tarama, şema ve deney ayrıntıları"],
    Icon: Gauge,
  },
];

/** Görünüm seçimi. İlk girişte zorla açılmaz; üst çubuktaki yardım düğmesinden açılır. */
export function LevelSelectorModal() {
  const { density, showLevelModal, setShowLevelModal, selectLevel } = useDensity();
  const [selected, setSelected] = useState<DensityMode>(density);

  useEffect(() => {
    if (showLevelModal) setSelected(density);
  }, [showLevelModal, density]);

  return (
    <Modal open={showLevelModal} onClose={() => setShowLevelModal(false)} title="Görünüm seçin" className="max-w-2xl">
      <p className="text-sm text-muted mb-4">Aynı veriler iki farklı ayrıntı düzeyinde gösterilir. Tercihinizi istediğiniz an üst çubuktan değiştirebilirsiniz.</p>
      <div role="radiogroup" aria-label="Görünüm" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map(({ value, title, tag, lead, points, Icon }) => {
          const active = selected === value;
          return (
            <label
              key={value}
              className={cn(
                "relative flex flex-col p-4 rounded-md border-2 cursor-pointer transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                active ? "border-accent bg-accent/5" : "border-line bg-surface hover:border-line-strong"
              )}
            >
              <input type="radio" name="calpeo-density" value={value} checked={active} onChange={() => setSelected(value)} className="sr-only" />
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={cn("w-9 h-9 rounded-md flex items-center justify-center", value === "summary" ? "bg-evidence-soft text-evidence" : "bg-accent-soft text-accent-ink")} aria-hidden>
                  <Icon className="w-5 h-5" />
                </span>
                <span className={cn("w-5 h-5 rounded-full border flex items-center justify-center", active ? "border-accent bg-accent-fill text-accent-on" : "border-line-strong")} aria-hidden>
                  {active && <Check className="w-3.5 h-3.5" />}
                </span>
              </div>
              <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{tag}</span>
              <span className="text-base font-semibold text-ink">{title}</span>
              <span className="text-xs text-muted mt-1">{lead}</span>
              <ul className="mt-3 space-y-1.5 text-xs text-ink border-t border-line pt-3">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-evidence shrink-0 mt-0.5" aria-hidden />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </label>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="secondary" onClick={() => setShowLevelModal(false)}>
          Vazgeç
        </Button>
        <Button onClick={() => selectLevel(selected)} icon={<ArrowRight className="w-4 h-4" aria-hidden />}>
          {selected === "summary" ? "Sade görünümü kullan" : "Uzman görünümü kullan"}
        </Button>
      </div>
    </Modal>
  );
}
