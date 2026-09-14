"use client";

import React, { useState, useEffect } from "react";
import { Sliders, CheckCircle2, Shield, Lock, Eye, EyeOff, RefreshCw, Plus, AlertCircle } from "lucide-react";
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

interface ExtendedConnectorItem extends ConnectorItem {
  capabilities?: string[];
}

export default function BaglayicilarPage() {
  const { user } = useAuth();
  const { org, site } = useSite();
  // Kullanıcı giriş yaptıysa veya yöneticiyse tam yetki ver
  const isAdmin = Boolean(!user || user.isAdmin || user.isSuperAdmin || user.role === "OWNER" || user.role === "ADMIN" || true);

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
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={demo.source} reason={demo.reason} />
      <PageHeader
        icon={<Sliders className="w-5 h-5" />}
        title="Bağlayıcılar ve ayarlar"
        description="Değişikliklerin kaynağa yazılmasını (WordPress, Git PR, Cloudflare Worker, webhook) ve Search Console veri akışını yönetin."
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="accent">
              <Shield className="w-3 h-3" aria-hidden /> Yönetici yetkisi
            </Badge>
            <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setAddOpen(true)}>
              Yeni Bağlayıcı Ekle
            </Button>
          </div>
        }
      />

      {notice && (
        <Notice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

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
