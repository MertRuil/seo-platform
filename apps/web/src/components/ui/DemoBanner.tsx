"use client";

import React from "react";
import Link from "next/link";
import { FlaskConical, ArrowRight } from "lucide-react";
import { DEMO_REASON_TEXT, type DemoReason, type DataSource } from "@/lib/dataSource";

interface DemoBannerProps {
  source: DataSource;
  reason?: DemoReason;
  error?: string;
}

/** Örnek veri hiçbir zaman bantsız görünmez. Neden örnek olduğunu ve çıkış yolunu söyler. */
export function DemoBanner({ source, reason, error }: DemoBannerProps) {
  if (source !== "demo") return null;
  const text = reason ? DEMO_REASON_TEXT[reason] : "Örnek veri gösteriliyor.";
  const showCta = reason === "no-site" || reason === "no-crawl" || reason === "no-org";
  return (
    <div role="status" className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-sm bg-warn-soft text-warn border-l-2 border-warn text-xs">
      <div className="flex items-center gap-2 min-w-0">
        <FlaskConical className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span className="font-semibold shrink-0">Örnek veri</span>
        <span className="truncate">
          {text}
          {error ? ` (${error})` : ""}
        </span>
      </div>
      {showCta && (
        <Link href="/crawls" className="inline-flex items-center gap-1 font-semibold hover:underline shrink-0">
          İlk taramayı başlat <ArrowRight className="w-3 h-3" aria-hidden />
        </Link>
      )}
    </div>
  );
}
