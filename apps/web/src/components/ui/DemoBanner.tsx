"use client";

import React from "react";
import Link from "next/link";
import { FlaskConical, ArrowRight, Plus } from "lucide-react";
import { DEMO_REASON_TEXT, type DemoReason, type DataSource } from "@/lib/dataSource";
import { useSite } from "@/context/SiteContext";

interface DemoBannerProps {
  source: DataSource;
  reason?: DemoReason;
  error?: string;
}

/** Örnek veri hiçbir zaman bantsız görünmez. Neden örnek olduğunu ve çıkış yolunu söyler. */
export function DemoBanner({ source, reason, error }: DemoBannerProps) {
  const { setAddSiteOpen } = useSite();
  if (source !== "demo") return null;
  const text = reason ? DEMO_REASON_TEXT[reason] : "Aşağıdaki veriler örnektir.";
  const needsSite = reason === "no-site" || reason === "no-org";
  return (
    <div role="status" className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-sm bg-warn-soft text-warn border-l-2 border-warn text-xs">
      <div className="flex items-start sm:items-center gap-2 min-w-0">
        <FlaskConical className="w-3.5 h-3.5 shrink-0 mt-0.5 sm:mt-0" aria-hidden />
        <span className="font-semibold shrink-0">Örnek veri</span>
        <span className="min-w-0">
          {text}
          {error ? ` (${error})` : ""}
        </span>
      </div>
      {needsSite && (
        <button type="button" onClick={() => setAddSiteOpen(true)} className="inline-flex items-center gap-1 font-semibold hover:underline shrink-0 cursor-pointer min-h-[32px]">
          <Plus className="w-3.5 h-3.5" aria-hidden /> Sitenizi ekleyin
        </button>
      )}
      {reason === "no-crawl" && (
        <Link href="/crawls" className="inline-flex items-center gap-1 font-semibold hover:underline shrink-0 min-h-[32px]">
          Tarama durumunu gör <ArrowRight className="w-3 h-3" aria-hidden />
        </Link>
      )}
    </div>
  );
}
