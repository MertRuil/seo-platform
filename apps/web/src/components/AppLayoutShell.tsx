"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Navigation } from "@/components/Navigation";
import { Loader2 } from "lucide-react";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const isLoginPage = pathname === "/login";

  // Giriş sayfasında navigasyonu göstermeden tam ekran sun
  if (isLoginPage) {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  // Oturum durumu yüklenirken zarif bekleme ekranı
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center font-black text-white text-2xl shadow-xl shadow-indigo-500/30 animate-pulse">
          Ω
        </div>
        <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Güvenli Oturum Doğrulanıyor...</span>
        </div>
      </div>
    );
  }

  // Oturum yoksa sayfa içeriğini sızdırmadan bekle (AuthContext login'e yönlendirecek)
  if (!user) {
    return null;
  }

  // Giriş yapılmış: Sol navigasyon + Sayfa içeriği
  return (
    <div className="flex min-h-screen w-full bg-slate-950">
      <Navigation currentPath={pathname} />
      <main className="flex-1 ml-64 p-8 overflow-y-auto min-h-screen">
        {children}
      </main>
    </div>
  );
}
