"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useQueue } from "@/hooks/useQueue";
import { cn } from "@/lib/cn";
import {
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  FileText,
  TrendingUp,
  Lightbulb,
  Link2,
  Code2,
  Zap,
  Layers,
  GitCommit,
  FlaskConical,
  BookOpen,
  Sliders,
  History,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: "pending" | "critical";
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Genel",
    items: [
      { name: "Genel Görünüm", href: "/", icon: BarChart3 },
      { name: "Öncelikli İşler", href: "/opportunities", icon: Lightbulb, badge: "pending" },
    ],
  },
  {
    label: "Görünürlük",
    items: [{ name: "Arama Performansı", href: "/performance", icon: TrendingUp }],
  },
  {
    label: "Site & Teknik Sağlık",
    items: [
      { name: "Teknik Sağlık", href: "/health", icon: ShieldCheck },
      { name: "Sorunlar", href: "/issues", icon: AlertTriangle, badge: "critical" },
      { name: "Taranan Sayfalar", href: "/pages", icon: FileText },
      { name: "Yapılandırılmış Veri", href: "/schema", icon: Code2 },
      { name: "İç Link Grafı", href: "/links", icon: Link2 },
      { name: "Web Vitals", href: "/cwv", icon: Zap },
    ],
  },
  {
    label: "Çalışma & Doğrulama",
    items: [
      { name: "Değişiklikler & Diff", href: "/changes", icon: GitCommit },
      { name: "SEO Deneyleri", href: "/experiments", icon: FlaskConical },
      { name: "Site Taramaları", href: "/crawls", icon: Layers },
    ],
  },
  {
    label: "Yönetim",
    items: [
      { name: "Bağlayıcılar & Ayarlar", href: "/integrations", icon: Sliders },
      { name: "Bilgi Tabanı (RAG)", href: "/knowledge", icon: BookOpen },
      { name: "Denetim Günlüğü", href: "/audit", icon: History },
    ],
  },
];

interface NavigationProps {
  currentPath?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}

export function Navigation({ currentPath = "/", collapsed = false, onToggleCollapse, onNavigate }: NavigationProps) {
  const { user, logout } = useAuth();
  const queue = useQueue();
  const badges: Record<"pending" | "critical", number> = { pending: queue.pending, critical: queue.critical };

  return (
    <div className="flex flex-col h-full bg-surface text-ink">
      {/* Marka */}
      <div className={cn("h-14 border-b border-line flex items-center", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        <Link href="/" className="flex items-center gap-2.5 min-w-0" onClick={onNavigate}>
          <Image src="/brand/calpeo-logo-signal-loop-v1.png" alt="CALPEO" width={28} height={28} className="object-contain rounded-sm shrink-0" priority />
          {!collapsed && (
            <span className="min-w-0">
              <span className="block font-bold text-sm tracking-wider text-ink leading-4">CALPEO</span>
              <span className="block text-2xs text-muted leading-4">Kanıt & karar sistemi</span>
            </span>
          )}
        </Link>
        {!collapsed && onToggleCollapse && (
          <button type="button" onClick={onToggleCollapse} aria-label="Menüyü daralt" title="Menüyü daralt" className="hidden lg:inline-flex w-8 h-8 items-center justify-center rounded-sm text-muted hover:text-ink hover:bg-surface-2 cursor-pointer">
            <PanelLeftClose className="w-4 h-4" aria-hidden />
          </button>
        )}
      </div>

      {/* Menü */}
      <nav aria-label="Ana menü" className={cn("flex-1 overflow-y-auto custom-scrollbar py-3", collapsed ? "px-2 space-y-3" : "px-3 space-y-4")}>
        {collapsed && onToggleCollapse && (
          <button type="button" onClick={onToggleCollapse} aria-label="Menüyü genişlet" title="Menüyü genişlet" className="w-full h-9 inline-flex items-center justify-center rounded-sm text-muted hover:text-ink hover:bg-surface-2 cursor-pointer">
            <PanelLeftOpen className="w-4 h-4" aria-hidden />
          </button>
        )}
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && <div className="font-mono text-2xs font-semibold uppercase tracking-wider text-muted px-2.5 mb-1">{group.label}</div>}
            {collapsed && <div className="border-t border-line mx-1 mb-2" aria-hidden />}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.href;
                const count = item.badge ? badges[item.badge] : 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      title={collapsed ? item.name : undefined}
                      className={cn(
                        "flex items-center rounded-sm text-sm font-medium transition-colors min-h-[36px]",
                        collapsed ? "justify-center px-0" : "justify-between px-2.5 gap-2",
                        isActive ? "bg-accent-soft text-accent-ink font-semibold shadow-[inset_2px_0_0_var(--accent)]" : "text-muted hover:text-ink hover:bg-surface-2"
                      )}
                    >
                      <span className={cn("flex items-center min-w-0", collapsed ? "gap-0" : "gap-2.5")}>
                        <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-accent" : "text-faint")} />
                        {!collapsed && <span className="truncate">{item.name}</span>}
                      </span>
                      {!collapsed && count > 0 && (
                        <span className={cn("font-mono text-2xs px-1.5 py-0.5 rounded-sm tabular-nums", item.badge === "critical" ? "bg-critical-soft text-critical" : "bg-surface-2 text-muted border border-line")}>
                          {count}
                        </span>
                      )}
                      {collapsed && count > 0 && <span className="sr-only">{count} kayıt</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Kullanıcı */}
      <div className={cn("border-t border-line", collapsed ? "p-2" : "p-3")}>
        <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "justify-between gap-2")}>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-accent-soft text-accent-ink flex items-center justify-center text-xs font-bold shrink-0" aria-hidden>
              {user?.fullName?.charAt(0)?.toUpperCase() || "K"}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink truncate">{user?.fullName || "Kullanıcı"}</div>
                <div className="text-2xs text-muted truncate">{user?.role || ""}</div>
              </div>
            )}
          </div>
          <button type="button" onClick={logout} aria-label="Oturumu kapat" title="Oturumu kapat" className="w-8 h-8 inline-flex items-center justify-center rounded-sm text-muted hover:text-critical hover:bg-critical-soft transition-colors cursor-pointer shrink-0">
            <LogOut className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
