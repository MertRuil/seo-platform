"use client";

import React from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDensity } from "@/context/DensityContext";
import { useTheme } from "@/context/ThemeContext";
import { Navigation } from "@/components/Navigation";
import { 
  Loader2, 
  SlidersHorizontal, 
  CheckCircle2, 
  ChevronDown,
  Sun,
  Moon
} from "lucide-react";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { density, toggleDensity } = useDensity();
  const { theme, setTheme } = useTheme();
  const isLoginPage = pathname === "/login";

  // Giriş sayfasında navigasyonu ve üst çubuğu göstermeden tam ekran sun
  if (isLoginPage) {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  // Oturum durumu yüklenirken CALPEO Signal Loop bekleme ekranı
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[#f5f6f8] dark:bg-[#171817] flex flex-col items-center justify-center gap-4 transition-colors">
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
        <div className="flex items-center gap-2 text-[#656971] dark:text-[#8c8d89] text-xs font-medium">
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
    <div className="flex min-h-screen w-full bg-[#f5f6f8] dark:bg-[#171817] text-[#121316] dark:text-[#f4f3ee] transition-colors duration-150">
      <Navigation currentPath={pathname} />

      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Üst Yönetici Çubuğu (Top Bar) */}
        <header className="h-14 border-b border-[#e2e4e8] dark:border-[#343633] bg-white dark:bg-[#1a1b1a] px-8 flex items-center justify-between sticky top-0 z-40 transition-colors duration-150">
          <div className="flex items-center gap-4">
            {/* Proje / Alan Adı Seçici */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#f5f6f8] dark:bg-[#202120] border border-[#d7dae0] dark:border-[#343633] text-xs text-[#4e5259] dark:text-[#ddd] cursor-pointer hover:border-[#3157e5] transition-colors">
              <span className="w-2 h-2 rounded-full bg-[#0f927c] dark:bg-[#148b79]"></span>
              <span className="font-semibold text-[#121316] dark:text-white">calpeo.io</span>
              <span className="text-[#9a9da4] dark:text-[#6f6d66]">/</span>
              <span className="text-[#656971] dark:text-[#aaa]">Acme Türkiye</span>
              <ChevronDown className="w-3.5 h-3.5 text-[#858991] dark:text-[#77736c] ml-1" />
            </div>

            {/* Doğrulama Durumu */}
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-[#656971] dark:text-[#8c8d89]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0f927c] dark:text-[#148b79]" />
              <span>Sıfır Halüsinasyon & Kanıt Doğrulaması</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tema Değiştirici: Açık Mod vs Koyu Mod */}
            <div className="flex items-center p-0.5 rounded-md bg-[#eef0f3] dark:bg-[#202120] border border-[#d9dce1] dark:border-[#343633] text-xs">
              <button
                type="button"
                onClick={() => setTheme("light")}
                title="Açık Mod (Modern Editoryal)"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
                  theme === "light"
                    ? "bg-white text-[#121316] font-semibold shadow-xs"
                    : "text-[#656971] dark:text-[#8c8d89] hover:text-[#121316] dark:hover:text-white"
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Açık</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                title="Koyu Mod (Gece Operasyonu)"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
                  theme === "dark"
                    ? "bg-[#292a28] text-white font-semibold shadow-xs"
                    : "text-[#656971] dark:text-[#8c8d89] hover:text-[#121316] dark:hover:text-white"
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-[#3157e5]" />
                <span>Koyu</span>
              </button>
            </div>

            {/* Yoğunluk Değiştirici (Özet Modu vs Uzman Modu) */}
            <button
              onClick={toggleDensity}
              title="Bilgi yoğunluğunu değiştir (Yönetici Özeti vs Ayrıntılı Uzman Görünümü)"
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white dark:bg-[#202120] hover:bg-[#f5f6f8] dark:hover:bg-[#292a28] border border-[#d9dce1] dark:border-[#343633] text-xs font-medium text-[#121316] dark:text-[#f4f3ee] transition-all shadow-xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#3157e5]" />
              <span className="text-[#656971] dark:text-[#999994]">Görünüm:</span>
              <span className={`font-semibold ${
                density === "summary" 
                  ? "text-[#121316] dark:text-white" 
                  : "text-[#0f927c] dark:text-[#2dd4bf]"
              }`}>
                {density === "summary" ? "Özet (Yönetici)" : "Uzman (Ajans/SEO)"}
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
