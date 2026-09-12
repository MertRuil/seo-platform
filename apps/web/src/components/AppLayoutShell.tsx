"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDensity } from "@/context/DensityContext";
import { useTheme } from "@/context/ThemeContext";
import { useSite, type Period } from "@/context/SiteContext";
import { Navigation } from "@/components/Navigation";
import { Segmented, Input, Label } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/States";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatRelative } from "@/lib/format";
import { Loader2, Sun, Moon, Menu, ChevronDown, Check, Plus, FlaskConical, Globe } from "lucide-react";

const STORAGE_KEY_NAV = "calpeo_nav";

function SiteSwitcher() {
  const { site, sites, selectSite, source, status, org, refresh } = useSite();
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newName, setNewName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const handleCloseAdd = React.useCallback(() => {
    setAddOpen(false);
    setAddErr(null);
  }, []);

  const handleSaveAndCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    let url = newUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    setAddBusy(true);
    setAddErr(null);
    try {
      let targetOrgId = org?.id;
      if (!targetOrgId) {
        const orgs = await api.getOrganizations();
        targetOrgId = orgs[0]?.id;
      }
      if (!targetOrgId) throw new Error("Organizasyon bulunamadı.");
      const domain = new URL(url).hostname;
      const created = await api.createSite(targetOrgId, {
        name: newName.trim() || domain,
        primary_url: url,
      });
      await api.triggerCrawl(targetOrgId, created.id);
      await refresh();
      selectSite(created.id);
      setAddOpen(false);
      setNewUrl("");
      setNewName("");
    } catch (err: any) {
      setAddErr(err.message || "Site eklenirken hata oluştu.");
    } finally {
      setAddBusy(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = site ? site.normalized_domain || site.domain : status === "loading" ? "Yükleniyor…" : "Örnek site";
  const sub = site ? site.name : source === "demo" ? "flagship-store.com" : "";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 h-8 px-2.5 rounded-sm bg-surface-2 border border-line text-sm hover:border-line-strong transition-colors cursor-pointer max-w-[60vw]"
      >
        <span className={cn("w-2 h-2 rounded-full shrink-0", site ? "bg-evidence" : "bg-warn")} aria-hidden />
        <span className="font-semibold text-ink truncate">{label}</span>
        {sub && <span className="text-muted truncate hidden sm:inline">/ {sub}</span>}
        <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 mt-1 w-72 bg-surface border border-line rounded-md shadow-pop p-1 z-50 animate-fade-in">
          {sites.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted flex items-center gap-2">
              <FlaskConical className="w-3.5 h-3.5" aria-hidden />
              Kayıtlı site yok; örnek veri gösteriliyor.
            </div>
          ) : (
            sites.map((s) => (
              <button
                key={s.id}
                role="menuitemradio"
                aria-checked={s.id === site?.id}
                type="button"
                onClick={() => {
                  selectSite(s.id);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-sm text-sm text-ink hover:bg-surface-2 cursor-pointer"
              >
                <span className="min-w-0">
                  <span className="block font-medium truncate">{s.normalized_domain || s.domain}</span>
                  <span className="block text-2xs text-muted truncate">{s.name}</span>
                </span>
                {s.id === site?.id && <Check className="w-4 h-4 text-accent shrink-0" aria-hidden />}
              </button>
            ))
          )}
          <div className="border-t border-line mt-1 pt-1 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setAddOpen(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-sm text-sm text-accent-ink hover:bg-surface-2 font-medium cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden />
              + Yeni Site Ekle ve Canlı Tara
            </button>
            <Link
              href="/crawls"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs text-muted hover:text-ink hover:bg-surface-2"
            >
              Tüm taramaları ve geçmişi gör →
            </Link>
          </div>
        </div>
      )}

      <Modal open={addOpen} onClose={handleCloseAdd} title="Yeni Site Ekle ve Canlı Analiz Başlat" icon={<Globe className="w-4 h-4 text-accent" />}>
        {addErr && <Notice tone="error" className="mb-3">{addErr}</Notice>}
        <form onSubmit={handleSaveAndCrawl} className="space-y-4">
          <p className="text-xs text-muted">
            Eklemek istediğiniz web sitesinin adresini girin. Sistem saniyeler içinde sayfaları, başlıkları, canonical ve robots etiketlerini canlı tarayıp teknik SEO raporunu oluşturacaktır.
          </p>
          <div>
            <Label htmlFor="switcher-site-url">Web Sitesi Adresi (URL)</Label>
            <Input
              id="switcher-site-url"
              placeholder="https://orneksiteniz.com"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="switcher-site-name">Proje / Marka Adı (İsteğe bağlı)</Label>
            <Input
              id="switcher-site-name"
              placeholder="Örn. Ana Mağaza"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleCloseAdd}>
              Vazgeç
            </Button>
            <Button type="submit" variant="primary" loading={addBusy} icon={<Plus className="w-4 h-4" />}>
              Siteyi Kaydet & Canlı Tara
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { density, setDensity } = useDensity();
  const { theme, setTheme } = useTheme();
  const { crawl, period, setPeriod, source } = useSite();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY_NAV) === "collapsed");
    } catch {
      /* yok say */
    }
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY_NAV, next ? "collapsed" : "expanded");
      } catch {
        /* yok say */
      }
      return next;
    });
  };

  if (isLoginPage) {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-3 bg-bg">
        <Image src="/brand/calpeo-logo-signal-loop-v1.png" alt="CALPEO" width={48} height={48} className="object-contain" priority />
        <div className="flex items-center gap-2 text-muted text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-accent" aria-hidden />
          <span>Yükleniyor…</span>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const railWidth = collapsed ? "lg:w-rail-sm" : "lg:w-rail";
  const contentPad = collapsed ? "lg:pl-rail-sm" : "lg:pl-rail";

  return (
    <div className="min-h-screen w-full bg-bg text-ink">
      {/* Masaüstü rail */}
      <aside className={cn("hidden lg:block fixed inset-y-0 left-0 z-40 border-r border-line transition-[width] duration-150", railWidth)}>
        <Navigation currentPath={pathname} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      {/* Mobil çekmece */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button type="button" aria-label="Menüyü kapat" onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-black/50 cursor-default" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line shadow-pop animate-slide-in">
            <Navigation currentPath={pathname} onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className={cn("flex flex-col min-h-screen transition-[padding] duration-150", contentPad)}>
        {/* Üst çubuk */}
        <header className="h-14 sticky top-0 z-30 bg-surface border-b border-line px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Menüyü aç" className="lg:hidden w-9 h-9 inline-flex items-center justify-center rounded-sm text-muted hover:text-ink hover:bg-surface-2 cursor-pointer">
              <Menu className="w-5 h-5" aria-hidden />
            </button>
            <SiteSwitcher />
            <div className="hidden md:block">
              <Segmented<Period>
                label="Dönem"
                value={period}
                onChange={setPeriod}
                options={[
                  { value: 7, label: "7 g" },
                  { value: 28, label: "28 g" },
                  { value: 90, label: "90 g" },
                ]}
              />
            </div>
            <span className="hidden xl:inline text-xs text-muted truncate">
              {source === "live" && crawl ? `Son tarama ${formatRelative(crawl.finished_at ?? crawl.created_at)}` : source === "demo" ? "Örnek veri" : ""}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Segmented<"light" | "dark">
              label="Tema"
              value={theme}
              onChange={setTheme}
              options={[
                { value: "light", label: <Sun className="w-3.5 h-3.5" aria-hidden />, title: "Açık mod" },
                { value: "dark", label: <Moon className="w-3.5 h-3.5" aria-hidden />, title: "Koyu mod" },
              ]}
            />
            <div className="hidden sm:block">
              <Segmented<"summary" | "expert">
                label="Bilgi yoğunluğu"
                value={density}
                onChange={setDensity}
                options={[
                  { value: "summary", label: "Özet", title: "Yönetici özeti" },
                  { value: "expert", label: "Uzman", title: "Ajans / SEO ayrıntı görünümü" },
                ]}
              />
            </div>
          </div>
        </header>

        <main id="icerik" className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
