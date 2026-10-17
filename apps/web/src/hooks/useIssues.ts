"use client";

import { api } from "@/lib/api";
import { DEMO_ISSUES, type IssueItem } from "@/lib/demo";
import { healthToIssues, sortIssues } from "@/lib/mappers";
import { useSiteData } from "@/hooks/useSiteData";

const DEMO_SORTED = sortIssues(DEMO_ISSUES);

/**
 * Son taramanın sorunları: Sorunlar ekranı, pano ve menü rozeti aynı sorguyu paylaşır
 * (react-query aynı anahtarı tekilleştirir), böylece "acil sorun" sayısı her yerde aynıdır.
 */
export function useIssues() {
  const res = useSiteData<IssueItem[]>("issues", async ({ org, site, crawl }) => healthToIssues(await api.getCrawlHealth(org.id, site.id, crawl!.id)), DEMO_SORTED);
  const critical = res.data.filter((i) => i.severity === "CRITICAL").length;
  const high = res.data.filter((i) => i.severity === "HIGH").length;
  return { ...res, critical, high, urgent: critical + high };
}
