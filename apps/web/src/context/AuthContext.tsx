"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = "seo_auth_user";
const STORAGE_KEY_TOKEN = "seo_auth_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // İlk yüklemede kayıtlı oturumu oku
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY_USER);
      const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
      if (savedUser && savedToken) {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      }
    } catch (e) {
      console.error("Oturum bilgisi yüklenemedi:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Korumalı Rota Yönlendirmesi (Auth Guard)
  useEffect(() => {
    if (loading) return;

    const isLoginPage = pathname === "/login";

    if (!user && !isLoginPage) {
      // Oturum yok ve login sayfasında değil -> Girişe yönlendir
      router.replace("/login");
    } else if (user && isLoginPage) {
      // Oturum var ve login sayfasına girmeye çalışıyor -> Ana sayfaya yönlendir
      router.replace("/");
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || "Giriş başarısız oldu." };
      }

      setUser(data.user);
      setToken(data.access_token);

      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(data.user));
      localStorage.setItem(STORAGE_KEY_TOKEN, data.access_token);

      router.replace("/");
      return { success: true };
    } catch (err: any) {
      return { success: false, error: "Sunucuyla iletişim kurulamadı: " + err.message };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    // Cookie'yi de temizle
    document.cookie = "seo_platform_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    router.replace("/login");
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth, AuthProvider içerisinde kullanılmalıdır.");
  }
  return context;
}
