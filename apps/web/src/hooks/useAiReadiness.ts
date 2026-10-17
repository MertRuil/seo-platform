"use client";

import { useQuery } from "@tanstack/react-query";
import { summarizeAnswerBotAccess, type BotAccess, type ReadinessCheck } from "@/lib/geo-readiness";

export interface AiReadiness {
  url: string;
  checked_at: string;
  bots: BotAccess[];
  checks: ReadinessCheck[];
}

/** AI tarayıcı erişim denetimi; pano ve rapor aynı sonucu 10 dakika boyunca paylaşır. */
export function useAiReadiness(url: string | null | undefined) {
  const q = useQuery({
    queryKey: ["ai-readiness", url],
    enabled: Boolean(url),
    staleTime: 10 * 60_000,
    retry: 0,
    queryFn: async (): Promise<AiReadiness> => {
      const r = await fetch("/api/v1/geo/readiness", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "AI erişim denetimi yapılamadı");
      return data as AiReadiness;
    },
  });
  const answerBots = q.data?.bots.filter((b) => b.purpose !== "training") ?? [];
  const blocked = answerBots.filter((b) => b.status === "blocked");
  return { ...q, answerBots, blocked, access: summarizeAnswerBotAccess(answerBots) };
}
