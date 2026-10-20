"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sliders,
  CheckCircle2,
  Shield,
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  AlertCircle,
  Globe,
  TrendingUp,
  BarChart3,
  Bell,
  Send,
  Zap,
  Radio,
  ExternalLink,
  Sparkles,
  Check,
  AlertTriangle
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSite } from "@/context/SiteContext";
import { useSiteData, type LiveContext } from "@/hooks/useSiteData";
import { DEMO_CONNECTORS, type ConnectorItem } from "@/lib/demo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, Inset } from "@/components/ui/Panel";
import { Button, IconButton } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Notice } from "@/components/ui/States";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";

interface ExtendedConnectorItem extends ConnectorItem {
  capabilities?: string[];
}

interface GscStats {
  clicks: number;
  impressions: number;
  ctrPercent: number;
  avgPosition: number;
  queryCount: number;
  property: string | null;
}

type AlertChannelType = "SLACK" | "DISCORD" | "TELEGRAM" | "WEBHOOK";

const ALERT_CHANNEL_FIELDS: Record<AlertChannelType, { target: string; targetPlaceholder: string; secret?: string }> = {
  SLACK: { target: "Slack webhook URL", targetPlaceholder: "https://hooks.slack.com/services/..." },
  DISCORD: { target: "Discord webhook URL", targetPlaceholder: "https://discord.com/api/webhooks/..." },
  TELEGRAM: { target: "Chat ID", targetPlaceholder: "-1001234567890", secret: "Bot token" },
  WEBHOOK: { target: "Webhook URL", targetPlaceholder: "https://api.sirket.com/seo-events", secret: "HMAC-SHA256 gizli anahtarı" },
};

export default function BaglayicilarPage() {
  const { user } = useAuth();
  const { org, site } = useSite();
  const isAdmin = Boolean(
    user &&
      (user.isAdmin ||
        user.isSuperAdmin ||
        user.role === "OWNER" ||
        user.role === "ADMIN" ||
        user.role === "Süper Yönetici" ||
        user.role === "SEO Yöneticisi")
  );

  const [activeTab, setActiveTab] = useState<"google" | "connectors" | "alerts">("google");

  // Google Sync States & Real Health Tracking
  const [googleIntegrationStatus, setGoogleIntegrationStatus] = useState<"HEALTHY" | "AUTH_FAILED" | "DISCONNECTED">("DISCONNECTED");
  const [googleStatusDetail, setGoogleStatusDetail] = useState<string>("Google Search Console veya GA4 henüz bağlanmadı.");
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [googleLastSync, setGoogleLastSync] = useState("Henüz eşitlenmedi");
  const [gscStats, setGscStats] = useState<GscStats | null>(null);

  // Alarm kanalları sunucuda saklanmıyor; form yalnızca bir test bildirimi gönderir.
  const [alertChannel, setAlertChannel] = useState<AlertChannelType>("SLACK");
  const [alertTarget, setAlertTarget] = useState("");
  const [alertSecret, setAlertSecret] = useState("");
  const [testingAlert, setTestingAlert] = useState(false);

  const fetchConnectors = async (ctx: LiveContext): Promise<ExtendedConnectorItem[]> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("seo_auth_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`/api/v1/organizations/${ctx.org.id}/sites/${ctx.site.id}/connectors`, {
      headers,
    });
    if (!res.ok) {
      return DEMO_CONNECTORS;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return DEMO_CONNECTORS;
    }

    return data.map((d: any) => {
      const typeName =
        d.connector_type === "WORDPRESS_REST" ? "WordPress REST" :
        d.connector_type === "GENERIC_WEBHOOK" ? "Kurumsal webhook" :
        d.connector_type === "GIT_PR" ? "Git / GitHub PR" :
        d.connector_type === "CLOUDFLARE_WORKER" ? "Cloudflare Worker" :
        d.connector_type === "GOOGLE_SEARCH_CONSOLE" ? "Google Search Console" : (d.ad || d.connector_type || "Bağlayıcı");

      const isVerified = Boolean(d.is_verified || d.durum === "Bağlandı");
      const hasEndpoint = Boolean(d.base_url || d.endpoint);

      let durum: ConnectorItem["durum"] = "Test Edilmedi";
      let aciklama = "Bağlantı henüz test edilmedi. Canlı bağlantıyı doğrulamak için lütfen 'Bağlantıyı test et' butonuna tıklayın.";

      if (isVerified) {
        durum = "Bağlandı";
        aciklama = d.capabilities?.length ? `${d.capabilities.length} yetenek aktif: ${d.capabilities.join(", ")}` : "Bağlantı başarıyla doğrulandı.";
      } else if (!hasEndpoint) {
        durum = "Yapılandırılmadı";
        aciklama = "Uç nokta henüz yapılandırılmadı. Ayarları düzenleyerek adres belirleyebilirsiniz.";
      }

      return {
        id: d.id,
        ad: typeName,
        tur: d.connector_type || d.tur,
        durum,
        aciklama,
        endpoint: d.base_url || d.endpoint || "",
        tokenMasked: d.token_masked || d.tokenMasked || "••••••••••••",
        capabilities: d.capabilities || [],
      };
    });
  };

  const demo = useSiteData<ExtendedConnectorItem[]>("connectors", fetchConnectors, DEMO_CONNECTORS, { requires: "site" });

  const [list, setList] = useState<ExtendedConnectorItem[]>(DEMO_CONNECTORS);
  const [editing, setEditing] = useState<ExtendedConnectorItem | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // Yeni bağlayıcı modalı
  const [addOpen, setAddOpen] = useState(false);
  const [newType, setNewType] = useState("WORDPRESS_REST");
  const [newEndpoint, setNewEndpoint] = useState("");
  const [newSecret, setNewSecret] = useState("");
  useEffect(() => {
    if (demo.data && demo.data.length > 0) {
      setList(demo.data);
    }
  }, [demo.data]);

  const loadGoogleStatus = useCallback(async () => {
    const orgId = site?.organization_id || org?.id;
    const siteId = site?.id;
    if (!orgId || !siteId) {
      setGoogleIntegrationStatus("DISCONNECTED");
      setGscStats(null);
      return;
    }
    const token = typeof window !== "undefined" ? localStorage.getItem("seo_auth_token") : null;
    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/sites/${siteId}/integrations/google/status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        setGoogleIntegrationStatus("DISCONNECTED");
        setGoogleStatusDetail(`Google bağlantı durumu alınamadı (HTTP ${res.status}).`);
        setGscStats(null);
        return;
      }
      const data = await res.json();
      if (data.connected && data.status === "CONNECTED") {
        setGoogleIntegrationStatus("HEALTHY");
        setGoogleLastSync(data.last_synced_at ? new Date(data.last_synced_at).toLocaleDateString("tr-TR") : "Henüz eşitlenmedi");
        setGscStats({
          clicks: data.gsc?.total_clicks ?? 0,
          impressions: data.gsc?.total_impressions ?? 0,
          ctrPercent: data.gsc?.avg_ctr_percent ?? 0,
          avgPosition: data.gsc?.avg_position ?? 0,
          queryCount: data.gsc?.top_queries_count ?? 0,
          property: data.gsc?.property ?? null,
        });
        setGoogleStatusDetail("Search Console bağlı.");
      } else {
        setGoogleIntegrationStatus(data.status === "AUTH_FAILED" ? "AUTH_FAILED" : "DISCONNECTED");
        setGoogleStatusDetail(data.error_message || "Google Search Console hesabı bağlanmadı.");
        setGscStats(null);
      }
    } catch {
      setGoogleIntegrationStatus("DISCONNECTED");
      setGoogleStatusDetail("Google bağlantı durumu alınamadı.");
      setGscStats(null);
    }
  }, [site?.organization_id, site?.id, org?.id]);

  useEffect(() => {
    loadGoogleStatus();
  }, [loadGoogleStatus]);

  const handleManualGoogleSync = async () => {
    setSyncingGoogle(true);
    setNotice(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("seo_auth_token") : null;
      const orgId = site?.organization_id || org?.id;
      const siteId = site?.id;
      if (!orgId || !siteId) {
        setNotice({ tone: "error", text: "Eşitleme için arka uçta kayıtlı bir site seçili olmalı." });
        return;
      }

      const res = await fetch(`/api/v1/organizations/${orgId}/sites/${siteId}/integrations/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        // If HTTP 401 or 403: this is an APP session expiry or user permission error (e.g. VIEWER role), NOT a Google OAuth failure!
        if (res.status === 401) {
          setNotice({
            tone: "error",
            text: `⚠️ Oturum Hatası (HTTP 401): ${errData.detail || "Oturum süreniz dolmuş. Lütfen sayfayı yenileyip tekrar giriş yapın."}`
          });
          return;
        }
        if (res.status === 403) {
          setNotice({
            tone: "error",
            text: `🔒 Yetki Hatası (HTTP 403): ${errData.detail || "Google senkronizasyonunu çalıştırmak için Yönetici veya SEO Yöneticisi rolü gereklidir."}`
          });
          return;
        }

        setNotice({
          tone: "error",
          text: `❌ Senkronizasyon İsteği Başarısız (HTTP ${res.status}): ${errData.detail || errData.message || "Sunucu hatası oluştu."}`
        });
        return;
      }

      const data = await res.json();
      if (!data.success) {
        setGoogleIntegrationStatus(data.status === "DISCONNECTED" ? "DISCONNECTED" : "AUTH_FAILED");
        setGscStats(null);
        setGoogleStatusDetail(data.message);
        setNotice({
          tone: "error",
          text: `❌ Google Bağlantısı Başarısız: ${data.message} Arama ve dönüşüm verileri güncellenemedi.`
        });
        return;
      }

      await loadGoogleStatus();
      setNotice({
        tone: "success",
        text: `🟢 ${data.message || "Google Search Console ve GA4 verileri başarıyla eşitlendi."}`
      });
    } catch (e: any) {
      setNotice({
        tone: "error",
        text: `❌ Bağlantı Hatası: Sunucuya ulaşılamadı (${e?.message || "Ağ veya bağlantı hatası"}).`
      });
    } finally {
      setSyncingGoogle(false);
    }
  };

  const handleConnectGoogle = async () => {
    setNotice(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("seo_auth_token") : null;
      const orgId = site?.organization_id || org?.id || "demo-org";
      const siteId = site?.id || "demo-site";
      const res = await fetch(`/api/v1/organizations/${orgId}/sites/${siteId}/integrations/google/authorize`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data.auth_url) {
          window.location.href = data.auth_url;
          return;
        }
      }
      setNotice({ tone: "error", text: "Google OAuth yetkilendirme bağlantısı oluşturulamadı." });
    } catch {
      setNotice({ tone: "error", text: "Google OAuth sunucusuna bağlanılamadı." });
    }
  };

  const handleTestAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const orgId = site?.organization_id || org?.id;
    if (!orgId || !site?.id) {
      setNotice({ tone: "error", text: "Test bildirimi için arka uçta kayıtlı bir site seçili olmalı." });
      return;
    }
    setTestingAlert(true);
    setNotice(null);
    try {
      const res = await api.sendTestAlert(orgId, site.id, {
        channel: alertChannel,
        target: alertTarget.trim(),
        secret: alertSecret.trim() || undefined,
      });
      setNotice({
        tone: res.success ? "success" : "error",
        text: res.success ? `${res.message} (HTTP ${res.status_code})` : `Bildirim gönderilemedi: ${res.message}`,
      });
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof Error ? err.message : "Test bildirimi gönderilemedi." });
    } finally {
      setTestingAlert(false);
    }
  };

  const openEdit = (c: ExtendedConnectorItem) => {
    setEditing(c);
    setEndpoint(c.endpoint);
    setSecret("");
    setShowSecret(false);
    setNotice(null);
  };

  const handleTest = async (c: ExtendedConnectorItem) => {
    setTesting(c.id);
    setNotice(null);

    const token = typeof window !== "undefined" ? localStorage.getItem("seo_auth_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const orgId = org?.id || "org_acme_default";
    const siteId = site?.id || "site_demo_flagship";

    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/sites/${siteId}/connectors/test`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          connector_id: c.id,
          connector_type: c.tur,
          base_url: c.endpoint,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setNotice({
          tone: "success",
          text: `🟢 ${c.ad}: ${data.message || "Bağlantı ve kimlik doğrulama başarılı!"}`,
        });
        setList((prev) =>
          prev.map((item) =>
            item.id === c.id
              ? {
                  ...item,
                  durum: "Bağlandı",
                  aciklama: data.capabilities?.length
                    ? `${data.capabilities.length} yetenek aktif: ${data.capabilities.join(", ")}`
                    : "Bağlantı başarıyla doğrulandı.",
                }
              : item
          )
        );
      } else {
        setNotice({
          tone: "error",
          text: `🔴 ${c.ad}: ${data.message || "Bağlantı doğrulanamadı. Lütfen uç nokta adresini ve anahtarları kontrol edin."}`,
        });
        setList((prev) =>
          prev.map((item) =>
            item.id === c.id
              ? {
                  ...item,
                  durum: "Bağlantı Başarısız",
                  aciklama: data.message || "Bağlantı doğrulanamadı.",
                }
              : item
          )
        );
      }
    } catch (err: any) {
      setNotice({
        tone: "error",
        text: `🔴 ${c.ad} test hatası: ${err.message || "Ağ hatası oluştu."}`,
      });
      setList((prev) =>
        prev.map((item) =>
          item.id === c.id
            ? {
                ...item,
                durum: "Bağlantı Başarısız",
                aciklama: "Bağlantı testi sırasında ağ hatası oluştu.",
              }
            : item
        )
      );
    } finally {
      setTesting(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setNotice(null);

    const token = typeof window !== "undefined" ? localStorage.getItem("seo_auth_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const orgId = org?.id || "org_acme_default";
    const siteId = site?.id || "site_demo_flagship";

    const creds: Record<string, string> = {};
    if (secret) {
      if (editing.tur === "WORDPRESS_REST") {
        creds.username = "admin";
        creds.app_password = secret;
      } else if (editing.tur === "GENERIC_WEBHOOK") {
        creds.secret_key = secret;
      } else if (editing.tur === "GIT_PR") {
        creds.access_token = secret;
      } else if (editing.tur === "CLOUDFLARE_WORKER") {
        creds.api_token = secret;
      }
    }

    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/sites/${siteId}/connectors`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: editing.id,
          connector_type: editing.tur,
          base_url: endpoint,
          credentials: creds,
          is_active: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Bağlayıcı kaydedilemedi");
      }

      setList((prev) =>
        prev.map((c) =>
          c.id === editing.id
            ? {
                ...c,
                endpoint,
                tokenMasked: secret ? `${secret.slice(0, 4)}••••••••••••` : c.tokenMasked,
                durum: "Test Edilmedi",
                aciklama: "Ayarlar güncellendi (Henüz test edilmedi). Lütfen 'Bağlantıyı test et' butonuna tıklayarak doğrulayın.",
              }
            : c
        )
      );
      setNotice({
        tone: "success",
        text: `"${editing.ad}" ayarları kaydedildi. Canlı bağlantıyı kurmak için lütfen 'Bağlantıyı test et' butonuna tıklayın.`,
      });
      setEditing(null);
    } catch (err: any) {
      setNotice({ tone: "error", text: `Kaydetme hatası: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setNotice(null);

    const token = typeof window !== "undefined" ? localStorage.getItem("seo_auth_token") : null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const orgId = org?.id || "org_acme_default";
    const siteId = site?.id || "site_demo_flagship";

    const creds: Record<string, string> = {};
    if (newSecret) {
      if (newType === "WORDPRESS_REST") {
        creds.username = "admin";
        creds.app_password = newSecret;
      } else if (newType === "GENERIC_WEBHOOK") {
        creds.secret_key = newSecret;
      } else if (newType === "GIT_PR") {
        creds.access_token = newSecret;
      } else if (newType === "CLOUDFLARE_WORKER") {
        creds.api_token = newSecret;
      }
    }

    try {
      const res = await fetch(`/api/v1/organizations/${orgId}/sites/${siteId}/connectors`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          connector_type: newType,
          base_url: newEndpoint,
          credentials: creds,
          is_active: true,
        }),
      });

      const data = await res.json().catch(() => ({}));

      const newAd =
        newType === "WORDPRESS_REST" ? "WordPress REST" :
        newType === "GENERIC_WEBHOOK" ? "Kurumsal webhook" :
        newType === "GIT_PR" ? "Git / GitHub PR" :
        newType === "CLOUDFLARE_WORKER" ? "Cloudflare Worker" : newType;

      const createdItem: ExtendedConnectorItem = {
        id: data.id || `conn_${Date.now()}`,
        ad: newAd,
        tur: newType,
        durum: "Test Edilmedi",
        aciklama: "Yeni bağlayıcı kaydedildi (Henüz test edilmedi).",
        endpoint: newEndpoint,
        tokenMasked: newSecret ? `${newSecret.slice(0, 4)}••••••••` : "••••••••••••",
        capabilities: [],
      };

      setList((prev) => [...prev, createdItem]);
      setNotice({
        tone: "success",
        text: `Yeni bağlayıcı "${newAd}" başarıyla eklendi. Canlı bağlantıyı kurmak için lütfen 'Bağlantıyı test et' butonuna tıklayın.`,
      });
      setAddOpen(false);
      setNewEndpoint("");
      setNewSecret("");
    } catch (err: any) {
      setNotice({ tone: "error", text: `Bağlayıcı eklenirken hata: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      <DemoBanner source={demo.source} reason={demo.reason} />
      <PageHeader
        icon={<Sliders className="w-5 h-5 text-accent-ink" />}
        title="Entegrasyonlar & Bağlayıcılar Hub'ı"
        description="Google Search Console, Google Analytics 4 (GA4), CMS yayıncıları ve anlık alarm kanallarını (Slack, Telegram, Discord) tek merkezden yönetin."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="accent">
              <Shield className="w-3 h-3" aria-hidden /> Yönetici Yetkisi
            </Badge>
            {activeTab === "connectors" && (
              <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setAddOpen(true)}>
                Yeni Bağlayıcı Ekle
              </Button>
            )}
          </div>
        }
      />

      {notice && (
        <Notice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-line pb-3">
        <button
          onClick={() => setActiveTab("google")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "google"
              ? "bg-accent-surface text-accent-ink border border-accent/30 shadow-xs"
              : "text-muted hover:text-ink hover:bg-surface"
          }`}
        >
          <Globe className="w-4 h-4" />
          Google Hub (GSC + GA4)
          <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </button>
        <button
          onClick={() => setActiveTab("connectors")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "connectors"
              ? "bg-accent-surface text-accent-ink border border-accent/30 shadow-xs"
              : "text-muted hover:text-ink hover:bg-surface"
          }`}
        >
          <Sliders className="w-4 h-4" />
          Dağıtım Bağlayıcıları (CMS)
          <span className="text-xs px-1.5 py-0.5 rounded bg-surface border border-line text-muted">{list.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("alerts")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === "alerts"
              ? "bg-accent-surface text-accent-ink border border-accent/30 shadow-xs"
              : "text-muted hover:text-ink hover:bg-surface"
          }`}
        >
          <Bell className="w-4 h-4" />
          Anlık Alarm Kanalları
        </button>
      </div>

      {/* TAB 1: GOOGLE HUB (GSC & GA4) */}
      {activeTab === "google" && (
        <div className="space-y-6">
          {/* Prominent Warning Banners for Broken / Disconnected Integration */}
          {googleIntegrationStatus === "AUTH_FAILED" && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-900/50 border border-red-700/50 flex items-center justify-center shrink-0 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-red-200">Google Entegrasyonu Bozuk — Veri Akışı Durdu!</h4>
                  <p className="text-xs text-red-300/80 mt-0.5">
                    Google Search Console veya GA4 yetkilendirme anahtarının (OAuth Token) süresi dolmuş veya erişim yetkisi kaldırılmış. Organik tıklama, gösterim ve dönüşüm verileri güncellenemiyor.
                  </p>
                  <span className="inline-block mt-1 font-mono text-2xs text-red-300 bg-red-900/40 px-2 py-0.5 rounded border border-red-800/40">
                    Durum: {googleStatusDetail}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="primary" onClick={handleConnectGoogle} className="bg-red-600 hover:bg-red-500 text-white font-semibold">
                  OAuth ile Yeniden Yetkilendir
                </Button>
              </div>
            </div>
          )}

          {googleIntegrationStatus === "DISCONNECTED" && (
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-900/50 border border-amber-700/50 flex items-center justify-center shrink-0 text-amber-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-amber-200">Google Search Console & GA4 Bağlantısı Yapılandırılmadı</h4>
                  <p className="text-xs text-amber-300/80 mt-0.5">
                    Bu site için henüz Google Search Console veya Google Analytics 4 hesabı bağlanmamış. Gerçek arama performansı ve organik dönüşümleri izlemek için hesabınızı bağlayın.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="primary" onClick={handleConnectGoogle} className="bg-amber-600 hover:bg-amber-500 text-white font-semibold">
                  Google Hesabını Bağla (OAuth)
                </Button>
              </div>
            </div>
          )}

          {/* Top Metric Strip for Google Live Data */}
          <MetricStrip
            items={[
              {
                label: "GSC Organik Tıklamalar",
                value: gscStats ? formatNumber(gscStats.clicks) : "—",
                tone: googleIntegrationStatus === "HEALTHY" ? "evidence" : googleIntegrationStatus === "AUTH_FAILED" ? "critical" : "warn",
                hint: googleIntegrationStatus === "HEALTHY" ? "Son eşitleme günü" : googleIntegrationStatus === "AUTH_FAILED" ? "Bağlantı Hatası: Veri Yok" : "Bağlantı Bekleniyor",
              },
              {
                label: "GSC Gösterim",
                value: gscStats ? formatNumber(gscStats.impressions) : "—",
                tone: gscStats ? "evidence" : "muted",
                hint: gscStats ? "Son eşitleme günü" : "Erişim İzni Yok",
              },
              {
                label: "GSC Ortalama CTR",
                value: gscStats ? `%${formatNumber(gscStats.ctrPercent, 2)}` : "—",
                tone: gscStats ? "evidence" : "muted",
                hint: gscStats ? "Tıklama / gösterim" : "Erişim İzni Yok",
              },
              {
                label: "GA4",
                value: "—",
                tone: "muted",
                hint: "GA4 mülkü yapılandırılmadı",
              },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Google Search Console Card */}
            <Panel
              title="Google Search Console (GSC)"
              sub="Arama talebi, indeksleme, organik kelime sıralamaları ve tıklama verileri."
              actions={
                googleIntegrationStatus === "HEALTHY" ? (
                  <Badge tone="evidence">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Bağlı & Doğrulandı
                  </Badge>
                ) : googleIntegrationStatus === "AUTH_FAILED" ? (
                  <Badge tone="critical">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Bağlantı Hatası (Token Süresi Doldu)
                  </Badge>
                ) : (
                  <Badge tone="warn">
                    <AlertCircle className="w-3 h-3 mr-1" /> Yapılandırılmadı
                  </Badge>
                )
              }
            >
              <div className="space-y-4 text-sm">
                <Inset className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Özellik Adresi:</span>
                    <span className="text-ink font-semibold">{gscStats?.property || (site?.domain ? `sc-domain:${site.domain}` : "—")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Protokol / İzin:</span>
                    {googleIntegrationStatus === "HEALTHY" ? (
                      <span className="text-emerald-400 font-semibold">OAuth 2.0 (Google Search Console API)</span>
                    ) : googleIntegrationStatus === "AUTH_FAILED" ? (
                      <span className="text-red-400 font-semibold">❌ Yetkisiz (HTTP 401 / Token Süresi Doldu)</span>
                    ) : (
                      <span className="text-amber-400 font-semibold">⚠️ Yetki Verilmedi</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">İzlenen Sorgu Sayısı:</span>
                    <span className="text-ink font-semibold">{gscStats ? `${formatNumber(gscStats.queryCount)} sorgu` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Ortalama Sıralama:</span>
                    <span className={gscStats ? "text-accent-ink font-semibold" : "text-muted font-semibold"}>
                      {gscStats ? formatNumber(gscStats.avgPosition, 1) : "—"}
                    </span>
                  </div>
                </Inset>

                <p className="text-xs text-muted">
                  {googleIntegrationStatus === "HEALTHY"
                    ? "Search Console verisi \"Şimdi Eşitle\" ile ya da zamanlanmış eşitlemeyle güncellenir."
                    : "⚠️ Bağlantı hatası sebebiyle arama konsolu verileri çekilememektedir. Lütfen hesabı yeniden bağlayın."}
                </p>
              </div>
            </Panel>

            {/* Google Analytics 4 Card */}
            <Panel
              title="Google Analytics 4 (GA4)"
              sub="Kullanıcı, oturum ve dönüşüm metrikleri."
              actions={
                <Badge tone="warn">
                  <AlertCircle className="w-3 h-3 mr-1" /> Yapılandırılmadı
                </Badge>
              }
            >
              <p className="text-xs text-muted">
                GA4 mülk kimliği site bazında henüz saklanmıyor, bu yüzden oturum ve dönüşüm metrikleri alınmıyor. Bu kart GA4 bağlantısı eklendiğinde dolacak.
              </p>
            </Panel>
          </div>

          {/* Sync Trigger Strip */}
          <div className="bg-surface border border-line rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent-surface border border-accent/20 flex items-center justify-center">
                <Radio className={`w-5 h-5 ${googleIntegrationStatus === "HEALTHY" ? "text-accent-ink animate-pulse" : "text-red-400"}`} />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-ink">Canlı Google Senkronizasyon Durumu</h4>
                <p className="text-xs text-muted mt-0.5">
                  Son başarılı senkronizasyon: <span className="font-medium text-ink">{googleLastSync}</span>
                  {googleIntegrationStatus !== "HEALTHY" && (
                    <span className="text-red-400 ml-2 font-semibold">({googleStatusDetail})</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="primary"
                loading={syncingGoogle}
                onClick={handleManualGoogleSync}
                icon={<RefreshCw className="w-4 h-4" />}
              >
                Şimdi Canlı Eşitle
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONNECTORS (CMS / WORKER / WEBHOOK) */}
      {activeTab === "connectors" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {list.map((c) => (
            <Panel
              key={c.id}
              title={c.ad}
              sub={c.tur}
              actions={
                <Badge
                  tone={
                    c.durum === "Bağlandı"
                      ? "evidence"
                      : c.durum === "Bağlantı Başarısız"
                      ? "critical"
                      : c.durum === "Yapılandırılmadı"
                      ? "warn"
                      : "neutral"
                  }
                >
                  {c.durum === "Bağlandı" && <CheckCircle2 className="w-3 h-3" aria-hidden />}
                  {c.durum === "Bağlantı Başarısız" && <AlertCircle className="w-3 h-3" aria-hidden />}
                  {c.durum}
                </Badge>
              }
            >
              <p className="text-sm text-muted">{c.aciklama}</p>
              <Inset className="mt-3 font-mono text-xs space-y-1">
                <div className="flex justify-between gap-3">
                  <span className="text-muted shrink-0">Uç nokta</span>
                  <span className="text-ink truncate font-medium">{c.endpoint || "—"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted shrink-0">Anahtar</span>
                  <span className="text-accent-ink">{c.tokenMasked}</span>
                </div>
              </Inset>
              <div className="mt-3 pt-3 border-t border-line flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  loading={testing === c.id}
                  onClick={() => handleTest(c)}
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Bağlantıyı test et
                </Button>
                <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
                  Ayarları düzenle
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {/* TAB 3: ALERT CHANNELS (SLACK, TELEGRAM, DISCORD, WEBHOOK) */}
      {activeTab === "alerts" && (
        <Panel
          title="Test bildirimi gönder"
          sub="Kanal bilgileri kaydedilmez. Kalıcı alarm kanalı ve olay tetikleyicileri henüz yok; bu form yalnızca kanalın mesaj alabildiğini doğrular."
        >
          <form onSubmit={handleTestAlert} className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <Label htmlFor="alert-channel">Kanal</Label>
              <select
                id="alert-channel"
                value={alertChannel}
                onChange={(e) => {
                  setAlertChannel(e.target.value as AlertChannelType);
                  setAlertSecret("");
                }}
                className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="SLACK">Slack</option>
                <option value="DISCORD">Discord</option>
                <option value="TELEGRAM">Telegram</option>
                <option value="WEBHOOK">Kurumsal Webhook (HMAC)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="alert-target">{ALERT_CHANNEL_FIELDS[alertChannel].target}</Label>
              <Input
                id="alert-target"
                required
                value={alertTarget}
                onChange={(e) => setAlertTarget(e.target.value)}
                placeholder={ALERT_CHANNEL_FIELDS[alertChannel].targetPlaceholder}
                mono
              />
            </div>
            {ALERT_CHANNEL_FIELDS[alertChannel].secret && (
              <div>
                <Label htmlFor="alert-secret">{ALERT_CHANNEL_FIELDS[alertChannel].secret}</Label>
                <Input
                  id="alert-secret"
                  type="password"
                  required
                  value={alertSecret}
                  onChange={(e) => setAlertSecret(e.target.value)}
                  autoComplete="off"
                  mono
                />
              </div>
            )}
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit" loading={testingAlert} icon={<Send className="w-3.5 h-3.5" />}>
                Test Bildirimi Gönder
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {/* Düzenleme Modalı */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `${editing.ad} ayarları` : ""} icon={<Sliders className="w-4 h-4" />}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label htmlFor="conn-endpoint">API / webhook uç noktası</Label>
            <Input id="conn-endpoint" type="url" required value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://orneksite.com/wp-json/wp/v2" mono />
            <p className="text-xs text-muted mt-1">SSRF koruması devrede: yerel ağ ve bulut metadata adresleri engellenir. Test için mock:// kullanabilirsiniz.</p>
          </div>
          <div>
            <Label htmlFor="conn-secret" hint="(mevcut anahtarı korumak için boş bırakın)">
              Yeni gizli anahtar / uygulama şifresi
            </Label>
            <div className="relative">
              <Input id="conn-secret" type={showSecret ? "text" : "password"} value={secret} onChange={(e) => setSecret(e.target.value)} mono className="pr-10" autoComplete="off" />
              <IconButton label={showSecret ? "Anahtarı gizle" : "Anahtarı göster"} onClick={() => setShowSecret((s) => !s)} className="absolute right-0.5 top-0.5">
                {showSecret ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
              </IconButton>
            </div>
            <p className="text-xs text-muted mt-1">Anahtarlar AES-256-GCM ile şifrelenir ve ekranda hiçbir zaman açık gösterilmez.</p>
          </div>
          <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              İptal
            </Button>
            <Button type="submit" loading={saving}>
              Kaydet
            </Button>
          </div>
        </form>
      </Modal>

      {/* Yeni Bağlayıcı Ekle Modalı */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Yeni Bağlayıcı Ekle" icon={<Plus className="w-4 h-4" />}>
        <form onSubmit={handleAddNew} className="space-y-4">
          <div>
            <Label htmlFor="new-conn-type">Bağlayıcı Türü</Label>
            <select
              id="new-conn-type"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="WORDPRESS_REST">WordPress REST (Uygulama Şifresi)</option>
              <option value="GENERIC_WEBHOOK">Kurumsal Webhook (HMAC-SHA256)</option>
              <option value="GIT_PR">Git / GitHub PR (Personal Access Token)</option>
              <option value="CLOUDFLARE_WORKER">Cloudflare Worker & KV (API Token)</option>
            </select>
          </div>
          <div>
            <Label htmlFor="new-conn-endpoint">Uç Nokta / API URL</Label>
            <Input id="new-conn-endpoint" type="text" required value={newEndpoint} onChange={(e) => setNewEndpoint(e.target.value)} placeholder="https://site.com/wp-json/wp/v2 veya mock://site" mono />
          </div>
          <div>
            <Label htmlFor="new-conn-secret">Gizli Anahtar / Erişim Belirteci</Label>
            <Input id="new-conn-secret" type="password" required value={newSecret} onChange={(e) => setNewSecret(e.target.value)} placeholder="Uygulama şifresi, API anahtarı veya token" mono />
          </div>
          <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              İptal
            </Button>
            <Button type="submit" loading={saving}>
              Bağlayıcıyı Ekle
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
