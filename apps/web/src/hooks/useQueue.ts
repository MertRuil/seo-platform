"use client";

import { api } from "@/lib/api";
import { DEMO_DASHBOARD, type QueueItem } from "@/lib/demo";
import { recommendationsToQueue } from "@/lib/mappers";
import { useSiteData } from "@/hooks/useSiteData";

/** Öneri kuyruğu: nav rozetleri, Genel Görünüm ve Öncelikli İşler aynı sorguyu paylaşır (react-query tekilleştirir). */
export function useQueue() {
  // Öneriler tarama bulgularından üretilir; ilk tamamlanmış taramaya kadar tüm ekran tutarlı biçimde örnek veridir.
  const res = useSiteData<QueueItem[]>("recommendations", async ({ org, site }) => recommendationsToQueue(await api.getRecommendations(org.id, site.id)), DEMO_DASHBOARD.queue);
  const critical = res.data.filter((q) => q.severity === "CRITICAL" || q.severity === "HIGH").length;
  return { ...res, pending: res.data.length, critical };
}
