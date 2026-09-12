"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError, type CrawlRunResponse, type OrganizationResponse, type SiteResponse } from "@/lib/api";
import { decideSource, type DataSource, type DemoReason } from "@/lib/dataSource";
import { useAuth } from "@/context/AuthContext";

export type Period = 7 | 28 | 90;

interface SiteState {
  status: "loading" | "ready";
  source: DataSource;
  reason?: DemoReason;
  org: OrganizationResponse | null;
  site: SiteResponse | null;
  sites: SiteResponse[];
  crawl: CrawlRunResponse | null; // en son tamamlanmış tarama
  crawls: CrawlRunResponse[];
  period: Period;
  setPeriod: (p: Period) => void;
  selectSite: (siteId: string) => void;
  refresh: () => Promise<void>;
}

const SiteContext = createContext<SiteState | undefined>(undefined);

const STORAGE_KEY_SITE = "calpeo_site";
const STORAGE_KEY_PERIOD = "calpeo_period";

function isCompleted(c: CrawlRunResponse): boolean {
  return c.status === "COMPLETED" || c.status === "COMPLETED_WITH_ERRORS";
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [inputs, setInputs] = useState({ backendReachable: false, authorized: false, hasOrg: false, hasSite: false, hasCrawl: false });
  const [org, setOrg] = useState<OrganizationResponse | null>(null);
  const [sites, setSites] = useState<SiteResponse[]>([]);
  const [site, setSite] = useState<SiteResponse | null>(null);
  const [crawls, setCrawls] = useState<CrawlRunResponse[]>([]);
  const [period, setPeriodState] = useState<Period>(28);

  useEffect(() => {
    try {
      const p = Number(localStorage.getItem(STORAGE_KEY_PERIOD));
      if (p === 7 || p === 28 || p === 90) setPeriodState(p);
    } catch {
      /* yok say */
    }
  }, []);

  const loadCrawls = useCallback(async (o: OrganizationResponse, s: SiteResponse) => {
    const list = await api.listCrawls(o.id, s.id);
    setCrawls(list);
    return list;
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus("ready");
      return;
    }
    setStatus("loading");
    const next = { backendReachable: false, authorized: false, hasOrg: false, hasSite: false, hasCrawl: false };
    try {
      const orgs = await api.getOrganizations();
      next.backendReachable = true;
      next.authorized = true;
      const o = orgs[0] ?? null;
      setOrg(o);
      if (o) {
        next.hasOrg = true;
        const list = await api.getSites(o.id);
        setSites(list);
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(STORAGE_KEY_SITE);
        } catch {
          /* yok say */
        }
        const chosen = list.find((s) => s.id === saved) ?? list[0] ?? null;
        setSite(chosen);
        if (chosen) {
          next.hasSite = true;
          const cl = await loadCrawls(o, chosen);
          next.hasCrawl = cl.some(isCompleted);
        } else {
          setCrawls([]);
        }
      } else {
        setSites([]);
        setSite(null);
        setCrawls([]);
      }
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      next.backendReachable = status !== 0;
      next.authorized = status !== 401 && status !== 403 && status !== 0;
      setOrg(null);
      setSites([]);
      setSite(null);
      setCrawls([]);
    }
    setInputs(next);
    setStatus("ready");
  }, [user, loadCrawls]);

  useEffect(() => {
    refresh();
    // token değişince (yeni giriş) yeniden yükle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, token]);

  const selectSite = useCallback(
    (siteId: string) => {
      const s = sites.find((x) => x.id === siteId) ?? null;
      setSite(s);
      try {
        localStorage.setItem(STORAGE_KEY_SITE, siteId);
      } catch {
        /* yok say */
      }
      if (org && s) {
        loadCrawls(org, s).then((cl) => setInputs((i) => ({ ...i, hasSite: true, hasCrawl: cl.some(isCompleted) })));
      }
    },
    [sites, org, loadCrawls]
  );

  const setPeriod = useCallback((p: Period) => {
    setPeriodState(p);
    try {
      localStorage.setItem(STORAGE_KEY_PERIOD, String(p));
    } catch {
      /* yok say */
    }
  }, []);

  const decision = useMemo(() => decideSource(inputs), [inputs]);
  const crawl = useMemo(() => {
    const done = crawls.filter(isCompleted);
    if (done.length === 0) return null;
    return [...done].sort((a, b) => (b.finished_at ?? b.created_at).localeCompare(a.finished_at ?? a.created_at))[0];
  }, [crawls]);

  const value: SiteState = {
    status,
    source: decision.source,
    reason: decision.reason,
    org,
    site,
    sites,
    crawl,
    crawls,
    period,
    setPeriod,
    selectSite,
    refresh,
  };

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteState {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite, SiteProvider içinde kullanılmalı");
  return ctx;
}
