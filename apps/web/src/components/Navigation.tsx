"use client";

import React from "react";
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
  History 
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

      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="text-xs text-slate-400 flex items-center justify-between">
          <span className="font-medium">Motor Durumu</span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Aktif (Sıfır Hata)
          </span>
        </div>
      </div>
    </aside>
  );
}
