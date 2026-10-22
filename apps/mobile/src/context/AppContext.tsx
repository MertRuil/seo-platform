import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { BackHandler, Platform } from "react-native";
import { SiteSummary, CrawlRunItem } from "../types";
import { fetchSites, createMobileSite, MOCK_SITES, triggerCrawl, fetchDiscoveredPages, runQuickAudit, fetchCrawlStatus } from "../services/api";
import { useAuth } from "./AuthContext";

export type TabKey = 
  | "dashboard" 
  | "quick_audit" 
  | "ai" 
  | "geo" 
  | "hub" 
  | "keywords" 
  | "competitors" 
  | "tasks" 
  | "reports" 
  | "settings" 
  | "content_optimizer" 
  | "recommendations" 
  | "knowledge" 
  | "billing"
  | "backlinks"
  | "leads"
  | "self_healing"
  | "compliance";

interface AppContextType {
  sites: SiteSummary[];
  selectedSite: SiteSummary | null;
  setSelectedSite: (site: SiteSummary) => void;
  addNewSite: (name: string, domain: string, primaryUrl: string) => Promise<SiteSummary>;
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  goBack: () => boolean;
  isLoading: boolean;
  refreshSites: () => Promise<void>;
  isDemoMode: boolean;
  setIsDemoMode: (val: boolean) => void;
  activeCrawl: CrawlRunItem | null;
  startCrawl: (maxPages?: number, targetSite?: SiteSummary, customUrls?: string[]) => Promise<void>;
  dismissCrawl: () => void;
}

const MAX_HISTORY = 20;

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const isGuest = user?.id === "guest-user";

  const [sites, setSites] = useState<SiteSummary[]>(isGuest ? MOCK_SITES : []);
  const [selectedSite, setSelectedSite] = useState<SiteSummary | null>(isGuest ? MOCK_SITES[0] : null);
  const [activeTab, setActiveTabState] = useState<TabKey>("dashboard");
  // Gezinme kütüphanesi yok; Android geri tuşu ve ekranlardaki geri okları bu yığından bir önceki ekranı alır.
  const historyRef = useRef<TabKey[]>([]);
  const activeTabRef = useRef<TabKey>("dashboard");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(isGuest);
  const [activeCrawl, setActiveCrawl] = useState<CrawlRunItem | null>(null);
  const crawlIntervalRef = useRef<any>(null);

  const setActiveTab = useCallback((tab: TabKey) => {
    if (activeTabRef.current === tab) return;
    historyRef.current = [...historyRef.current, activeTabRef.current].slice(-MAX_HISTORY);
    activeTabRef.current = tab;
    setActiveTabState(tab);
  }, []);

  const goBack = useCallback((): boolean => {
    const previous = historyRef.current.pop();
    if (!previous) return false;
    activeTabRef.current = previous;
    setActiveTabState(previous);
    return true;
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", goBack);
    return () => subscription.remove();
  }, [goBack]);

  // Sync sites with user state
  useEffect(() => {
    historyRef.current = [];
    activeTabRef.current = "dashboard";
    setActiveTabState("dashboard");
    if (user?.id === "guest-user") {
      setSites(MOCK_SITES);
      setSelectedSite(MOCK_SITES[0]);
      setIsDemoMode(true);
    } else if (user) {
      // For real new users, initialize empty until they add their own site
      setSites([]);
      setSelectedSite(null);
      setIsDemoMode(false);
      if (crawlIntervalRef.current) clearInterval(crawlIntervalRef.current);
      setActiveCrawl(null);
    } else {
      setSites([]);
      setSelectedSite(null);
      setIsDemoMode(false);
      if (crawlIntervalRef.current) clearInterval(crawlIntervalRef.current);
      setActiveCrawl(null);
    }
  }, [user?.id]);

  const addNewSite = async (name: string, domain: string, primaryUrl: string): Promise<SiteSummary> => {
    const rawDomain = (domain || primaryUrl || "site.com").trim();
    const cleanDomain = rawDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const cleanUrl = primaryUrl?.trim().startsWith("http") ? primaryUrl.trim() : `https://${cleanDomain}`;

    const newSite = await createMobileSite(name.trim() || cleanDomain, cleanUrl);
    setSites(prev => [newSite, ...prev]);
    setSelectedSite(newSite);
    return newSite;
  };

  const refreshSites = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = user.id === "guest-user" ? MOCK_SITES : await fetchSites();
      setSites(data);
      setSelectedSite(previous => data.find(s => s.id === previous?.id) || data[0] || null);
    } finally { setIsLoading(false); }
  };

  useEffect(() => {
    if (user && user.id !== "guest-user") void refreshSites().catch(() => {});
  }, [user?.id]);

  const startCrawl = async (maxPages?: number, targetSite?: SiteSummary, customUrls?: string[]) => {
    const site = targetSite || selectedSite;
    if (!site) return;

    // Gerçek sayfa sayısı ve URL listesini belirle
    let targetPages = maxPages || site.total_pages || 0;
    let urls = customUrls;

    if (!urls || urls.length === 0 || !targetPages) {
      try {
        const disc = await fetchDiscoveredPages(site.primary_url);
        if (disc && disc.total_pages > 0) {
          if (!maxPages) {
            targetPages = disc.total_pages;
          }
          urls = disc.discovered_urls;
          setSelectedSite(prev => prev ? { ...prev, total_pages: disc.total_pages } : site);
        }
      } catch {
        // fallback
      }
    }

    if (!targetPages) targetPages = 14;
    if (!urls || urls.length === 0) {
      urls = [site.primary_url];
    }

    const initialRun = await triggerCrawl(site.id, targetPages, "FAST", urls);
    // Sunucu taramayı kabul etmediyse (çevrimdışı) sayfa sayacı simüle edilmez; yalnızca ana sayfa denetlenir.
    const homepageOnly = initialRun.id.startsWith("crawl-sim-");
    setActiveCrawl({
      ...initialRun,
      status: "RUNNING",
      max_pages: homepageOnly ? 1 : targetPages,
      pages_crawled: 0,
      current_url: homepageOnly ? site.primary_url : undefined,
      discovered_urls: urls,
      homepage_only: homepageOnly,
    });

    const finish = async (pagesCrawled: number) => {
      let score = site.health_score;
      let cwv = site.cwv;
      let failed = false;
      try {
        const audit = await runQuickAudit(site.primary_url, site.id);
        score = audit.health_score;
        if (audit.core_web_vitals) {
          cwv = {
            lcp: `${(audit.core_web_vitals.lcp_p75_ms / 1000).toFixed(2)}s`,
            cls: audit.core_web_vitals.cls_p75.toFixed(2),
            inp: `${audit.core_web_vitals.inp_p75_ms}ms`,
          };
        }
      } catch {
        // Puan hesaplanamadı: önceki değer korunur, uydurma puan yazılmaz
        failed = true;
      }
      setActiveCrawl(prev => prev ? { ...prev, status: failed ? "FAILED" : "COMPLETED", pages_crawled: pagesCrawled, current_url: undefined, completed_at: new Date().toISOString() } : null);
      if (failed) return;
      const updatedSite: SiteSummary = {
        ...site,
        last_crawled_at: new Date().toISOString(),
        total_pages: homepageOnly ? site.total_pages : pagesCrawled,
        health_score: score,
        has_completed_crawl: true,
        cwv,
      };
      setSelectedSite(updatedSite);
      setSites(curr => curr.map(s => s.id === updatedSite.id ? updatedSite : s));
    };

    if (homepageOnly) {
      await finish(1);
      return;
    }

    // Gerçek tarama: ilerleme sunucudan okunur
    if (crawlIntervalRef.current) clearInterval(crawlIntervalRef.current);
    crawlIntervalRef.current = setInterval(async () => {
      try {
        const st = await fetchCrawlStatus(site.id, initialRun.id);
        setActiveCrawl(prev => prev ? { ...prev, status: st.status === "COMPLETED" || st.status === "FAILED" ? prev.status : st.status, pages_crawled: st.pages_crawled } : null);
        if (st.status === "COMPLETED" || st.status === "FAILED") {
          clearInterval(crawlIntervalRef.current);
          if (st.status === "COMPLETED") await finish(st.pages_crawled);
          else setActiveCrawl(prev => prev ? { ...prev, status: "FAILED" } : null);
        }
      } catch {
        // Durum okunamadı: bir sonraki denemede tekrar sorulur
      }
    }, 3000);
  };

  const dismissCrawl = () => {
    if (crawlIntervalRef.current) clearInterval(crawlIntervalRef.current);
    setActiveCrawl(null);
  };

  useEffect(() => {
    return () => {
      if (crawlIntervalRef.current) clearInterval(crawlIntervalRef.current);
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        sites,
        selectedSite,
        setSelectedSite,
        addNewSite,
        activeTab,
        setActiveTab,
        goBack,
        isLoading,
        refreshSites,
        isDemoMode,
        setIsDemoMode,
        activeCrawl,
        startCrawl,
        dismissCrawl
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};
