"use client";

import React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDensity } from "@/context/DensityContext";
import { Navigation } from "@/components/Navigation";
import { Loader2, SlidersHorizontal, CheckCircle2, ChevronDown } from "lucide-react";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { density, toggleDensity } = useDensity();
  const isLoginPage = pathname === "/login";

  // Giriş sayfasında navigasyonu ve üst çubuğu göstermeden tam ekran sun
  if (isLoginPage) {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  // Oturum durumu yüklenirken CALPEO Signal Loop bekleme ekranı
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#171817] flex flex-col items-center justify-center gap-4">
        <div className="relative w-14 h-14 flex items-center justify-center animate-pulse">
          <Image 
            src="/brand/calpeo-logo-signal-loop-v1.png" 
            alt="CALPEO Logo" 
            width={56} 
            height={56} 
            className="object-contain"
            priority
          />
        </div>
        <div className="flex items-center gap-2 text-[#8c8d89] text-xs font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-[#3157e5]" />
          <span>Güvenli Oturum Doğrulanıyor...</span>
        </div>
      </div>
    );
  }

  // Oturum yoksa bekle (AuthContext login'e yönlendirir)
  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full bg-[#171817] text-[#f4f3ee]">
      <Navigation currentPath={pathname} />

      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Üst Yönetici Çubuğu (Top Bar) */}
        <header className="h-14 border-b border-[#343633] bg-[#1a1b1a] px-8 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-4">
            {/* Proje / Alan Adı Seçici */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#202120] border border-[#343633] text-xs text-[#ddd] cursor-pointer hover:border-[#474a45] transition-colors">
              <span className="w-2 h-2 rounded-full bg-[#148b79]"></span>
              <span className="font-semibold text-white">calpeo.io</span>
              <span className="text-[#6f6d66]">/</span>
              <span className="text-[#aaa]">Acme Türkiye</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#77736c] ml-1" />
            </div>

            {/* Doğrulama Durumu */}
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[#8c8d89]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#148b79]" />
              <span>Sıfır Halüsinasyon & Kanıt Doğrulaması</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Yoğunluk Değiştirici (Özet Modu vs Uzman Modu) */}
            <button
              onClick={toggleDensity}
              title="Bilgi yoğunluğunu değiştir (Yönetici Özeti vs Ayrıntılı Uzman Görünümü)"
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#202120] hover:bg-[#292a28] border border-[#343633] text-xs font-medium transition-all"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#3157e5]" />
              <span className="text-[#999994]">Görünüm:</span>
              <span className={`font-semibold ${density === "summary" ? "text-white" : "text-[#2dd4bf]"}`}>
                {density === "summary" ? "Özet Modu (Yönetici)" : "Uzman Modu (Ajans/SEO)"}
              </span>
            </button>
          </div>
        </header>

        {/* Ana İçerik */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
