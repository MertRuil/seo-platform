"use client";

import React, { useEffect, useState } from "react";
import {
  CreditCard,
  Sparkles,
  Check,
  X as CloseIcon,
  ExternalLink,
  ShieldCheck,
  Layers,
  Zap,
  Coins,
  FileText,
  AlertCircle,
  Loader2,
  HelpCircle,
  RefreshCw,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import {
  api,
  PlanResponse,
  SubscriptionDetailsResponse,
  InvoiceResponse,
  OrganizationResponse,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { UpgradeModal } from "@/components/UpgradeModal";

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanResponse[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionDetailsResponse | null>(null);
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationResponse[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<string | null>(null);
  const [creditLoading, setCreditLoading] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Verileri yükle
  const loadData = async (orgId?: string) => {
    try {
      setLoading(true);
      setError(null);

      // Organizasyonları çek
      const orgs = await api.getOrganizations();
      setOrganizations(orgs);

      const activeOrgId = orgId || (orgs.length > 0 ? orgs[0].id : "");
      setSelectedOrgId(activeOrgId);

      // Planları çek
      const plansData = await api.getBillingPlans();
      setPlans(plansData);

      if (activeOrgId) {
        // Abonelik ve faturaları paralel çek
        const [subData, invData] = await Promise.all([
          api.getSubscription(activeOrgId).catch(() => null),
          api.getInvoices(activeOrgId).catch(() => []),
        ]);
        setSubscription(subData);
        setInvoices(invData || []);
      }
    } catch (err: any) {
      setError(err?.message || "Faturalama bilgileri yüklenirken bir hata oluştu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOrgChange = (newOrgId: string) => {
    setSelectedOrgId(newOrgId);
    loadData(newOrgId);
  };

  // Plan yükseltme / Checkout başlatma
  const handleSelectPlan = async (planCode: string) => {
    if (!selectedOrgId) return;
    if (subscription?.plan_code.toLowerCase() === planCode.toLowerCase()) return;

    setCheckoutLoadingPlan(planCode);
    setActionSuccess(null);
    try {
      const checkout = await api.createCheckoutSession(selectedOrgId, {
        plan_code: planCode,
        interval: billingInterval,
        return_url: window.location.href,
      });

      if (checkout?.checkout_url) {
        window.location.href = checkout.checkout_url;
      }
    } catch (err: any) {
      // Sandbox/Test fallback: doğrudan plan geçişi dene
      try {
        await api.switchPlan(selectedOrgId, planCode);
        setActionSuccess(`Planınız başarıyla ${planCode.toUpperCase()} olarak güncellendi!`);
        await loadData(selectedOrgId);
      } catch (switchErr: any) {
        setError(err?.message || "Ödeme oturumu başlatılamadı");
      }
    } finally {
      setCheckoutLoadingPlan(null);
    }
  };

  // Paddle Müşteri Portalı Açma
  const handleOpenPortal = async () => {
    if (!selectedOrgId) return;
    try {
      const portal = await api.getBillingPortal(selectedOrgId);
      if (portal?.portal_url) {
        window.open(portal.portal_url, "_blank");
      }
    } catch (err: any) {
      setError("Müşteri portalı açılamadı: " + (err?.message || "Bilinmeyen hata"));
    }
  };

  // Ek AI Kredisi Ekleme
  const handleGrantCredits = async (amount: number) => {
    if (!selectedOrgId) return;
    setCreditLoading(true);
    setActionSuccess(null);
    try {
      const res = await api.grantAiCredits(selectedOrgId, amount, "MANUAL_PURCHASE");
      setActionSuccess(`Hesabınıza +${amount} AI kredisi başarıyla tanımlandı!`);
      await loadData(selectedOrgId);
    } catch (err: any) {
      setError("Kredi yüklenirken hata: " + (err?.message || ""));
    } finally {
      setCreditLoading(false);
    }
  };

  if (loading && !subscription) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-muted">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-sm font-medium">Abonelik ve fatura verileri yükleniyor...</p>
      </div>
    );
  }

  const currentPlan = subscription?.plan_code.toLowerCase() || "free";

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Üst Bar / Başlık */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <div className="inline-flex items-center gap-2 text-2xs font-mono font-semibold uppercase tracking-wider text-accent mb-1">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Fatura & Plan Yönetimi</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Abonelik ve Kullanım Kotaları</h1>
          <p className="text-sm text-muted mt-1">
            Platform kullanım limitlerinizi takip edin, planınızı yükseltin ve faturalarınızı yönetin.
          </p>
        </div>

        {/* Organizasyon Seçici */}
        {organizations.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Organizasyon:</span>
            <select
              value={selectedOrgId}
              onChange={(e) => handleOrgChange(e.target.value)}
              className="bg-surface-2 border border-line text-ink text-xs rounded-sm px-2.5 py-1.5 focus:outline-hidden focus:border-accent"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Bildirimler */}
      {actionSuccess && (
        <div className="p-4 bg-accent-soft/50 border border-accent/40 rounded-sm text-xs text-accent-ink flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-accent shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-muted hover:text-ink cursor-pointer"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-critical-soft border border-critical/30 rounded-sm text-xs text-critical flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-muted hover:text-critical cursor-pointer"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. MEVCUT ABONELİK DURUM KARTI */}
      {subscription && (
        <div className="bg-surface border border-line rounded-md p-6 relative overflow-hidden shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-md bg-accent-soft text-accent-ink flex items-center justify-center font-bold text-lg shrink-0">
                {subscription.plan_name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-bold text-ink">{subscription.plan_name} Planı</h2>
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-2xs font-semibold tracking-wide uppercase",
                      subscription.status === "ACTIVE"
                        ? "bg-accent-soft text-accent-ink"
                        : "bg-warn-soft text-warn"
                    )}
                  >
                    {subscription.status === "ACTIVE" ? "Aktif" : subscription.status}
                  </span>
                  <span className="text-2xs text-muted font-mono uppercase bg-surface-2 px-2 py-0.5 rounded-sm border border-line">
                    Sağlayıcı: {subscription.provider}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {subscription.current_period_end
                      ? `Yenilenme: ${new Date(subscription.current_period_end).toLocaleDateString("tr-TR")}`
                      : "Süresiz / Yenilenme yok"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleOpenPortal}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-2 hover:bg-surface text-ink text-xs font-medium rounded-sm border border-line transition-colors cursor-pointer"
              >
                <span>Müşteri Portalı</span>
                <ExternalLink className="w-3.5 h-3.5 text-muted" />
              </button>
              {currentPlan === "free" && (
                <button
                  type="button"
                  onClick={() => setUpgradeModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent text-accent-ink hover:bg-accent-hover text-xs font-semibold rounded-sm transition-colors cursor-pointer shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Pro'ya Yükselt</span>
                </button>
              )}
            </div>
          </div>

          {/* Kota ve Kullanım Göstergeleri Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
            {/* Sayfa Taraması */}
            {subscription.usages["pages_crawled"] && (
              <UsageMetricCard
                title="Taranan Sayfalar"
                icon={Layers}
                used={subscription.usages["pages_crawled"].used}
                limit={subscription.usages["pages_crawled"].limit}
                unit="sayfa"
              />
            )}

            {/* AI Kredisi */}
            <div className="bg-surface-2 border border-line rounded-sm p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-muted text-xs mb-2">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Coins className="w-3.5 h-3.5 text-accent" /> AI Kredi Bakiyesi
                  </span>
                  <button
                    type="button"
                    onClick={() => handleGrantCredits(100)}
                    disabled={creditLoading}
                    className="text-2xs text-accent hover:underline font-semibold cursor-pointer disabled:opacity-50"
                  >
                    +100 Ekle
                  </button>
                </div>
                <div className="text-xl font-bold font-mono text-ink">
                  {subscription.ai_credit_balance.toLocaleString("tr-TR")}
                  <span className="text-xs text-muted font-normal ml-1">kredi</span>
                </div>
              </div>
              <div className="text-2xs text-muted mt-3">
                Denetim, öneri ve roadmap üretimi için kullanılır.
              </div>
            </div>

            {/* Otomatik Düzeltmeler */}
            {subscription.usages["auto_fixes"] && (
              <UsageMetricCard
                title="Otomatik Düzeltmeler"
                icon={Zap}
                used={subscription.usages["auto_fixes"].used}
                limit={subscription.usages["auto_fixes"].limit}
                unit="işlem"
                locked={!subscription.features["auto_fixes"]}
              />
            )}

            {/* Siteler */}
            {subscription.usages["sites"] && (
              <UsageMetricCard
                title="Bağlı Siteler"
                icon={ShieldCheck}
                used={subscription.usages["sites"].used}
                limit={subscription.usages["sites"].limit}
                unit="site"
              />
            )}
          </div>
        </div>
      )}

      {/* 2. FİYATLANDIRMA VE PLAN KARŞILAŞTIRMA SEÇİCİSİ */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-ink">Tüm Planlar ve Özellikler</h2>
            <p className="text-xs text-muted mt-0.5">
              İhtiyacınıza en uygun paketi seçin, dilediğiniz an yükseltin veya düşürün.
            </p>
          </div>

          {/* Aylık / Yıllık Toggle */}
          <div className="inline-flex items-center bg-surface-2 p-1 rounded-sm border border-line self-start">
            <button
              type="button"
              onClick={() => setBillingInterval("month")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-sm transition-colors cursor-pointer",
                billingInterval === "month"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-muted hover:text-ink"
              )}
            >
              Aylık Fatura
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval("year")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-sm transition-colors flex items-center gap-1.5 cursor-pointer",
                billingInterval === "year"
                  ? "bg-surface text-ink shadow-xs"
                  : "text-muted hover:text-ink"
              )}
            >
              <span>Yıllık Fatura</span>
              <span className="bg-accent-soft text-accent-ink text-2xs px-1.5 py-0.2 rounded-full font-bold">
                %20 Tasarruf
              </span>
            </button>
          </div>
        </div>

        {/* Plan Kartları Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.code.toLowerCase();
            const isPro = plan.code.toLowerCase() === "pro";
            const priceObj = plan.prices.find((p) => p.interval === billingInterval) || plan.prices[0];
            const amountFormatted = priceObj ? priceObj.amount_formatted : "$0";

            return (
              <div
                key={plan.id}
                className={cn(
                  "bg-surface border rounded-md p-5 flex flex-col justify-between transition-all relative",
                  isPro
                    ? "border-accent shadow-[0_0_20px_-8px_var(--accent)] ring-1 ring-accent"
                    : "border-line",
                  isCurrent && "bg-surface-2/40"
                )}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-ink text-2xs font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs">
                    En Popüler
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-ink">{plan.name}</h3>
                    {isCurrent && (
                      <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-accent-soft text-accent-ink">
                        Mevcut
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-muted min-h-[32px] leading-relaxed">
                    {plan.description}
                  </p>

                  {/* Fiyat Bilgisi */}
                  <div className="my-4 pb-4 border-b border-line">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold font-mono text-ink tracking-tight">
                        {amountFormatted.split(" ")[0]}
                      </span>
                      <span className="text-xs text-muted">
                        / {billingInterval === "year" ? "yıl" : "ay"}
                      </span>
                    </div>
                    {billingInterval === "year" && priceObj?.amount_minor > 0 && (
                      <span className="text-2xs text-accent mt-0.5 block">
                        Aylık ${(priceObj.amount_minor / 1200).toFixed(0)} denk gelir
                      </span>
                    )}
                  </div>

                  {/* Limitler & Özellikler */}
                  <div className="space-y-2.5 text-xs">
                    <div className="text-2xs font-mono font-semibold uppercase tracking-wider text-muted">
                      Kapasite & Kotalar
                    </div>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-ink">
                        <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span>
                          <strong>{plan.limits["pages_crawled"]?.toLocaleString("tr-TR")}</strong> Sayfa / Ay
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-ink">
                        <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span>
                          <strong>{plan.limits["ai_credits"]?.toLocaleString("tr-TR")}</strong> AI Kredisi
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-ink">
                        <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span>
                          <strong>{plan.limits["sites"] || 1}</strong> Aktif Site
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-ink">
                        {plan.features["auto_fixes"] ? (
                          <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                        ) : (
                          <CloseIcon className="w-3.5 h-3.5 text-faint shrink-0" />
                        )}
                        <span className={!plan.features["auto_fixes"] ? "text-muted" : ""}>
                          Otomatik Düzeltme (Auto-Fix)
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-ink">
                        {plan.features["js_render"] ? (
                          <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                        ) : (
                          <CloseIcon className="w-3.5 h-3.5 text-faint shrink-0" />
                        )}
                        <span className={!plan.features["js_render"] ? "text-muted" : ""}>
                          JS Render (SPA / React)
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-ink">
                        {plan.features["experiments"] ? (
                          <Check className="w-3.5 h-3.5 text-accent shrink-0" />
                        ) : (
                          <CloseIcon className="w-3.5 h-3.5 text-faint shrink-0" />
                        )}
                        <span className={!plan.features["experiments"] ? "text-muted" : ""}>
                          SEO Deneyleri (Causal Impact)
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Eylem Butonu */}
                <div className="pt-6 mt-4 border-t border-line">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 px-3 text-xs font-semibold rounded-sm bg-surface-2 text-muted cursor-default text-center border border-line"
                    >
                      Mevcut Planınız
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSelectPlan(plan.code)}
                      disabled={checkoutLoadingPlan === plan.code}
                      className={cn(
                        "w-full py-2 px-3 text-xs font-semibold rounded-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50",
                        isPro
                          ? "bg-accent text-accent-ink hover:bg-accent-hover"
                          : "bg-surface-2 text-ink hover:bg-surface border border-line"
                      )}
                    >
                      {checkoutLoadingPlan === plan.code ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Yönlendiriliyor...</span>
                        </>
                      ) : (
                        <>
                          <span>{plan.code === "free" ? "Free Plana Geç" : `${plan.name} Seç`}</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. EK KREDİ PAKETLERİ (ADDONS) */}
      <div className="bg-surface border border-line rounded-md p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <Coins className="w-4 h-4 text-accent" /> Ek AI Kredisi Yükle
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Planınızı değiştirmeden anlık büyük denetimler veya otonom aksiyonlar için kredi satın alın.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-4 bg-surface-2 border border-line rounded-sm flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-ink">+100 AI Kredisi</div>
              <div className="text-xs text-muted">Hızlı denetimler için</div>
              <div className="text-base font-mono font-bold text-ink mt-1">$15</div>
            </div>
            <button
              type="button"
              onClick={() => handleGrantCredits(100)}
              disabled={creditLoading}
              className="px-3 py-1.5 bg-accent text-accent-ink hover:bg-accent-hover text-xs font-semibold rounded-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              Yükle
            </button>
          </div>

          <div className="p-4 bg-surface-2 border border-line rounded-sm flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-ink">+500 AI Kredisi</div>
              <div className="text-xs text-muted">Büyük siteler ve toplu patch'ler için</div>
              <div className="text-base font-mono font-bold text-ink mt-1">$50</div>
            </div>
            <button
              type="button"
              onClick={() => handleGrantCredits(500)}
              disabled={creditLoading}
              className="px-3 py-1.5 bg-accent text-accent-ink hover:bg-accent-hover text-xs font-semibold rounded-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              Yükle
            </button>
          </div>

          <div className="p-4 bg-surface-2 border border-line rounded-sm flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-ink">+2.000 AI Kredisi</div>
              <div className="text-xs text-muted">Ajans ve kurumsal yoğun kullanım</div>
              <div className="text-base font-mono font-bold text-ink mt-1">$150</div>
            </div>
            <button
              type="button"
              onClick={() => handleGrantCredits(2000)}
              disabled={creditLoading}
              className="px-3 py-1.5 bg-accent text-accent-ink hover:bg-accent-hover text-xs font-semibold rounded-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              Yükle
            </button>
          </div>
        </div>
      </div>

      {/* 4. FATURA GEÇMİŞİ TABLOSU */}
      <div className="bg-surface border border-line rounded-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-ink flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" /> Fatura Geçmişi
            </h3>
            <p className="text-xs text-muted mt-0.5">
              Paddle tarafından düzenlenen resmi e-fatura ve makbuzlarınız.
            </p>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted border border-dashed border-line rounded-sm">
            Henüz oluşturulmuş bir fatura bulunmuyor. Plan yükseltmesi yaptığınızda faturalarınız burada listelenecektir.
          </div>
        ) : (
          <div className="overflow-x-auto border border-line rounded-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 text-muted border-b border-line font-mono text-2xs uppercase">
                <tr>
                  <th className="py-2.5 px-4">Fatura No</th>
                  <th className="py-2.5 px-4">Tarih</th>
                  <th className="py-2.5 px-4">Tutar</th>
                  <th className="py-2.5 px-4">Durum</th>
                  <th className="py-2.5 px-4 text-right">İndir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-ink">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-2/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium">{inv.number || inv.id.slice(0, 8)}</td>
                    <td className="py-3 px-4 text-muted">
                      {inv.issued_at ? new Date(inv.issued_at).toLocaleDateString("tr-TR") : "-"}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">{inv.total_formatted}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-accent-soft text-accent-ink">
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {inv.pdf_url ? (
                        <a
                          href={inv.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-accent hover:underline font-medium"
                        >
                          <span>PDF</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. SIKÇA SORULAN SORULAR */}
      <div className="bg-surface border border-line rounded-md p-6 space-y-4">
        <h3 className="text-base font-bold text-ink flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-accent" /> Sıkça Sorulan Sorular
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted leading-relaxed">
          <div className="p-3 bg-surface-2 rounded-sm">
            <h4 className="font-semibold text-ink mb-1">Aboneliğimi ne zaman iptal edebilirim?</h4>
            <p>
              İstediğiniz zaman Müşteri Portalı üzerinden tek tıkla iptal edebilirsiniz. İptal durumunda mevcut fatura döneminizin sonuna kadar haklarınız aktif kalır.
            </p>
          </div>
          <div className="p-3 bg-surface-2 rounded-sm">
            <h4 className="font-semibold text-ink mb-1">Ödemeler güvenli mi?</h4>
            <p>
              Tüm ödemeler Merchant of Record (MoR) olan küresel ödeme altyapısı Paddle güvencesiyle ve PCI-DSS Seviye 1 standartlarında işlenir. Kart bilgileriniz sunucularımızda saklanmaz.
            </p>
          </div>
          <div className="p-3 bg-surface-2 rounded-sm">
            <h4 className="font-semibold text-ink mb-1">Aylık tarama kotam biterse ne olur?</h4>
            <p>
              Taramalar durur ancak mevcut verileriniz ve raporlarınız korunur. Dilerseniz bir üst plana geçebilir veya ek sayfa paketi tanımlayabilirsiniz.
            </p>
          </div>
          <div className="p-3 bg-surface-2 rounded-sm">
            <h4 className="font-semibold text-ink mb-1">Otomatik Düzeltme (Auto-Fix) nasıl çalışır?</h4>
            <p>
              Sistem WordPress, GitHub veya Shopify bağlayıcınız üzerinden risk seviyesi düşük SEO düzeltmelerini tek tıkla doğrudan sitenize uygular ve her an geri alabilme garantisi sunar.
            </p>
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        orgId={selectedOrgId}
        targetPlanCode="pro"
      />
    </div>
  );
}

// Yardımcı Kota Kartı Bileşeni
function UsageMetricCard({
  title,
  icon: Icon,
  used,
  limit,
  unit,
  locked = false,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  used: number;
  limit: number;
  unit: string;
  locked?: boolean;
}) {
  const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isHigh = percentage >= 85;

  return (
    <div className="bg-surface-2 border border-line rounded-sm p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between text-muted text-xs mb-2">
          <span className="flex items-center gap-1.5 font-medium">
            <Icon className="w-3.5 h-3.5 text-accent" /> {title}
          </span>
          {locked ? (
            <span className="text-2xs font-semibold px-1.5 py-0.2 bg-surface text-muted rounded-sm border border-line">
              Kilitli
            </span>
          ) : (
            <span className="text-2xs font-mono text-muted">{percentage}%</span>
          )}
        </div>

        <div className="text-xl font-bold font-mono text-ink">
          {used.toLocaleString("tr-TR")}
          <span className="text-xs text-muted font-normal ml-1">
            / {limit > 0 ? limit.toLocaleString("tr-TR") : "—"} {unit}
          </span>
        </div>
      </div>

      {/* İlerleme Çubuğu */}
      <div className="mt-3">
        <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              locked ? "bg-muted" : isHigh ? "bg-warn" : "bg-accent"
            )}
            style={{ width: `${locked ? 0 : percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
