"use client";

import { useQuery } from "@tanstack/react-query";
import { useSite } from "@/context/SiteContext";
import type { CrawlRunResponse, OrganizationResponse, SiteResponse } from "@/lib/api";
import type { DataSource, DemoReason } from "@/lib/dataSource";

export interface LiveContext {
  org: OrganizationResponse;
  site: SiteResponse;
  crawl: CrawlRunResponse | null;
  period: number;
}

export interface SiteDataResult<T> {
  data: T;
  source: DataSource;
  reason?: DemoReason;
  loading: boolean;
  error?: string;
  refetch: () => void;
}

interface Options {
  /** "crawl": tamamlanmış tarama şart (varsayılan). "site": site yeterli. "none": bu görünüm için arka uç ucu yok. */
  requires?: "crawl" | "site" | "none";
}

/**
 * Bir ekranın verisini tek noktadan çözer: canlı veri mümkünse çeker,
 * değilse örnek veriyi döner ve nedenini söyler. Ekranlar veri kaynağını
 * hiçbir zaman gizlemez; DemoBanner bu sonucu gösterir.
 */
export function useSiteData<T>(key: string, fetcher: (ctx: LiveContext) => Promise<T>, demo: T, opts: Options = {}): SiteDataResult<T> {
  const requires = opts.requires ?? "crawl";
  const { status, source, reason, org, site, crawl, period } = useSite();

  const canFetch =
    requires !== "none" &&
    status === "ready" &&
    !!org &&
    !!site &&
    (requires === "site" || (source === "live" && !!crawl));

  const query = useQuery({
    queryKey: [key, org?.id, site?.id, crawl?.id, period],
    queryFn: () => fetcher({ org: org!, site: site!, crawl, period }),
    enabled: canFetch,
    staleTime: 60_000,
    retry: 1,
  });

  const refetch = () => {
    query.refetch();
  };

  if (requires === "none") {
    return { data: demo, source: "demo", reason: "no-endpoint", loading: false, refetch };
  }

  if (status === "loading") {
    return { data: demo, source: "demo", reason, loading: true, refetch };
  }

  if (!canFetch) {
    const r: DemoReason = reason ?? (requires === "site" ? "no-site" : "no-crawl");
    return { data: demo, source: "demo", reason: r, loading: false, refetch };
  }

  if (query.isPending) {
    return { data: demo, source: "live", loading: true, refetch };
  }

  if (query.isError || query.data === undefined) {
    const message = query.error instanceof Error ? query.error.message : "Canlı veri alınamadı";
    return { data: demo, source: "demo", reason: "fetch-failed", loading: false, error: message, refetch };
  }

  return { data: query.data, source: "live", loading: false, refetch };
}
