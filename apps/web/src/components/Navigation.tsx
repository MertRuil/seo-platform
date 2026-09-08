"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  BarChart3, 
  Globe, 
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
  ShieldCheck, 
  History,
  LogOut,
  User as UserIcon
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: "Genel Bakış", href: "/", icon: BarChart3 },
  { name: "Site Sağlığı", href: "/health", icon: ShieldCheck },
  { name: "SEO Sorunları", href: "/issues", icon: AlertTriangle },
  { name: "Taranan Sayfalar", href: "/pages", icon: FileText },
  { name: "Arama Performansı", href: "/performance", icon: TrendingUp },
  { name: "Büyüme Fırsatları", href: "/opportunities", icon: Lightbulb },
  { name: "İç Link Analizi", href: "/links", icon: Link2 },
  { name: "Yapılandırılmış Veri", href: "/schema", icon: Code2 },
  { name: "Web Hayati Değerleri", href: "/cwv", icon: Zap },
  { name: "Site Taramaları", href: "/crawls", icon: Layers },
  { name: "Değişiklik & Diff", href: "/changes", icon: GitCommit },
  { name: "SEO Deneyleri", href: "/experiments", icon: FlaskConical },
  { name: "SEO Bilgi Beyni (RAG)", href: "/knowledge", icon: BookOpen },
  { name: "Bağlayıcılar & Ayarlar", href: "/integrations", icon: Sliders },
  { name: "Denetim Günlüğü", href: "/audit", icon: History },
];

export function Navigation({ currentPath = "/" }: { currentPath?: string }) {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 select-none z-50">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30 text-lg">
          Ω
        </div>
        <div>
          <h1 className="font-bold text-slate-100 text-sm tracking-wide">SEO İŞLETİM SİSTEMİ</h1>
          <p className="text-xs text-slate-400">Otonom AI Platformu</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.href;
          return (
            <a
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </a>
          );
        })}
      </nav>

      {/* Alt Profil & Çıkış Kartı */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-3">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-medium">Sistem Durumu</span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Canlı & Güvenli
          </span>
        </div>

        {/* Kullanıcı Kartı */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
              {user?.fullName?.charAt(0) || "M"}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">
                {user?.fullName || "Mert Ruil"}
              </div>
              <div className="text-[10px] text-indigo-400 font-medium truncate">
                {user?.role || "Yönetici"}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Oturumu Kapat"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all ml-1 shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
