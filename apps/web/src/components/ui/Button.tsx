"use client";

import React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "evidence" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 font-semibold rounded-sm transition-colors whitespace-nowrap select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

const variants: Record<Variant, string> = {
  primary: "bg-accent-fill text-white hover:bg-accent-hover",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong",
  ghost: "text-muted hover:text-ink hover:bg-surface-2",
  evidence: "bg-evidence text-white hover:opacity-90",
  danger: "bg-critical-soft text-critical border border-critical hover:opacity-90",
};

// Dokunmatik hedef: md = 36 px, sm = 32 px (ikon-only için minimum 32x32)
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

type ButtonProps = CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}

type LinkButtonProps = CommonProps & { href: string; external?: boolean };

export function LinkButton({ href, external, variant = "secondary", size = "md", icon, className, children }: LinkButtonProps) {
  const cls = cn(base, variants[variant], sizes[size], className);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {icon}
      {children}
    </Link>
  );
}

/** İkon-only buton: aria-label zorunlu, 32x32 minimum hedef. */
export function IconButton({ label, className, children, ...rest }: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn("inline-flex items-center justify-center w-8 h-8 rounded-sm text-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer", className)}
      {...rest}
    >
      {children}
    </button>
  );
}
