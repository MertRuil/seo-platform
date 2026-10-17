"use client";

import React from "react";
import { Scale } from "lucide-react";
import { scanTurkishCompliance } from "@/lib/compliance-tr";
import { scanEuCompliance } from "@/lib/compliance-eu";
import { scanUsCompliance } from "@/lib/compliance-us";
import { scanAsiaCompliance } from "@/lib/compliance-asia";
import { scanTextForUkCompliance } from "@/lib/compliance-uk";
import { scanTextForMenaCompliance } from "@/lib/compliance-mena";

/**
 * Bir metindeki reklam/tüketici mevzuatı risklerini tek rozetle gösterir.
 * Tarama tarayıcıda, kural setleriyle yapılır (TR, AB, ABD, BK, Asya, MENA).
 */
export function ComplianceFlags({ text }: { text: string }) {
  const hits = [
    { region: "TR", v: scanTurkishCompliance(text) },
    { region: "AB", v: scanEuCompliance(text) },
    { region: "ABD", v: scanUsCompliance(text) },
    { region: "BK", v: scanTextForUkCompliance(text) },
    { region: "Asya", v: scanAsiaCompliance(text) },
    { region: "MENA", v: scanTextForMenaCompliance(text) },
  ].filter((h) => h.v.length > 0);
  if (hits.length === 0) return null;
  const first = hits[0].v[0];
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-2xs font-semibold bg-critical-soft text-critical border border-critical/30"
      title={hits.map((h) => `${h.region}: ${h.v[0].title} (${h.v[0].legalBasis})`).join("\n")}
    >
      <Scale className="w-3 h-3 shrink-0" aria-hidden />
      Mevzuat riski ({hits.map((h) => h.region).join(", ")}): {first.title}
    </span>
  );
}
