import React from "react";
import { cn } from "@/lib/cn";
import { SEVERITY_LABEL, type Severity } from "@/lib/demo";

export type Tone = "critical" | "warn" | "accent" | "evidence" | "neutral";

const tones: Record<Tone, string> = {
  critical: "bg-critical-soft text-critical",
  warn: "bg-warn-soft text-warn",
  accent: "bg-accent-soft text-accent-ink",
  evidence: "bg-evidence-soft text-evidence",
  neutral: "bg-surface-2 text-muted border border-line",
};

export function Badge({ tone = "neutral", mono, className, children }: { tone?: Tone; mono?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-semibold leading-4 whitespace-nowrap", mono && "font-mono font-medium tracking-wide", tones[tone], className)}>
      {children}
    </span>
  );
}

export function severityTone(s: Severity | string): Tone {
  switch (s) {
    case "CRITICAL":
      return "critical";
    case "HIGH":
    case "MEDIUM":
      return "warn";
    case "LOW":
      return "accent";
    default:
      return "neutral";
  }
}

/** Önem rengi şerit olarak (metin rengine bağımlı olmayan ikinci kodlama). */
export function severityStripeClass(s: Severity | string): string {
  switch (s) {
    case "CRITICAL":
      return "bg-critical";
    case "HIGH":
    case "MEDIUM":
      return "bg-warn";
    case "LOW":
      return "bg-accent";
    default:
      return "bg-line-strong";
  }
}

export function SeverityBadge({ severity }: { severity: Severity | string }) {
  const label = (SEVERITY_LABEL as Record<string, string>)[severity] ?? severity;
  return (
    <Badge tone={severityTone(severity)} mono>
      {label}
    </Badge>
  );
}

/** Beta etiketi: ölçümü henüz olmayan metrikler için. */
export function BetaBadge() {
  return (
    <Badge tone="warn" mono className="text-2xs px-1.5">
      BETA
    </Badge>
  );
}
