"use client";

import React from "react";
import Link from "next/link";
import { useQueue } from "@/hooks/useQueue";
import { cn } from "@/lib/cn";
import { SITE_HEALTH_TABS } from "@/lib/nav";

export function isSiteHealthPath(path: string): boolean {
  return SITE_HEALTH_TABS.some((t) => t.href === path);
}

/** Site sağlığı alt sayfaları menüde tek giriş; aralarında bu sekmelerle geçilir. */
export function SiteHealthTabs({ currentPath }: { currentPath: string }) {
  const queue = useQueue();
  return (
    <nav aria-label="Site sağlığı bölümleri" className="max-w-7xl mx-auto mb-5 border-b border-line overflow-x-auto custom-scrollbar">
      <ul className="flex gap-1 min-w-max">
        {SITE_HEALTH_TABS.map((t) => {
          const active = t.href === currentPath;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 h-10 px-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                  active ? "border-accent text-ink font-semibold" : "border-transparent text-muted hover:text-ink"
                )}
              >
                {t.name}
                {t.href === "/issues" && queue.critical > 0 && (
                  <span className="font-mono text-2xs px-1.5 py-0.5 rounded-sm tabular-nums bg-critical-soft text-critical">{queue.critical}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
