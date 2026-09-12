import React from "react";
import { cn } from "@/lib/cn";

interface PanelProps {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
  /** flush: tablo gibi kenara yaslı içerik; iç boşluk yok */
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
  as?: "section" | "div";
}

/** Sayfa zemininin üstündeki tek panel katmanı. Panel içinde kart yok; satır ve ayırıcı var. */
export function Panel({ title, sub, actions, flush, className, children, as: Tag = "section" }: PanelProps) {
  const hasHeader = title || sub || actions;
  return (
    <Tag className={cn("bg-surface border border-line rounded-md min-w-0", className)}>
      {hasHeader && (
        <header className={cn("flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 px-5 pt-4", flush ? "pb-4 border-b border-line" : "pb-3")}>
          <div className="min-w-0">
            {title && <h2 className="text-base font-semibold text-ink leading-6">{title}</h2>}
            {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && "px-5 pb-5", !flush && !hasHeader && "pt-5")}>{children}</div>
    </Tag>
  );
}

/** Panel içinde ikincil vurgu bloğu (kart değil; zemin farkıyla ayrılır). */
export function Inset({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("bg-surface-2 border border-line rounded-sm p-3", className)}>{children}</div>;
}
