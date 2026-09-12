"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

/* ---------- Boş durum ---------- */
export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-6", className)}>
      {icon && <div className="text-muted mb-3" aria-hidden>{icon}</div>}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="text-sm text-muted mt-1 max-w-md">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- İskelet ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-sm bg-surface-2 animate-pulse", className)} aria-hidden />;
}

export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2.5", className)} aria-busy="true" aria-label="Yükleniyor">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn("h-4", i % 3 === 0 ? "w-3/4" : i % 3 === 1 ? "w-full" : "w-5/6")} />
      ))}
    </div>
  );
}

/* ---------- Satır içi bildirim ---------- */
export type NoticeTone = "success" | "info" | "warn" | "error";

const noticeStyles: Record<NoticeTone, { box: string; icon: React.ReactNode }> = {
  success: { box: "bg-evidence-soft text-evidence border-evidence", icon: <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden /> },
  info: { box: "bg-accent-soft text-accent-ink border-accent", icon: <Info className="w-4 h-4 shrink-0" aria-hidden /> },
  warn: { box: "bg-warn-soft text-warn border-warn", icon: <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden /> },
  error: { box: "bg-critical-soft text-critical border-critical", icon: <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden /> },
};

export function Notice({ tone = "info", children, action, onClose, className }: { tone?: NoticeTone; children: React.ReactNode; action?: React.ReactNode; onClose?: () => void; className?: string }) {
  const s = noticeStyles[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-2.5 p-3 rounded-sm border-l-2 text-sm animate-fade-in", s.box, className)}>
      <span className="mt-0.5">{s.icon}</span>
      <div className="flex-1 min-w-0 font-medium">{children}</div>
      {action}
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Kapat" className="p-1 rounded-sm hover:bg-surface-2 cursor-pointer">
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
