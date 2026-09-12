import React from "react";
import { cn } from "@/lib/cn";

interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
  className?: string;
}

export function PageHeader({ icon, title, description, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-line pb-5", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="font-mono text-2xs uppercase tracking-wider text-muted mb-1">{eyebrow}</div>}
        <h1 className="text-xl font-semibold text-ink flex items-center gap-2 leading-7">
          {icon && <span className="text-accent shrink-0" aria-hidden>{icon}</span>}
          <span>{title}</span>
        </h1>
        {description && <p className="text-sm text-muted mt-1 max-w-3xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
