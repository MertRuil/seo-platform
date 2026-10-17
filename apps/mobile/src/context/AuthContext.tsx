import React, { createContext, useContext, useState, useEffect } from "react";
import { UserProfile } from "../types";
import { Storage } from "../services/storage";
import { getApiBaseUrl, safeNetworkFetch } from "../services/api";
import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isBiometricEnrolled: boolean;
  enrolledBiometricType: "FACE_ID" | "TOUCH_ID" | null;
  hasAnsweredBiometricPrompt: boolean;
  enableBiometrics: (type: "FACE_ID" | "TOUCH_ID") => Promise<void>;
  disableBiometrics: () => Promise<void>;
  markBiometricPromptAnswered: () => Promise<void>;
  resetBiometricPrompt: () => Promise<void>;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  loginAsDemo: () => Promise<void>;
  loginWithSocial: (provider: "Apple" | "Google", email?: string, name?: string) => Promise<void>;
  loginWithBiometrics: (method?: "FACE_ID" | "TOUCH_ID") => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "seo_auth_token";
const USER_KEY = "seo_auth_user";
const BIOMETRIC_ENROLLED_KEY = "seo_biometric_enrolled";
const BIOMETRIC_TYPE_KEY = "seo_biometric_type";
const BIOMETRIC_PROMPT_KEY = "seo_biometric_prompt_answered";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState<boolean>(false);
  const [enrolledBiometricType, setEnrolledBiometricType] = useState<"FACE_ID" | "TOUCH_ID" | null>(null);
  const [hasAnsweredBiometricPrompt, setHasAnsweredBiometricPrompt] = useState<boolean>(false);

  useEffect(() => {
    loadStoredSession();
  }, []);

  const loadStoredSession = async () => {
    try {
      const savedToken = await Storage.getItem(TOKEN_KEY);
      const savedUserStr = await Storage.getItem(USER_KEY);
      const bioEnrolled = await Storage.getItem(BIOMETRIC_ENROLLED_KEY);
      const bioType = await Storage.getItem(BIOMETRIC_TYPE_KEY);
      const promptAnswered = await Storage.getItem(BIOMETRIC_PROMPT_KEY);

      setIsBiometricEnrolled(bioEnrolled === "true");
      setEnrolledBiometricType((bioType as "FACE_ID" | "TOUCH_ID") || null);
      setHasAnsweredBiometricPrompt(promptAnswered === "true");

      if (savedToken === "guest-token" && savedUserStr) {
        const saved = JSON.parse(savedUserStr);
        if (saved.id === "guest-user") { setToken(savedToken); setUser(saved); }
      } else if (savedToken && savedUserStr) {
        const profile = await fetchProfile(savedToken);
        setToken(savedToken);
        setUser(profile);
      }
    } catch {
      await Storage.removeItem(TOKEN_KEY);
      await Storage.removeItem(USER_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfile = async (access: string): Promise<UserProfile> => {
    const response = await safeNetworkFetch(`${getApiBaseUrl()}/auth/me`, { headers: { Authorization: `Bearer ${access}` } });
    if (!response?.ok) throw new Error("Oturum doğrulanamadı. E-posta ve şifrenizle giriş yapın.");
    const profile = await response.json();
    if (!profile.id || !profile.is_active) throw new Error("Hesap doğrulanamadı.");
    return { id:profile.id, email:profile.email, name:profile.full_name || profile.email.split("@")[0] };
  };

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await safeNetworkFetch(`${getApiBaseUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: pass })
      });

      if (!res) throw new Error("Sunucuya ulaşılamadı.");
      if (res.ok) {
        const data = await res.json();
        const access = data.access_token;
        if (typeof access !== "string" || !access) throw new Error("Sunucu geçerli oturum döndürmedi.");
        const profile = await fetchProfile(access);
        await Storage.setItem(TOKEN_KEY, access);
        await Storage.setItem(USER_KEY, JSON.stringify(profile));
        setToken(access);
        setUser(profile);
        return { success: true };
      } else {
        const err = await res.json().catch(() => ({ detail: "Giriş yapılamadı" }));
        return { success: false, error: err.detail || "Geçersiz e-posta veya şifre." };
      }
    } catch {
      return { success: false, error: "Sunucuya ulaşılamadı veya oturum doğrulanamadı. İnternet bağlantınızı kontrol edin." };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, pass: string, name: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await safeNetworkFetch(`${getApiBaseUrl()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: pass, full_name: name.trim() })
      });
      if (!res) throw new Error("Sunucuya ulaşılamadı.");
      if (res.ok) {
        return await login(email, pass);
      } else {
        const err = await res.json().catch(() => ({ detail: "Kayıt başarısız" }));
        return { success: false, error: err.detail || "Bu e-posta zaten kayıtlı olabilir." };
      }
    } catch {
      return { success: false, error: "Sunucuya ulaşılamadı; hesap oluşturulmadı. İnternet bağlantınızı kontrol edin." };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await Storage.removeItem(TOKEN_KEY);
    await Storage.removeItem(USER_KEY);
    await Storage.removeItem("seo_site_orgs");
    setToken(null);
    setUser(null);
  };

  const continueAsGuest = async () => {
    const guestUser: UserProfile = {
      id: "guest-user",
      email: "demo@seoplatform.io",
      name: "Demo Yönetici",
      role: "SEO_SPECIALIST"
    };
    await Storage.setItem(TOKEN_KEY, "guest-token");
    await Storage.setItem(USER_KEY, JSON.stringify(guestUser));
    setToken("guest-token");
    setUser(guestUser);
  };

  const loginAsDemo = continueAsGuest;

  const loginWithSocial = async (_provider: "Apple" | "Google", _email?: string, _name?: string) => {
    throw new Error("Sosyal giriş henüz yapılandırılmadı. E-posta ve şifrenizi kullanın.");
  };

  const loginWithBiometrics = async (_method?: "FACE_ID" | "TOUCH_ID") => {
    if (Platform.OS === "web" || !await LocalAuthentication.hasHardwareAsync() || !await LocalAuthentication.isEnrolledAsync()) {
      throw new Error("Bu cihazda biyometrik giriş kullanılamıyor.");
    }
    const enrolled = await Storage.getItem(BIOMETRIC_ENROLLED_KEY);
    const access = await Storage.getItem(TOKEN_KEY);
    if (enrolled !== "true" || !access || access === "guest-token") throw new Error("Önce şifrenizle giriş yapıp biyometrik girişi etkinleştirin.");
    const result = await LocalAuthentication.authenticateAsync({ promptMessage:"CALPEO oturumunu aç", cancelLabel:"Vazgeç", disableDeviceFallback:true });
    if (!result.success) throw new Error("Biyometrik doğrulama tamamlanmadı.");
    const profile = await fetchProfile(access);
    setToken(access);
    setUser(profile);
  };

  const enableBiometrics = async (type: "FACE_ID" | "TOUCH_ID") => {
    if (!token || token === "guest-token" || Platform.OS === "web") throw new Error("Biyometrik giriş için gerçek bir oturum ve desteklenen cihaz gerekir.");
    if (!await LocalAuthentication.hasHardwareAsync() || !await LocalAuthentication.isEnrolledAsync()) throw new Error("Cihazda kayıtlı biyometrik kimlik bulunmuyor.");
    await Storage.setItem(BIOMETRIC_ENROLLED_KEY, "true");
    await Storage.setItem(BIOMETRIC_TYPE_KEY, type);
    await Storage.setItem(BIOMETRIC_PROMPT_KEY, "true");
    setIsBiometricEnrolled(true);
    setEnrolledBiometricType(type);
    setHasAnsweredBiometricPrompt(true);
  };

  const disableBiometrics = async () => {
    await Storage.setItem(BIOMETRIC_ENROLLED_KEY, "false");
    setIsBiometricEnrolled(false);
  };

  const markBiometricPromptAnswered = async () => {
    await Storage.setItem(BIOMETRIC_PROMPT_KEY, "true");
    setHasAnsweredBiometricPrompt(true);
  };

  const resetBiometricPrompt = async () => {
    await Storage.removeItem(BIOMETRIC_PROMPT_KEY);
    await Storage.removeItem(BIOMETRIC_ENROLLED_KEY);
    await Storage.removeItem(BIOMETRIC_TYPE_KEY);
    setIsBiometricEnrolled(false);
    setEnrolledBiometricType(null);
    setHasAnsweredBiometricPrompt(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user),
        isLoading,
        isBiometricEnrolled,
        enrolledBiometricType,
        hasAnsweredBiometricPrompt,
        enableBiometrics,
        disableBiometrics,
        markBiometricPromptAnswered,
        resetBiometricPrompt,
        login,
        register,
        logout,
        continueAsGuest,
        loginAsDemo,
        loginWithSocial,
        loginWithBiometrics
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
