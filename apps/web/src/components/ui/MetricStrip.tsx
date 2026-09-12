"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MetricItem {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: string;
  /** "+8,1 %" gibi eğilim metni; yön ok ikonunu belirler */
  trend?: { text: string; direction: "up" | "down" | "flat" };
  hint?: React.ReactNode;
  tone?: "default" | "evidence" | "warn" | "critical" | "muted";
  href?: string;
}

const valueTone: Record<NonNullable<MetricItem["tone"]>, string> = {
  default: "text-ink",
  evidence: "text-evidence",
  warn: "text-warn",
  critical: "text-critical",
  muted: "text-muted",
};

const colsClass: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
};

/** Eşit ağırlıkta kartlar yerine tek bir nesne: ayırıcılarla bölünmüş metrik şeridi. */
export function MetricStrip({ items, className }: { items: MetricItem[]; className?: string }) {
  return (
    <div className={cn("bg-surface border border-line rounded-md grid grid-cols-1 divide-y sm:divide-y-0 sm:divide-x divide-line", colsClass[items.length] ?? "sm:grid-cols-4", className)}>
      {items.map((m, i) => {
        const inner = (
          <>
            <div className="text-xs text-muted truncate">{m.label}</div>
            <div className={cn("mt-1 font-editorial text-2xl leading-8 tabular-nums", valueTone[m.tone ?? "default"])}>
              {m.value}
              {m.unit && <span className="font-mono text-2xs text-muted ml-1.5 align-middle">{m.unit}</span>}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 text-xs min-h-[18px]">
              {m.trend ? (
                <span className={cn("inline-flex items-center gap-0.5 font-semibold", m.trend.direction === "up" ? "text-evidence" : m.trend.direction === "down" ? "text-critical" : "text-muted")}>
                  {m.trend.direction === "up" && <ArrowUpRight className="w-3 h-3" aria-hidden />}
                  {m.trend.direction === "down" && <ArrowDownRight className="w-3 h-3" aria-hidden />}
                  {m.trend.text}
                </span>
              ) : (
                <span />
              )}
              {m.hint && <span className="text-muted font-mono text-2xs truncate">{m.hint}</span>}
            </div>
          </>
        );
        const cls = "block px-5 py-4 min-w-0";
        return m.href ? (
          <Link key={i} href={m.href} className={cn(cls, "hover:bg-surface-2 transition-colors")}>
            {inner}
          </Link>
        ) : (
          <div key={i} className={cls}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
