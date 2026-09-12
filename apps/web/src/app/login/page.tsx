"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Lock, Mail, User as UserIcon, Eye, EyeOff, ArrowRight, KeyRound, CheckCircle2, Zap, Globe, Sparkles } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { Input, Label, Segmented } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/States";
import { cn } from "@/lib/cn";

type Mode = "login" | "register";

function passwordStrength(pwd: string): number {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8) score += 25;
  if (/[A-Z]/.test(pwd)) score += 25;
  if (/[0-9]/.test(pwd)) score += 25;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 25;
  return score;
}

const strengthLabel = (s: number) => (s <= 25 ? "Zayıf" : s <= 50 ? "Orta" : s <= 75 ? "İyi" : "Güçlü");
const strengthClass = (s: number) => (s <= 25 ? "bg-critical" : s <= 50 ? "bg-warn" : s <= 75 ? "bg-accent" : "bg-evidence");

export default function LoginPage() {
  const { login, register, oauthLogin, forgotPassword } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // E-posta bazlı hatalı deneme takibi
  const [failedMap, setFailedMap] = useState<Record<string, number>>({});
  const cleanEmail = email.trim().toLowerCase();
  const failedAttempts = cleanEmail ? failedMap[cleanEmail] || 0 : 0;

  // Şifre sıfırlama
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState<"enter_email" | "enter_code">("enter_email");
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [devResetCode, setDevResetCode] = useState<string | null>(null);

  // 1-Tıkla Demo ve Anında Canlı Analiz
  const [demoLoading, setDemoLoading] = useState(false);
  const [quickAuditUrl, setQuickAuditUrl] = useState("");
  const [quickAuditLoading, setQuickAuditLoading] = useState(false);
  const [quickAuditResult, setQuickAuditResult] = useState<{ url: string; score: number; issues: number; critical: number } | null>(null);

  const handleDemoLogin = async () => {
    setError(null);
    setDemoLoading(true);
    const res = await login("admin@calpeo.io", "CalpeoAdmin2026!");
    setDemoLoading(false);
    if (!res.success) {
      setError(res.error || "Demo girişi yapılamadı.");
    }
  };

  const handleInstantAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAuditUrl.trim()) return;
    let target = quickAuditUrl.trim();
    if (!/^https?:\/\//i.test(target)) target = "https://" + target;
    setQuickAuditLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/audit/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Canlı analiz başarısız oldu.");
      const issues = (data.issues || []) as Array<{ severity: string }>;
      setQuickAuditResult({
        url: target,
        score: data.overall_score ?? data.health_score ?? 85,
        issues: issues.length,
        critical: issues.filter((i) => i.severity === "CRITICAL").length,
      });
    } catch (err: any) {
      setError(err.message || "Analiz sırasında bir hata oluştu.");
    } finally {
      setQuickAuditLoading(false);
    }
  };

  const enterWithAuditedSite = async () => {
    if (!quickAuditResult) return;
    setQuickAuditLoading(true);
    const loginRes = await login("admin@calpeo.io", "CalpeoAdmin2026!");
    if (loginRes.success) {
      try {
        const orgs = await api.getOrganizations();
        const orgId = orgs[0]?.id;
        if (orgId) {
          const site = await api.createSite(orgId, {
            name: new URL(quickAuditResult.url).hostname,
            primary_url: quickAuditResult.url,
          });
          await api.triggerCrawl(orgId, site.id);
          localStorage.setItem("calpeo_site", site.id);
        }
      } catch {
        // Devam et
      }
    }
    setQuickAuditLoading(false);
  };

  const strength = passwordStrength(password);

  const openForgot = (prefill?: string) => {
    setForgotEmail(prefill ?? email);
    setForgotStep("enter_email");
    setForgotError(null);
    setForgotSuccess(null);
    setDevResetCode(null);
    setForgotOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (mode === "register") {
      if (!fullName.trim()) return setError("Adınızı ve soyadınızı yazın.");
      if (!email.trim() || !password) return setError("Geçerli bir e-posta ve şifre girin.");
      if (password.length < 8) return setError("Şifre en az 8 karakter olmalı.");
      if (password !== confirmPassword) return setError("Şifreler birbiriyle eşleşmiyor.");
      setLoading(true);
      const res = await register(fullName, email, password);
      setLoading(false);
      if (!res.success) setError(res.error || "Kayıt gerçekleştirilemedi.");
      else setSuccess("Hesabınız oluşturuldu, yönlendiriliyorsunuz…");
      return;
    }

    if (!email.trim() || !password) return setError("E-posta ve şifrenizi eksiksiz girin.");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (!res.success) {
      const attempts = res.failed_attempts ?? failedAttempts + 1;
      setFailedMap((prev) => ({ ...prev, [cleanEmail]: attempts }));
      if (res.show_forgot_password || attempts >= 3) {
        setError(`Bu hesap için şifre ${attempts} kez hatalı girildi. Şifrenizi sıfırlayabilirsiniz.`);
        openForgot(email);
      } else {
        setError(res.error || `Hatalı şifre (${attempts}/3 deneme).`);
      }
    } else {
      setFailedMap((prev) => {
        const next = { ...prev };
        delete next[cleanEmail];
        return next;
      });
    }
  };

  const handleOauth = async (provider: "google" | "github" | "microsoft") => {
    setError(null);
    setOauthLoading(provider);
    const res = await oauthLogin(provider);
    setOauthLoading(null);
    if (!res.success) setError(res.error || `${provider} ile giriş yapılamadı.`);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);
    setDevResetCode(null);
    if (!forgotEmail.trim()) return setForgotError("Kayıtlı e-posta adresinizi girin.");
    setForgotLoading(true);
    const res = await forgotPassword(forgotEmail);
    setForgotLoading(false);
    if (!res.success) return setForgotError(res.error || "Doğrulama kodu gönderilemedi.");
    setForgotStep("enter_code");
    if (res.preview_code) {
      setDevResetCode(res.preview_code);
      setResetCode(res.preview_code);
    }
    setForgotSuccess(res.message || "Doğrulama kodu iletildi.");
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);
    if (!resetCode.trim()) return setForgotError("Doğrulama kodunu girin.");
    if (!newPassword || newPassword.length < 8) return setForgotError("Yeni şifre en az 8 karakter olmalı.");
    setForgotLoading(true);
    const res = await forgotPassword(forgotEmail, resetCode, newPassword);
    setForgotLoading(false);
    if (!res.success) return setForgotError(res.error || "Şifre sıfırlanamadı.");
    setForgotSuccess(res.message || "Şifreniz sıfırlandı.");
    setFailedMap((prev) => {
      const next = { ...prev };
      delete next[forgotEmail.trim().toLowerCase()];
      return next;
    });
    setTimeout(() => {
      setForgotOpen(false);
      setForgotStep("enter_email");
      setResetCode("");
      setNewPassword("");
      setDevResetCode(null);
      setForgotSuccess(null);
      setPassword("");
      setSuccess("Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.");
    }, 1200);
  };

  return (
    <div className="min-h-screen w-full bg-bg text-ink">
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12">
        {/* Sol: editoryal vaat — ürün içinden buraya taşındı */}
        <section className="hidden lg:flex lg:col-span-5 xl:col-span-6 flex-col justify-between p-10 xl:p-14 border-r border-line bg-surface">
          <div className="flex items-center gap-2.5">
            <Image src="/brand/calpeo-logo-signal-loop-v1.png" alt="CALPEO" width={32} height={32} className="object-contain" priority />
            <span className="font-bold tracking-wider">CALPEO</span>
          </div>
          <div className="max-w-md">
            <div className="flex items-center gap-2 font-mono text-2xs uppercase tracking-wider text-muted mb-4">
              <span className="calpeo-mark" aria-hidden />
              Arama görünürlüğü açıkça ölçülür
            </div>
            <h1 className="font-editorial text-4xl xl:text-5xl font-normal tracking-tight leading-[1.08] text-balance">
              Aramada görün. Yanıtlarda seçil. <span className="text-evidence">Sonucu kanıtla.</span>
            </h1>
            <p className="text-base text-muted mt-5">Google organik arama, yapay zeka yanıt motorları ve sitenizin teknik altyapısı için neyin çalıştığını, neyin düzeltilmesi gerektiğini tek bir kanıt tabanlı merkezde yönetin.</p>
            <ul className="mt-6 space-y-2 text-sm">
              {["Her öneri resmi Google belgesine dayanır", "Değişiklikler kaynağa yazılır; abonelikle kaybolmaz", "Etki, kontrol grubuyla nedensel ölçülür"].map((t) => (
                <li key={t} className="flex items-center gap-2 text-muted">
                  <CheckCircle2 className="w-4 h-4 text-evidence shrink-0" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted">Kontrol sende. Kanıt ekranda.</p>
        </section>

        {/* Sağ: form */}
        <main className="lg:col-span-7 xl:col-span-6 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="lg:hidden text-center mb-6">
              <Image src="/brand/calpeo-logo-signal-loop-v1.png" alt="CALPEO" width={48} height={48} className="object-contain mx-auto" priority />
              <div className="font-bold tracking-wider mt-2">CALPEO</div>
              <p className="text-sm text-muted">Kontrol sende. Kanıt ekranda.</p>
            </div>

            <div className="bg-surface border border-line rounded-lg p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold">{mode === "login" ? "Giriş yap" : "Hesap oluştur"}</h2>
                <Segmented<Mode>
                  label="Giriş türü"
                  value={mode}
                  onChange={(m) => {
                    setMode(m);
                    setError(null);
                    setSuccess(null);
                  }}
                  options={[
                    { value: "login", label: "Giriş" },
                    { value: "register", label: "Kayıt" },
                  ]}
                  size="md"
                />
              </div>

              {/* Hızlı Demo ve Canlı Denetim Kartı */}
              <div className="space-y-3 pb-1 border-b border-line">
                <div className="p-3.5 rounded-md bg-accent-soft border border-accent/20 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-accent-ink flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-accent" />
                      Sistemi Hemen Test Edin
                    </span>
                    <span className="text-2xs font-mono px-2 py-0.5 rounded bg-surface border border-line text-muted">Hazır Demo</span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Sistemi hazır e-ticaret verileri, otonom yapay zeka ajanları ve 14 teknik modülle keşfetmek için şifresiz giriş yapın.
                  </p>
                  <Button
                    type="button"
                    variant="primary"
                    loading={demoLoading}
                    onClick={handleDemoLogin}
                    className="w-full justify-center text-xs py-2 shadow-sm font-semibold"
                  >
                    🚀 Tek Tıkla Canlı Demo Girişi
                  </Button>
                </div>

                <div className="p-3 rounded-md bg-surface-2 border border-line flex flex-col gap-2">
                  <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-evidence" />
                    Kendi Web Sitenizi Canlı Analiz Edin
                  </span>
                  <form onSubmit={handleInstantAudit} className="flex gap-2">
                    <Input
                      placeholder="https://siteniz.com"
                      value={quickAuditUrl}
                      onChange={(e) => setQuickAuditUrl(e.target.value)}
                      className="text-xs"
                      aria-label="Canlı analiz edilecek site adresi"
                    />
                    <Button type="submit" variant="secondary" loading={quickAuditLoading} size="sm" className="shrink-0 text-xs">
                      Analiz Et
                    </Button>
                  </form>
                  {quickAuditResult && (
                    <div className="p-2.5 rounded bg-surface border border-line flex items-center justify-between text-xs mt-1 animate-fade-in">
                      <div>
                        <div className="font-semibold text-ink">Sağlık Skoru: {quickAuditResult.score}/100</div>
                        <div className="text-2xs text-muted">
                          {quickAuditResult.issues} bulgu tespit edildi ({quickAuditResult.critical} kritik)
                        </div>
                      </div>
                      <Button size="sm" variant="primary" onClick={enterWithAuditedSite} loading={quickAuditLoading} className="text-xs">
                        Panele Aktar →
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["google", "Google"],
                    ["github", "GitHub"],
                    ["microsoft", "Microsoft"],
                  ] as const
                ).map(([p, label]) => (
                  <Button key={p} type="button" variant="secondary" loading={oauthLoading === p} onClick={() => handleOauth(p)} aria-label={`${label} ile devam et`}>
                    {label}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-3 text-2xs font-mono uppercase tracking-wider text-muted">
                <span className="flex-1 border-t border-line" aria-hidden />
                veya e-posta ile
                <span className="flex-1 border-t border-line" aria-hidden />
              </div>

              {error && <Notice tone="error">{error}</Notice>}
              {success && <Notice tone="success">{success}</Notice>}
              {failedAttempts >= 3 && mode === "login" && (
                <Notice tone="warn" action={<Button size="sm" variant="secondary" onClick={() => openForgot(email)}>Şifreyi sıfırla</Button>}>
                  Şifre 3 kez hatalı girildi ({cleanEmail}).
                </Notice>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {mode === "register" && (
                  <div>
                    <Label htmlFor="fullName">Ad soyad</Label>
                    <Input id="fullName" icon={<UserIcon className="w-4 h-4" />} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Adınız Soyadınız" autoComplete="name" required />
                  </div>
                )}
                <div>
                  <Label htmlFor="email">E-posta</Label>
                  <Input id="email" type="email" icon={<Mail className="w-4 h-4" />} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="adiniz@sirket.com" autoComplete="email" required />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{mode === "register" ? "Şifre" : "Şifre"}</Label>
                    {mode === "login" && (
                      <button type="button" onClick={() => openForgot(email)} className="text-xs font-medium text-accent-ink hover:underline cursor-pointer mb-1">
                        Şifrenizi mi unuttunuz?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      icon={<Lock className="w-4 h-4" />}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "register" ? "En az 8 karakter" : "••••••••"}
                      autoComplete={mode === "register" ? "new-password" : "current-password"}
                      className="pr-10"
                      required
                    />
                    <IconButton label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"} onClick={() => setShowPassword((s) => !s)} className="absolute right-0.5 top-0.5">
                      {showPassword ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
                    </IconButton>
                  </div>
                  {mode === "register" && password && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-2xs text-muted mb-1">
                        <span>Şifre gücü</span>
                        <span className="font-semibold">{strengthLabel(strength)}</span>
                      </div>
                      <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden" aria-hidden>
                        <div className={cn("h-full rounded-full transition-all", strengthClass(strength))} style={{ width: `${strength}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                {mode === "register" && (
                  <div>
                    <Label htmlFor="confirm">Şifre (tekrar)</Label>
                    <Input id="confirm" type="password" icon={<Lock className="w-4 h-4" />} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Şifrenizi tekrar yazın" autoComplete="new-password" required />
                  </div>
                )}
                <Button type="submit" loading={loading} className="w-full" icon={<ArrowRight className="w-4 h-4" />}>
                  {mode === "register" ? "Kayıt ol" : "Giriş yap"}
                </Button>
                {mode === "login" && (
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("admin@calpeo.io");
                        setPassword("CalpeoAdmin2026!");
                      }}
                      className="text-2xs text-muted hover:text-ink transition-colors cursor-pointer inline-flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3 text-accent" />
                      Yönetici bilgilerini doldur: <span className="font-mono text-accent-ink font-semibold">admin@calpeo.io</span>
                    </button>
                  </div>
                )}
              </form>

              <p className="text-center text-xs text-muted">
                {mode === "login" ? (
                  <>
                    Hesabınız yok mu?{" "}
                    <button type="button" onClick={() => setMode("register")} className="font-semibold text-accent-ink hover:underline cursor-pointer">
                      Kayıt olun
                    </button>
                  </>
                ) : (
                  <>
                    Zaten hesabınız var mı?{" "}
                    <button type="button" onClick={() => setMode("login")} className="font-semibold text-accent-ink hover:underline cursor-pointer">
                      Giriş yapın
                    </button>
                  </>
                )}
              </p>
            </div>

            <p className="text-center text-2xs text-muted mt-4">Şifreler tuzlanmış PBKDF2 ile saklanır · Oturum HMAC-SHA256 imzalı</p>
          </div>
        </main>
      </div>

      <Modal open={forgotOpen} onClose={() => setForgotOpen(false)} title="Şifre sıfırlama" icon={<KeyRound className="w-4 h-4" />}>
        {forgotError && (
          <Notice tone="error" className="mb-3">
            {forgotError}
          </Notice>
        )}
        {forgotSuccess && (
          <Notice tone="success" className="mb-3">
            {forgotSuccess}
          </Notice>
        )}
        {devResetCode && (
          <Notice tone="info" className="mb-3">
            <span className="block text-xs">Geliştirme ortamı: e-posta gönderilmedi, kod aşağıda.</span>
            <span className="font-mono text-lg tracking-widest">{devResetCode}</span>
          </Notice>
        )}
        {forgotStep === "enter_email" ? (
          <form onSubmit={handleSendCode} className="space-y-4">
            <p className="text-sm text-muted">Kayıtlı e-postanıza 6 haneli, 10 dakika geçerli bir doğrulama kodu göndereceğiz.</p>
            <div>
              <Label htmlFor="forgotEmail">E-posta</Label>
              <Input id="forgotEmail" type="email" icon={<Mail className="w-4 h-4" />} value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="adiniz@sirket.com" required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setForgotOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" loading={forgotLoading}>
                Kod gönder
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <Label htmlFor="resetCode">Doğrulama kodu</Label>
              <Input id="resetCode" value={resetCode} onChange={(e) => setResetCode(e.target.value)} placeholder="123456" mono inputMode="numeric" maxLength={6} required />
            </div>
            <div>
              <Label htmlFor="newPassword">Yeni şifre</Label>
              <Input id="newPassword" type="password" icon={<Lock className="w-4 h-4" />} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="En az 8 karakter" autoComplete="new-password" required />
            </div>
            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" onClick={() => setForgotStep("enter_email")}>
                Geri
              </Button>
              <Button type="submit" loading={forgotLoading}>
                Şifreyi güncelle
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
