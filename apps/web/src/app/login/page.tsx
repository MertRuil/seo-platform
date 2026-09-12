"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import {
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  KeyRound,
  X,
  Sparkles,
  Info
} from "lucide-react";

export default function LoginPage() {
  const { login, register, oauthLogin, forgotPassword } = useAuth();

  // "login" (Giriş Yap) veya "register" (Kayıt Ol)
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status State
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // E-posta bazlı bağımsız hatalı deneme takibi (farklı hesapların birbirini etkilemesini önler)
  const [failedAttemptsMap, setFailedAttemptsMap] = useState<Record<string, number>>({});
  
  // Şifre Sıfırlama Modal State
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<"enter_email" | "enter_code">("enter_email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetCodeInput, setResetCodeInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [devResetCode, setDevResetCode] = useState<string | null>(null);

  // Mevcut girilen e-postaya ait hatalı deneme sayısı
  const cleanEmail = email.trim().toLowerCase();
  const currentEmailFailedAttempts = cleanEmail ? (failedAttemptsMap[cleanEmail] || 0) : 0;

  // Şifre Gücü Hesaplayıcı
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (/[A-Z]/.test(pwd)) score += 25;
    if (/[0-9]/.test(pwd)) score += 25;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 25;
    return score;
  };

  const pwdStrength = getPasswordStrength(password);

  // Giriş / Kayıt Formunu Gönderme
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (authMode === "register") {
      // Kayıt Ol Doğrulamaları
      if (!fullName.trim()) {
        setError("Lütfen adınızı ve soyadınızı belirtin.");
        return;
      }
      if (!email.trim() || !password) {
        setError("Lütfen geçerli bir e-posta ve şifre girin.");
        return;
      }
      if (password.length < 8) {
        setError("Şifreniz en az 8 karakter uzunluğunda olmalıdır.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Girdiğiniz şifreler birbiriyle eşleşmiyor.");
        return;
      }

      setIsLoading(true);
      const res = await register(fullName, email, password);
      setIsLoading(false);

      if (!res.success) {
        setError(res.error || "Kayıt işlemi gerçekleştirilemedi.");
      } else {
        setSuccessMessage("Hesabınız başarıyla oluşturuldu, yönlendiriliyorsunuz...");
      }
    } else {
      // Giriş Yap Doğrulaması
      if (!email.trim() || !password) {
        setError("Lütfen e-posta ve şifrenizi eksiksiz girin.");
        return;
      }

      setIsLoading(true);
      const res = await login(email, password);
      setIsLoading(false);

      if (!res.success) {
        const targetEmail = email.trim().toLowerCase();
        const serverAttempts = res.failed_attempts ?? (currentEmailFailedAttempts + 1);

        // Hatalı deneme sayacını yalnızca bu e-postaya özel güncelle
        setFailedAttemptsMap((prev) => ({
          ...prev,
          [targetEmail]: serverAttempts,
        }));

        if (res.show_forgot_password || serverAttempts >= 3) {
          setError(`Bu hesap için şifre ${serverAttempts} kez hatalı girildi. Güvenliğiniz için lütfen şifrenizi sıfırlayın.`);
          setForgotEmail(email);
          setShowForgotPasswordModal(true);
        } else {
          setError(res.error || `Hatalı şifre girdiniz (${serverAttempts}/3 deneme).`);
        }
      } else {
        // Başarılı giriş -> bu e-postanın hatalı denemelerini temizle
        setFailedAttemptsMap((prev) => {
          const next = { ...prev };
          delete next[cleanEmail];
          return next;
        });
      }
    }
  };

  // SSO / Giriş Entegrasyonları (Google, GitHub, Microsoft)
  const handleOauth = async (provider: "google" | "github" | "microsoft") => {
    setError(null);
    setOauthLoading(provider);
    const res = await oauthLogin(provider);
    setOauthLoading(null);

    if (!res.success) {
      setError(res.error || `${provider.toUpperCase()} ile giriş yapılamadı.`);
    }
  };

  // 1. Adım: E-postaya 6 Haneli Güvenlik Kodu Gönderme
  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);
    setDevResetCode(null);

    if (!forgotEmail.trim()) {
      setForgotError("Lütfen kayıtlı e-posta adresinizi girin.");
      return;
    }

    setForgotLoading(true);
    const res = await forgotPassword(forgotEmail);
    setForgotLoading(false);

    if (!res.success) {
      setForgotError(res.error || "Doğrulama kodu gönderilemedi.");
    } else {
      setForgotStep("enter_code");
      if (res.preview_code) {
        setDevResetCode(res.preview_code);
        setResetCodeInput(res.preview_code);
      }
      setForgotSuccess(res.message || "Doğrulama kodu iletildi.");
    }
  };

  // 2. Adım: Kod Doğrulama ve Yeni Şifre Belirleme
  const handleVerifyAndResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);

    if (!resetCodeInput.trim()) {
      setForgotError("Lütfen doğrulama kodunu girin.");
      return;
    }

    if (!newPasswordInput || newPasswordInput.length < 8) {
      setForgotError("Yeni şifreniz en az 8 karakter olmalıdır.");
      return;
    }

    setForgotLoading(true);
    const res = await forgotPassword(forgotEmail, resetCodeInput, newPasswordInput);
    setForgotLoading(false);

    if (!res.success) {
      setForgotError(res.error || "Şifre sıfırlama işlemi başarısız oldu.");
    } else {
      setForgotSuccess(res.message || "Şifreniz başarıyla sıfırlandı.");
      
      // Başarılı sıfırlamada hatalı deneme sayısını sıfırla
      setFailedAttemptsMap((prev) => {
        const next = { ...prev };
        delete next[forgotEmail.trim().toLowerCase()];
        return next;
      });

      setTimeout(() => {
        setShowForgotPasswordModal(false);
        setForgotStep("enter_email");
        setResetCodeInput("");
        setNewPasswordInput("");
        setDevResetCode(null);
        setForgotSuccess(null);
        setPassword("");
        setSuccessMessage("Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.");
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[#f5f6f8] dark:bg-[#171817] relative overflow-hidden font-sans transition-colors duration-150">
      {/* Arka plan ışık efektleri */}
      <div className="absolute top-1/4 left-1/4 w-[26rem] h-[26rem] bg-[#3157e5]/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-1/4 right-1/4 w-[26rem] h-[26rem] bg-[#148b79]/10 rounded-full blur-3xl pointer-events-none translate-x-1/2 translate-y-1/2" />

      <div className="w-full max-w-lg z-10 my-8">
        {/* Logo & Başlık */}
        <div className="text-center mb-6">
          <div className="relative w-14 h-14 mx-auto mb-3 flex items-center justify-center">
            <Image 
              src="/brand/calpeo-logo-signal-loop-v1.png" 
              alt="CALPEO Logo" 
              width={56} 
              height={56} 
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#121316] dark:text-white flex items-center justify-center gap-2">
            CALPEO
            <span className="text-xs px-2 py-0.5 rounded bg-[#3157e5]/15 text-[#3157e5] border border-[#3157e5]/30 font-mono font-bold tracking-normal">
              PRO v2.0
            </span>
          </h1>
          <p className="text-sm text-[#656971] dark:text-[#8c8d89] mt-1 font-medium">
            Kontrol sende. Kanıt ekranda.
          </p>
        </div>

        {/* Ana Kart */}
        <div className="bg-white dark:bg-[#202120] border border-[#d9dce1] dark:border-[#343633] rounded-2xl p-6 sm:p-8 shadow-xl shadow-black/5 dark:shadow-black/80 relative transition-colors">
          
          {/* Giriş Yap / Kayıt Ol Sekmeleri */}
          <div className="flex p-1 bg-[#eff1f4] dark:bg-[#171817] rounded-lg border border-[#d9dce1] dark:border-[#343633] mb-6">
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setError(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                authMode === "login"
                  ? "bg-[#3157e5] text-white shadow-md shadow-[#3157e5]/30"
                  : "text-[#656971] dark:text-[#8c8d89] hover:text-[#121316] dark:hover:text-white hover:bg-white/60 dark:hover:bg-[#202120]"
              }`}
            >
              <span>Giriş Yap</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("register");
                setError(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                authMode === "register"
                  ? "bg-[#3157e5] text-white shadow-md shadow-[#3157e5]/30"
                  : "text-[#656971] dark:text-[#8c8d89] hover:text-[#121316] dark:hover:text-white hover:bg-white/60 dark:hover:bg-[#202120]"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Yeni Kayıt Ol</span>
            </button>
          </div>

          {/* Giriş Entegrasyonları (OAuth / SSO Butonları) */}
          <div className="mb-6">
            <div className="text-xs font-semibold text-[#656971] dark:text-[#8c8d89] uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Kurumsal Giriş Entegrasyonları</span>
              <span className="text-[10px] text-[#8a8e96] dark:text-[#70726d] font-normal">Tek Tıkla Giriş</span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Google Entegrasyonu */}
              <button
                type="button"
                onClick={() => handleOauth("google")}
                disabled={Boolean(oauthLoading)}
                className="py-2.5 px-3 rounded-xl bg-[#f5f6f8] dark:bg-[#171817] hover:bg-[#ebeef2] dark:hover:bg-[#252624] border border-[#d9dce1] dark:border-[#343633] text-[#121316] dark:text-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 group cursor-pointer shadow-xs"
                title="Google Workspace ile Giriş Yap"
              >
                {oauthLoading === "google" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#3157e5]" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                )}
                <span className="hidden sm:inline">Google</span>
              </button>

              {/* GitHub Entegrasyonu */}
              <button
                type="button"
                onClick={() => handleOauth("github")}
                disabled={Boolean(oauthLoading)}
                className="py-2.5 px-3 rounded-xl bg-[#f5f6f8] dark:bg-[#171817] hover:bg-[#ebeef2] dark:hover:bg-[#252624] border border-[#d9dce1] dark:border-[#343633] text-[#121316] dark:text-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-xs"
                title="GitHub Developer SSO ile Giriş Yap"
              >
                {oauthLoading === "github" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#3157e5]" />
                ) : (
                  <svg className="w-4 h-4 fill-current shrink-0 text-[#121316] dark:text-slate-200" viewBox="0 0 24 24">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                )}
                <span className="hidden sm:inline">GitHub</span>
              </button>

              {/* Microsoft Entegrasyonu */}
              <button
                type="button"
                onClick={() => handleOauth("microsoft")}
                disabled={Boolean(oauthLoading)}
                className="py-2.5 px-3 rounded-xl bg-[#f5f6f8] dark:bg-[#171817] hover:bg-[#ebeef2] dark:hover:bg-[#252624] border border-[#d9dce1] dark:border-[#343633] text-[#121316] dark:text-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-xs"
                title="Microsoft Entra / 365 ile Giriş Yap"
              >
                {oauthLoading === "microsoft" ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#3157e5]" />
                ) : (
                  <div className="grid grid-cols-2 gap-0.5 w-4 h-4 shrink-0">
                    <div className="bg-[#F25022] rounded-[1px]" />
                    <div className="bg-[#7FBA00] rounded-[1px]" />
                    <div className="bg-[#00A4EF] rounded-[1px]" />
                    <div className="bg-[#FFB900] rounded-[1px]" />
                  </div>
                )}
                <span className="hidden sm:inline">Microsoft</span>
              </button>
            </div>
          </div>

          {/* Ayraç (Divider) */}
          <div className="relative flex py-2 items-center mb-5">
            <div className="flex-grow border-t border-[#e2e4e8] dark:border-[#343633]"></div>
            <span className="flex-shrink mx-4 text-[11px] uppercase tracking-wider text-[#8a8e96] dark:text-[#70726d] font-semibold">
              veya e-posta ile {authMode === "login" ? "giriş yapın" : "kaydolun"}
            </span>
            <div className="flex-grow border-t border-[#e2e4e8] dark:border-[#343633]"></div>
          </div>

          {/* Hata Bildirimi */}
          {error && (
            <div className="mb-4 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-3 text-rose-600 dark:text-rose-400 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Başarı Bildirimi */}
          {successMessage && (
            <div className="mb-4 p-3.5 bg-[#0f927c]/10 border border-[#0f927c]/30 rounded-xl flex items-start gap-3 text-[#0f927c] dark:text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* ⚠️ ŞİFRE 3 KEZ YANLIŞ GİRİLDİĞİNDE ÇIKAN "ŞİFRENİ Mİ UNUTTUN" BÖLÜMÜ (SADECE O E-POSTA İÇİN) */}
          {currentEmailFailedAttempts >= 3 && authMode === "login" && (
            <div className="mb-5 p-4 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl animate-fade-in text-amber-800 dark:text-amber-300 relative overflow-hidden shadow-sm">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                      3 Kez Hatalı Şifre Girildi ({cleanEmail})
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold">
                      Güvenlik Koruması
                    </span>
                  </div>
                  <p className="text-xs text-amber-800/90 dark:text-amber-300/80 mt-1 leading-relaxed">
                    Bu hesaba erişmekte sorun mu yaşıyorsunuz? Doğrulama kodu talep ederek şifrenizi hemen yenileyebilirsiniz.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setShowForgotPasswordModal(true);
                    }}
                    className="mt-3 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Şifremi Sıfırla (Doğrulama Kodu Al)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Form Alanı */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Kayıt Modu: Ad Soyad Alanı */}
            {authMode === "register" && (
              <div className="animate-fade-in">
                <label className="block text-xs font-semibold text-[#121316] dark:text-slate-300 mb-1.5">
                  Adınız ve Soyadınız
                </label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#8a8e96] dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Örn: Ayberk Mert"
                    className="w-full bg-[#f5f6f8] dark:bg-[#171817] border border-[#cfd3da] dark:border-[#343633] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#121316] dark:text-white placeholder-[#8a8e96] dark:placeholder-[#6f6d66] focus:outline-none focus:border-[#3157e5] transition-all shadow-xs"
                    required={authMode === "register"}
                  />
                </div>
              </div>
            )}

            {/* E-Posta Alanı */}
            <div>
              <label className="block text-xs font-semibold text-[#121316] dark:text-slate-300 mb-1.5">
                Kurumsal E-Posta Adresi
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8a8e96] dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="adiniz@sirket.com"
                  className="w-full bg-[#f5f6f8] dark:bg-[#171817] border border-[#cfd3da] dark:border-[#343633] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#121316] dark:text-white placeholder-[#8a8e96] dark:placeholder-[#6f6d66] focus:outline-none focus:border-[#3157e5] transition-all shadow-xs"
                  required
                />
              </div>
            </div>

            {/* Şifre Alanı */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#121316] dark:text-slate-300">
                  {authMode === "register" ? "Güçlü Şifre Oluşturun" : "Erişim Şifresi"}
                </label>
                {authMode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setShowForgotPasswordModal(true);
                    }}
                    className="text-[11px] text-[#3157e5] dark:text-indigo-400 hover:underline transition-colors font-medium cursor-pointer"
                  >
                    Şifrenizi mi unuttunuz?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8a8e96] dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={authMode === "register" ? "En az 8 karakter..." : "••••••••"}
                  className="w-full bg-[#f5f6f8] dark:bg-[#171817] border border-[#cfd3da] dark:border-[#343633] rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#121316] dark:text-white placeholder-[#8a8e96] dark:placeholder-[#6f6d66] focus:outline-none focus:border-[#3157e5] transition-all shadow-xs"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8a8e96] hover:text-[#121316] dark:hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Kayıt Modu: Şifre Gücü Çubuğu */}
              {authMode === "register" && password && (
                <div className="mt-2 space-y-1 animate-fade-in">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#656971] dark:text-slate-400">Şifre Gücü</span>
                    <span
                      className={`font-semibold ${
                        pwdStrength <= 25
                          ? "text-rose-500"
                          : pwdStrength <= 50
                          ? "text-amber-600"
                          : pwdStrength <= 75
                          ? "text-blue-500"
                          : "text-[#0f927c]"
                      }`}
                    >
                      {pwdStrength <= 25
                        ? "Zayıf"
                        : pwdStrength <= 50
                        ? "Orta"
                        : pwdStrength <= 75
                        ? "İyi"
                        : "Çok Güçlü"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-[#e2e4e8] dark:bg-[#2c2d2b] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        pwdStrength <= 25
                          ? "bg-rose-500 w-1/4"
                          : pwdStrength <= 50
                          ? "bg-amber-500 w-2/4"
                          : pwdStrength <= 75
                          ? "bg-[#3157e5] w-3/4"
                          : "bg-[#0f927c] w-full"
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Kayıt Modu: Şifre Tekrarı Alanı */}
            {authMode === "register" && (
              <div className="animate-fade-in">
                <label className="block text-xs font-semibold text-[#121316] dark:text-slate-300 mb-1.5">
                  Şifrenizi Tekrar Girin
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8a8e96] dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Şifreyi doğrulayın..."
                    className="w-full bg-[#f5f6f8] dark:bg-[#171817] border border-[#cfd3da] dark:border-[#343633] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#121316] dark:text-white placeholder-[#8a8e96] dark:placeholder-[#6f6d66] focus:outline-none focus:border-[#3157e5] transition-all shadow-xs"
                    required={authMode === "register"}
                  />
                </div>
              </div>
            )}

            {/* Gönder Butonu (Kayıt Ol veya Giriş Yap) */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-2.5 px-4 rounded-lg bg-[#3157e5] hover:bg-[#2546c7] text-white font-semibold text-xs tracking-wide shadow-xs flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 active:scale-[0.99] cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {authMode === "register" ? "Hesap Oluşturuluyor..." : "Kimlik Doğrulanıyor..."}
                  </span>
                </>
              ) : (
                <>
                  <span>
                    {authMode === "register" ? "Kayıt Ol ve Hemen Başla" : "Sisteme Giriş Yap"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Alt Bilgi & Hızlı Geçiş */}
          <div className="mt-5 text-center text-xs text-[#656971] dark:text-[#8c8d89]">
            {authMode === "login" ? (
              <span>
                Henüz bir hesabınız yok mu?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-[#3157e5] dark:text-indigo-400 hover:underline font-semibold ml-1 cursor-pointer"
                >
                  Ücretsiz Kayıt Olun
                </button>
              </span>
            ) : (
              <span>
                Zaten bir hesabınız var mı?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="text-[#3157e5] dark:text-indigo-400 hover:underline font-semibold ml-1 cursor-pointer"
                >
                  Giriş Yapın
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Güvenlik Rozetleri */}
        <div className="mt-6 text-center flex items-center justify-center gap-3 text-xs text-[#8a8e96] dark:text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#0f927c]" />
            <span>256-Bit SSL Şifreleme</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-[#3157e5]" />
            <span>OAuth 2.0 / Argon2id</span>
          </div>
        </div>
      </div>

      {/* ŞİFRE SIFIRLAMA MODALI (TAM ÇİFT TEMA & DİNAMİK DEV KOD DESTEĞİ) */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-[#202120] border border-[#d9dce1] dark:border-[#343633] rounded-2xl p-6 shadow-2xl relative text-[#121316] dark:text-white">
            <button
              type="button"
              onClick={() => {
                setShowForgotPasswordModal(false);
                setForgotError(null);
                setForgotSuccess(null);
                setDevResetCode(null);
              }}
              className="absolute top-4 right-4 text-[#8a8e96] hover:text-[#121316] dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-[#3157e5]/10 border border-[#3157e5]/20 text-[#3157e5] dark:text-indigo-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#121316] dark:text-white">Şifremi Sıfırla</h3>
                <p className="text-xs text-[#656971] dark:text-[#8c8d89]">
                  Hesabınıza ait e-posta ile yeni şifre belirleyin
                </p>
              </div>
            </div>

            {forgotError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3 bg-[#0f927c]/10 border border-[#0f927c]/30 rounded-xl text-[#0f927c] dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {/* Test/Simülasyon Kodu Gösterim Kutusu (E-posta sunucusu bağlı olmadığında kullanıcıyı bilgilendirir) */}
            {devResetCode && (
              <div className="mb-4 p-3.5 rounded-xl bg-[#3157e5]/10 border border-[#3157e5]/30 text-xs text-[#3157e5] dark:text-indigo-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#3157e5] dark:text-indigo-400" />
                    Doğrulama Kodunuz:
                  </span>
                  <span className="font-mono text-base font-extrabold tracking-wider bg-white dark:bg-[#171817] px-2.5 py-0.5 rounded border border-[#3157e5]/30 text-[#121316] dark:text-white">
                    {devResetCode}
                  </span>
                </div>
                <p className="text-[11px] text-[#656971] dark:text-slate-400 leading-relaxed">
                  Yerel test ortamında harici e-posta sunucusu bağlı olmadığı için 6 haneli kodunuz otomatik olarak ekranda hazırlanmıştır.
                </p>
                <button
                  type="button"
                  onClick={() => setResetCodeInput(devResetCode)}
                  className="text-xs font-semibold underline text-[#3157e5] dark:text-indigo-400 hover:opacity-80 cursor-pointer"
                >
                  Kodu Giriş Alanına Otomatik Aktar
                </button>
              </div>
            )}

            {forgotStep === "enter_email" ? (
              <form onSubmit={handleSendResetCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#121316] dark:text-slate-300 mb-1.5">
                    Kayıtlı E-Posta Adresi
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#8a8e96] dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="ornek@sirket.com"
                      className="w-full bg-[#f5f6f8] dark:bg-[#171817] border border-[#cfd3da] dark:border-[#343633] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#121316] dark:text-white placeholder-[#8a8e96] dark:placeholder-[#6f6d66] focus:outline-none focus:border-[#3157e5] shadow-xs"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-[#656971] dark:text-[#8c8d89] mt-1.5">
                    Bu adrese 10 dakika geçerli tek kullanımlık güvenlik kodu gönderilecektir.
                  </p>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPasswordModal(false);
                      setForgotStep("enter_email");
                      setDevResetCode(null);
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-[#d9dce1] dark:border-[#343633] hover:bg-[#f5f6f8] dark:hover:bg-[#252624] text-[#656971] dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#3157e5] hover:bg-[#2546c7] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Kod Hazırlanıyor...</span>
                      </>
                    ) : (
                      <span>Doğrulama Kodu Al</span>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#121316] dark:text-slate-300 mb-1.5">
                    6 Haneli Doğrulama Kodu
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#8a8e96] dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      maxLength={6}
                      value={resetCodeInput}
                      onChange={(e) => setResetCodeInput(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="w-full bg-[#f5f6f8] dark:bg-[#171817] border border-[#cfd3da] dark:border-[#343633] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#121316] dark:text-white tracking-widest font-mono placeholder-[#8a8e96] dark:placeholder-[#6f6d66] focus:outline-none focus:border-[#3157e5] shadow-xs"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-[#656971] dark:text-[#8c8d89] mt-1">
                    {forgotEmail} için iletilen 6 haneli kodu girin.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#121316] dark:text-slate-300 mb-1.5">
                    Yeni Şifreniz
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#8a8e96] dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="En az 8 karakter..."
                      className="w-full bg-[#f5f6f8] dark:bg-[#171817] border border-[#cfd3da] dark:border-[#343633] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#121316] dark:text-white placeholder-[#8a8e96] dark:placeholder-[#6f6d66] focus:outline-none focus:border-[#3157e5] shadow-xs"
                      required
                      minLength={8}
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForgotStep("enter_email");
                      setDevResetCode(null);
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-[#d9dce1] dark:border-[#343633] hover:bg-[#f5f6f8] dark:hover:bg-[#252624] text-[#656971] dark:text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Geri
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-[#0f927c] hover:bg-[#0c7866] text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Güncelleniyor...</span>
                      </>
                    ) : (
                      <span>Şifremi Güncelle</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
