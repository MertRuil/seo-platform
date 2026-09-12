"use client";

import React from "react";
import { cn } from "@/lib/cn";

const inputBase =
  "w-full h-9 bg-surface border border-line-strong rounded-sm px-3 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-colors disabled:opacity-60";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode; mono?: boolean };

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ icon, mono, className, ...rest }, ref) {
  if (!icon) return <input ref={ref} className={cn(inputBase, mono && "font-mono", className)} {...rest} />;
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none" aria-hidden>
        {icon}
      </span>
      <input ref={ref} className={cn(inputBase, "pl-9", mono && "font-mono", className)} {...rest} />
    </div>
  );
});

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, "h-auto py-2 min-h-[80px]", className)} {...rest} />;
}

export function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-ink mb-1">
      {children}
      {hint && <span className="font-normal text-muted ml-1">{hint}</span>}
    </label>
  );
}

/** Filtre çipleri: aria-pressed ile durum bildirir. */
export function FilterChips<T extends string>({ options, value, onChange, label }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-1 flex-wrap">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-8 px-3 rounded-sm text-xs font-semibold transition-colors cursor-pointer",
              active ? "bg-accent-fill text-white" : "bg-surface text-muted border border-line hover:text-ink hover:bg-surface-2"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** İki-üç seçenekli bölümlü kontrol (tema, yoğunluk, dönem). */
export function Segmented<T extends string | number>({ options, value, onChange, label, size = "sm" }: { options: Array<{ value: T; label: React.ReactNode; title?: string }>; value: T; onChange: (v: T) => void; label: string; size?: "sm" | "md" }) {
  return (
    <div role="group" aria-label={label} className="inline-flex items-center p-0.5 rounded-sm bg-surface-2 border border-line">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            title={o.title}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm font-medium transition-colors cursor-pointer",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
              active ? "bg-surface text-ink font-semibold border border-line" : "text-muted hover:text-ink border border-transparent"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
