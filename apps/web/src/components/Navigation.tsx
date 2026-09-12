"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
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
} from "lucide-react";

interface NavGroup {
  label: string;
  items: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Genel",
    items: [
      { name: "Genel Görünüm", href: "/", icon: BarChart3 },
      { name: "Öncelikli İşler", href: "/opportunities", icon: Lightbulb, badge: "4" },
    ],
  },
  {
    label: "Görünürlük (SEO & GEO)",
    items: [
      { name: "Arama Performansı", href: "/performance", icon: TrendingUp },
      { name: "Yanıt Motorları & Atıflar", href: "/knowledge", icon: BookOpen, badge: "AI" },
    ],
  },
  {
    label: "Site & Teknik Sağlık",
    items: [
      { name: "Teknik Sağlık", href: "/health", icon: ShieldCheck },
      { name: "Kritik Sorunlar", href: "/issues", icon: AlertTriangle, badge: "3" },
      { name: "Taranan Sayfalar", href: "/pages", icon: FileText },
      { name: "Yapılandırılmış Veri", href: "/schema", icon: Code2 },
      { name: "İç Link Grafı", href: "/links", icon: Link2 },
      { name: "Web Hayati Değerleri", href: "/cwv", icon: Zap },
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
      { name: "Denetim Günlüğü", href: "/audit", icon: History },
    ],
  },
];

export function Navigation({ currentPath = "/" }: { currentPath?: string }) {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-[#171817] border-r border-[#343633] flex flex-col h-screen fixed left-0 top-0 select-none z-50 text-[#f4f3ee]">
      {/* CALPEO Marka Başlığı */}
      <div className="p-4 border-b border-[#343633] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative w-7 h-7 flex items-center justify-center">
            <Image 
              src="/brand/calpeo-logo-signal-loop-v1.png" 
              alt="CALPEO Logo" 
              width={28} 
              height={28} 
              className="object-contain rounded-sm"
              priority
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-wider text-white">CALPEO</span>
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#3157e5]/20 text-[#3157e5] border border-[#3157e5]/30">
                PRO
              </span>
            </div>
            <p className="text-[10px] text-[#6f6d66] font-medium leading-none mt-0.5">
              Kanıt & Karar Sistemi
            </p>
          </div>
        </Link>
      </div>

      {/* Navigasyon Listesi */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {navGroups.map((group) => (
          <div key={group.label}>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[#656661] px-2.5 mb-1.5">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-all ${
                      isActive
                        ? "bg-[#292a28] text-white font-semibold border-l-2 border-[#3157e5] pl-2 shadow-sm"
                        : "text-[#999994] hover:text-[#f4f3ee] hover:bg-[#202120]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#3157e5]" : "text-[#77736c]"}`} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        isActive 
                          ? "bg-[#3157e5]/20 text-[#3157e5]" 
                          : "bg-[#202120] text-[#77736c] border border-[#343633]"
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Alt Profil ve Sistem Durumu */}
      <div className="p-3 border-t border-[#343633] bg-[#141514] space-y-2.5">
        <div className="flex items-center justify-between text-[10px] text-[#77736c] px-1">
          <span className="font-medium">Ölçüm Durumu</span>
          <span className="flex items-center gap-1.5 text-[#148b79] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#148b79] animate-pulse"></span>
            Canlı & Doğrulanmış
          </span>
        </div>

        {/* Kullanıcı Kartı */}
        <div className="flex items-center justify-between pt-2 border-t border-[#292a28] px-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#3157e5] to-[#148b79] flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0">
              {user?.fullName?.charAt(0) || "M"}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-[#f4f3ee] truncate">
                {user?.fullName || "Mert Ruil"}
              </div>
              <div className="text-[10px] text-[#6f6d66] truncate font-mono">
                {user?.role || "Yönetici"}
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Oturumu Kapat"
            className="p-1.5 rounded-md text-[#77736c] hover:text-rose-400 hover:bg-rose-500/10 transition-all shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
