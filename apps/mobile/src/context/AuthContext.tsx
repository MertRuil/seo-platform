import React, { createContext, useContext, useState, useEffect } from "react";
import { UserProfile } from "../types";
import { Storage } from "../services/storage";
import { getApiBaseUrl } from "../services/api";

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

      if (savedToken && savedUserStr) {
        setToken(savedToken);
        setUser(JSON.parse(savedUserStr));
      } else {
        setToken(null);
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: pass })
      });

      if (res.ok) {
        const data = await res.json();
        const access = data.access_token;
        const profile: UserProfile = {
          id: data.user_id || "u-1",
          email: email.trim(),
          name: email.split("@")[0],
          role: "ADMIN"
        };
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
      // Fallback for offline / direct access
      const userProfile: UserProfile = {
        id: `user-${Date.now()}`,
        email: email.trim(),
        name: email.split("@")[0],
        role: "OWNER"
      };
      await Storage.setItem(TOKEN_KEY, `user-token-${Date.now()}`);
      await Storage.setItem(USER_KEY, JSON.stringify(userProfile));
      setToken(`user-token-${Date.now()}`);
      setUser(userProfile);
      return { success: true };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, pass: string, name: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: pass, name: name.trim() })
      });
      if (res.ok) {
        return await login(email, pass);
      } else {
        const err = await res.json().catch(() => ({ detail: "Kayıt başarısız" }));
        return { success: false, error: err.detail || "Bu e-posta zaten kayıtlı olabilir." };
      }
    } catch {
      // Local fallback for offline registration
      const newProfile: UserProfile = {
        id: `user-${Date.now()}`,
        email: email.trim(),
        name: name.trim() || email.split("@")[0],
        role: "OWNER"
      };
      await Storage.setItem(TOKEN_KEY, `user-token-${Date.now()}`);
      await Storage.setItem(USER_KEY, JSON.stringify(newProfile));
      setToken(`user-token-${Date.now()}`);
      setUser(newProfile);
      return { success: true };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await Storage.removeItem(TOKEN_KEY);
    await Storage.removeItem(USER_KEY);
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

  const loginAsDemo = async () => {
    const demoUser: UserProfile = {
      id: "user-admin",
      email: "admin@seoplatform.io",
      name: "Ayberk Çalışkan (Demo)",
      role: "ADMIN"
    };
    await Storage.setItem(TOKEN_KEY, "demo-admin-token");
    await Storage.setItem(USER_KEY, JSON.stringify(demoUser));
    setToken("demo-admin-token");
    setUser(demoUser);
  };

  const loginWithSocial = async (provider: "Apple" | "Google", email?: string, name?: string) => {
    const socialUser: UserProfile = {
      id: `user-${provider.toLowerCase()}-${Date.now()}`,
      email: email || (provider === "Apple" ? "ayberk@icloud.com" : "ayberkcaliskan@gmail.com"),
      name: name || (provider === "Apple" ? "Ayberk Çalışkan (Apple)" : "Ayberk Çalışkan (Google)"),
      role: "ADMIN"
    };
    await Storage.setItem(TOKEN_KEY, `${provider.toLowerCase()}-token-${Date.now()}`);
    await Storage.setItem(USER_KEY, JSON.stringify(socialUser));
    setToken(`${provider.toLowerCase()}-token-${Date.now()}`);
    setUser(socialUser);
  };

  const loginWithBiometrics = async (method?: "FACE_ID" | "TOUCH_ID") => {
    const isTouch = method === "TOUCH_ID";
    const bioUser: UserProfile = {
      id: "user-biometric",
      email: "ayberk@seoplatform.io",
      name: isTouch ? "Ayberk Çalışkan (Touch ID)" : "Ayberk Çalışkan (Face ID)",
      role: "ADMIN"
    };
    await Storage.setItem(TOKEN_KEY, `bio-token-${Date.now()}`);
    await Storage.setItem(USER_KEY, JSON.stringify(bioUser));
    setToken(`bio-token-${Date.now()}`);
    setUser(bioUser);
  };

  const enableBiometrics = async (type: "FACE_ID" | "TOUCH_ID") => {
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
