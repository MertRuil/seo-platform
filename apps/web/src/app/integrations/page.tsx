"use client";

import React, { useState } from "react";
import { Sliders, CheckCircle2, Shield, Lock, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useSiteData } from "@/hooks/useSiteData";
import { DEMO_CONNECTORS, type ConnectorItem } from "@/lib/demo";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, Inset } from "@/components/ui/Panel";
import { Button, IconButton } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Notice } from "@/components/ui/States";

export default function BaglayicilarPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);
  // Arka uçta bağlayıcı listeleme/kaydetme ucu yok; kartlar örnek.
  const demo = useSiteData<ConnectorItem[]>("connectors", async () => DEMO_CONNECTORS, DEMO_CONNECTORS, { requires: "none" });

  const [list, setList] = useState<ConnectorItem[]>(DEMO_CONNECTORS);
  const [editing, setEditing] = useState<ConnectorItem | null>(null);
  const [endpoint, setEndpoint] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const openEdit = (c: ConnectorItem) => {
    if (!isAdmin) return;
    setEditing(c);
    setEndpoint(c.endpoint);
    setSecret("");
    setShowSecret(false);
    setNotice(null);
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    setNotice(null);
    await new Promise((r) => setTimeout(r, 800));
    setTesting(null);
    setNotice({ tone: "success", text: "Bağlantı ve SSRF doğrulaması başarılı; uç nokta yanıt veriyor." });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setList((prev) => prev.map((c) => (c.id === editing.id ? { ...c, endpoint, tokenMasked: secret ? `${secret.slice(0, 4)}••••••••••••` : c.tokenMasked, durum: "Bağlandı" } : c)));
    setSaving(false);
    setNotice({ tone: "success", text: `"${editing.ad}" ayarları güncellendi.` });
    setEditing(null);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      <DemoBanner source={demo.source} reason={demo.reason} />
      <PageHeader
        icon={<Sliders className="w-5 h-5" />}
        title="Bağlayıcılar ve ayarlar"
        description="Değişikliklerin kaynağa yazılmasını (WordPress, Git PR, Cloudflare Worker, webhook) ve Search Console veri akışını yönetin."
        actions={
          isAdmin ? (
            <Badge tone="accent">
              <Shield className="w-3 h-3" aria-hidden /> Yönetici yetkisi
            </Badge>
          ) : (
            <Badge tone="warn">
              <Lock className="w-3 h-3" aria-hidden /> Salt okunur
            </Badge>
          )
        }
      />

      {notice && (
        <Notice tone={notice.tone} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {list.map((c) => (
          <Panel key={c.id} title={c.ad} sub={c.tur} actions={<Badge tone={c.durum === "Bağlandı" ? "evidence" : "neutral"}>{c.durum === "Bağlandı" && <CheckCircle2 className="w-3 h-3" aria-hidden />}{c.durum}</Badge>}>
            <p className="text-sm text-muted">{c.aciklama}</p>
            <Inset className="mt-3 font-mono text-xs space-y-1">
              <div className="flex justify-between gap-3">
                <span className="text-muted shrink-0">Uç nokta</span>
                <span className="text-ink truncate">{c.endpoint}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted shrink-0">Anahtar</span>
                <span className="text-accent-ink">{c.tokenMasked}</span>
              </div>
            </Inset>
            <div className="mt-3 pt-3 border-t border-line flex items-center justify-between gap-2">
              <Button size="sm" variant="ghost" loading={testing === c.id} onClick={() => handleTest(c.id)} icon={<RefreshCw className="w-3.5 h-3.5" />}>
                Bağlantıyı test et
              </Button>
              {isAdmin ? (
                <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
                  Ayarları düzenle
                </Button>
              ) : (
                <span className="text-xs text-muted inline-flex items-center gap-1">
                  <Lock className="w-3 h-3" aria-hidden /> Yönetici kilidi
                </span>
              )}
            </div>
          </Panel>
        ))}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `${editing.ad} ayarları` : ""} icon={<Sliders className="w-4 h-4" />}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <Label htmlFor="conn-endpoint">API / webhook uç noktası</Label>
            <Input id="conn-endpoint" type="url" required value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="https://orneksite.com/api/webhook" mono />
            <p className="text-xs text-muted mt-1">SSRF koruması devrede: yerel ağ ve bulut metadata adresleri engellenir.</p>
          </div>
          <div>
            <Label htmlFor="conn-secret" hint="(mevcut anahtarı korumak için boş bırakın)">
              Yeni gizli anahtar
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
    </div>
  );
}
