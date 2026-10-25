"use client";

import React from "react";
import { cn } from "@/lib/cn";

export interface PageTab<K extends string> {
  key: K;
  label: string;
}

interface PageTabsProps<K extends string> {
  tabs: PageTab<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  idPrefix: string;
}

export const tabPanelProps = (idPrefix: string, key: string) => ({
  role: "tabpanel" as const,
  id: `${idPrefix}-panel-${key}`,
  "aria-labelledby": `${idPrefix}-tab-${key}`,
});

/** Uzun sayfayı bölümlere ayıran sekme çubuğu; sağ/sol ok tuşlarıyla sekmeler arasında geçilir. */
export function PageTabs<K extends string>({ tabs, value, onChange, label, idPrefix }: PageTabsProps<K>) {
  const move = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onChange(next.key);
    document.getElementById(`${idPrefix}-tab-${next.key}`)?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="flex gap-1 border-b border-line overflow-x-auto overflow-y-hidden custom-scrollbar">
      {tabs.map((t, i) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${t.key}`}
            aria-selected={active}
            aria-controls={`${idPrefix}-panel-${t.key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => move(e, i)}
            className={cn(
              "h-10 px-3 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              active ? "border-accent text-ink font-semibold" : "border-transparent text-muted hover:text-ink"
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
