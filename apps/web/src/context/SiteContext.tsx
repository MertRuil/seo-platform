"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, type CrawlRunResponse, type OrganizationResponse, type SiteResponse } from "@/lib/api";
import { decideSource, type DataSource, type DemoReason } from "@/lib/dataSource";
import { useAuth } from "@/context/AuthContext";
import { clearPendingSite, readPendingSite } from "@/lib/pendingSite";

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
  /** Listeyi yeniden yükler; `siteId` verilirse o site seçilir (ör. yeni eklenen site). */
  refresh: (opts?: { siteId?: string }) => Promise<void>;
  /** Siteyi ekler, ilk taramayı başlatır ve seçer. Çalışma alanı yoksa önce onu oluşturur. */
  addSite: (url: string, name?: string) => Promise<SiteResponse>;
  /** Girişsiz denetimden gelen adresin arka planda içe aktarılma durumu. */
  siteImport: { url: string; state: "running" | "error"; message?: string } | null;
  dismissSiteImport: () => void;
  /** "Yeni site ekle" diyaloğu: menü, boş durumlar ve örnek veri bandı aynı diyaloğu açar. */
  addSiteOpen: boolean;
  setAddSiteOpen: (open: boolean) => void;
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
  const [siteImport, setSiteImport] = useState<SiteState["siteImport"]>(null);
  const [addSiteOpen, setAddSiteOpen] = useState(false);
  const importStarted = useRef(false);

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

  const refresh = useCallback(async (opts?: { siteId?: string }) => {
    if (!user) {
      setOrg(null);
      setSite(null);
      setSites([]);
      setCrawls([]);
      setInputs({ backendReachable: false, authorized: false, hasOrg: false, hasSite: false, hasCrawl: false });
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
        const chosen = list.find((s) => s.id === opts?.siteId) ?? list.find((s) => s.id === saved) ?? list[0] ?? null;
        setSite(chosen);
        if (chosen) {
          try {
            localStorage.setItem(STORAGE_KEY_SITE, chosen.id);
          } catch {
            /* yok say */
          }
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

  // Arka uçta kayıt organizasyon açmıyor; ilk site eklenirken kişisel çalışma alanı oluşturulur.
  const ensureOrg = useCallback(async (): Promise<OrganizationResponse> => {
    if (org) return org;
    const existing = await api.getOrganizations().catch(() => [] as OrganizationResponse[]);
    if (existing[0]) return existing[0];
    const first = (user?.fullName || user?.email || "").split(/[\s@]/)[0] || "Benim";
    return api.createOrganization({ name: `${first} çalışma alanı`, slug: `calisma-alani-${Date.now().toString(36)}` });
  }, [org, user]);

  const addSite = useCallback(
    async (rawUrl: string, name?: string) => {
      let url = rawUrl.trim();
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      const host = new URL(url).hostname;
      const o = await ensureOrg();
      const created = await api.createSite(o.id, { name: name?.trim() || host.replace(/^www\./i, ""), primary_url: url });
      try {
        await api.triggerCrawl(o.id, created.id);
      } catch (error) {
        await refresh({ siteId: created.id });
        throw new Error(`Siteniz kaydedildi, ancak tarama başlatılamadı: ${error instanceof Error ? error.message : "sunucu hatası"}. Taramalar sayfasından tekrar başlatabilirsiniz.`);
      }
      await refresh({ siteId: created.id });
      return created;
    },
    [ensureOrg, refresh]
  );

  // Girişsiz denetimde analiz edilen adres kayıttan sonra ilk proje olarak eklenir (bir kez).
  useEffect(() => {
    if (!user || status !== "ready" || importStarted.current) return;
    const pending = readPendingSite();
    if (!pending) return;
    importStarted.current = true;
    clearPendingSite();
    let host = "";
    try {
      host = new URL(pending).hostname.replace(/^www\./i, "");
    } catch {
      return;
    }
    const existing = sites.find((x) => (x.normalized_domain || x.domain).replace(/^www\./i, "") === host);
    if (existing) {
      refresh({ siteId: existing.id });
      return;
    }
    setSiteImport({ url: pending, state: "running" });
    addSite(pending)
      .then(() => setSiteImport(null))
      .catch((e) => setSiteImport({ url: pending, state: "error", message: e instanceof Error ? e.message : String(e) }));
  }, [user, status, sites, refresh, addSite]);

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
        loadCrawls(org, s)
          .then((cl) => setInputs((i) => ({ ...i, hasSite: true, hasCrawl: cl.some(isCompleted) })))
          .catch(() => {
            setInputs((i) => ({ ...i, hasSite: true, hasCrawl: false, backendReachable: false }));
          });
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
    addSite,
    siteImport,
    dismissSiteImport: () => setSiteImport(null),
    addSiteOpen,
    setAddSiteOpen,
  };

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteState {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite, SiteProvider içinde kullanılmalı");
  return ctx;
}
