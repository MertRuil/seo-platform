"use client";

import React, { useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { Lock, Mail, User as UserIcon, Eye, EyeOff, ArrowRight, KeyRound, CheckCircle2, Globe } from "lucide-react";
import { Button, IconButton } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/States";
import { SeverityBadge } from "@/components/ui/Badge";
import { setPendingSite } from "@/lib/pendingSite";
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
  const { login, register, forgotPassword } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
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

  // Anında Canlı Analiz (giriş gerektirmez)
  const [quickAuditUrl, setQuickAuditUrl] = useState("");
  const [quickAuditLoading, setQuickAuditLoading] = useState(false);
  const [quickAuditResult, setQuickAuditResult] = useState<{
    url: string;
    score: number | null;
    findings: Array<{ title: string; severity: string; recommendation?: string }>;
    critical: number;
  } | null>(null);

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
      const issues = (data.issues || []) as Array<{ title: string; severity: string; recommendation?: string }>;
      const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const score = data.overall_score ?? data.health_score;
      setQuickAuditResult({
        url: target,
        score: typeof score === "number" ? score : null,
        findings: [...issues].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9)),
        critical: issues.filter((i) => i.severity === "CRITICAL").length,
      });
    } catch (err: any) {
      setError(err.message || "Analiz sırasında bir hata oluştu.");
    } finally {
      setQuickAuditLoading(false);
    }
  };

  // Panele aktarmak için gerçek bir hesap gerekir: adres saklanır, kayıttan sonra ilk proje olarak eklenip taranır.
  const enterWithAuditedSite = () => {
    if (!quickAuditResult) return;
    setPendingSite(quickAuditResult.url);
    setMode("register");
    setError(null);
    setSuccess(`Hesabınızı oluşturduğunuzda ${quickAuditResult.url.replace(/^https?:\/\//, "")} ilk projeniz olarak eklenecek ve tüm sayfaları taranacak.`);
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
              {["Her öneri resmi Google belgesine dayanır", "Değişiklikler kaynağa yazılır; abonelikle kaybolmaz", "Ölçüm, kontrol grubuyla karşılaştırılır"].map((t) => (
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
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{mode === "login" ? "Giriş yap" : "Hesap oluştur"}</h2>
                <p className="text-xs text-muted">
                  {mode === "login"
                    ? "Hesabınıza güvenle erişin ve SEO verilerinizi yönetin."
                    : "Yeni bir hesap oluşturarak sitenizi hemen analiz etmeye başlayın."}
                </p>
              </div>

              {/* Girişsiz denetim: kayıt olmadan önce ilk değer */}
              <div className="space-y-3 pb-4 border-b border-line">
                <div className="p-3 rounded-md bg-surface-2 border border-line flex flex-col gap-2">
                  <label htmlFor="quick-audit-url" className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-evidence" aria-hidden />
                    Kayıt olmadan sitenizi kontrol edin
                  </label>
                  <form onSubmit={handleInstantAudit} className="flex gap-2">
                    <Input
                      id="quick-audit-url"
                      placeholder="siteniz.com"
                      value={quickAuditUrl}
                      onChange={(e) => setQuickAuditUrl(e.target.value)}
                      inputMode="url"
                      autoComplete="url"
                    />
                    <Button type="submit" variant="secondary" loading={quickAuditLoading} className="shrink-0">
                      {quickAuditLoading ? "Kontrol ediliyor" : "Kontrol et"}
                    </Button>
                  </form>
                  <p className="text-2xs text-muted">Ana sayfanızda başlık, meta açıklama, canonical, robots.txt ve site haritası kontrol edilir.</p>
                  {quickAuditResult && (
                    <div className="rounded-sm bg-surface border border-line text-xs mt-1 animate-fade-in" aria-live="polite">
                      <div className="p-2.5 flex items-center justify-between gap-2 border-b border-line">
                        <div className="min-w-0">
                          <div className="font-semibold text-ink truncate">{quickAuditResult.url.replace(/^https?:\/\//, "")}</div>
                          <div className="text-2xs text-muted">
                            {quickAuditResult.findings.length === 0
                              ? "Ana sayfada sorun bulunmadı."
                              : `${quickAuditResult.findings.length} bulgu${quickAuditResult.critical > 0 ? `, ${quickAuditResult.critical} kritik` : ""}`}
                          </div>
                        </div>
                        {quickAuditResult.score !== null && (
                          <div className="text-right shrink-0">
                            <div className="text-lg font-semibold tabular-nums text-ink leading-5">{quickAuditResult.score}</div>
                            <div className="text-2xs text-muted">/100 ana sayfa</div>
                          </div>
                        )}
                      </div>
                      {quickAuditResult.findings.length > 0 && (
                        <ul className="divide-y divide-line">
                          {quickAuditResult.findings.slice(0, 4).map((f, i) => (
                            <li key={i} className="p-2.5 flex items-start gap-2">
                              <SeverityBadge severity={f.severity} />
                              <span className="text-ink min-w-0">{f.title}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="p-2.5 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-2xs text-muted">
                          {quickAuditResult.findings.length > 4 ? `+${quickAuditResult.findings.length - 4} bulgu daha. ` : ""}Nasıl düzeltileceğini görmek ve tüm sayfaları taramak için ücretsiz hesap açın.
                        </span>
                        <Button size="sm" onClick={enterWithAuditedSite} icon={<ArrowRight className="w-3.5 h-3.5" aria-hidden />} className="shrink-0">
                          Ücretsiz hesap aç
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
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
        {process.env.NODE_ENV === "development" && devResetCode && (
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
