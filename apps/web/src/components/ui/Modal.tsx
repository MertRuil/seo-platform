"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Erişilebilir diyalog: role=dialog, Esc ile kapanır, açılınca odak içeri girer, gölge yalnızca burada. */
export function Modal({ open, onClose, title, icon, children, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const first = panelRef.current?.querySelector<HTMLElement>("input, button, textarea, select, [tabindex]");
    first?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <button type="button" aria-label="Kapat" onClick={onClose} className="absolute inset-0 bg-black/50 cursor-default" tabIndex={-1} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn("relative w-full max-w-lg bg-surface border border-line rounded-lg shadow-pop", className)}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <h2 id="modal-title" className="text-base font-semibold text-ink flex items-center gap-2">
            {icon && <span className="text-accent" aria-hidden>{icon}</span>}
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Kapat" className="w-8 h-8 inline-flex items-center justify-center rounded-sm text-muted hover:text-ink hover:bg-surface-2 cursor-pointer">
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
