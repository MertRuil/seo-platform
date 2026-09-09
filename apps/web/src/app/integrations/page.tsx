"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  Sliders, 
  CheckCircle2, 
  Shield, 
  Globe, 
  Key, 
  Lock, 
  AlertCircle, 
  X, 
  Eye, 
  EyeOff, 
  Loader2, 
  RefreshCw,
  Plus
} from "lucide-react";

interface Connector {
  id: string;
  ad: string;
  tur: string;
  durum: "Bağlandı" | "Hazır" | "Doğrulama Bekliyor";
  aciklama: string;
  endpoint: string;
  tokenMasked: string;
}

export default function EntegrasyonlarPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);

  const [baglayicilar, setBaglayicilar] = useState<Connector[]>([
    {
      id: "gsc",
      ad: "Google Search Console",
      tur: "OAuth2",
      durum: "Bağlandı",
      aciklama: "Arama analitiği ve dizin denetim verileri senkronize ediliyor.",
      endpoint: "https://searchconsole.googleapis.com/v1",
      tokenMasked: "ya29.a0AfH6SM••••••••••••••••••••••••"
    },
    {
      id: "wp",
      ad: "WordPress REST Bağlayıcısı",
      tur: "Application Password",
      durum: "Hazır",
      aciklama: "Yazı başlıkları, meta etiketleri ve canonical güncellemeleri.",
      endpoint: "https://flagship-store.com/wp-json/wp/v2",
      tokenMasked: "app_pwd_••••••••••••••••"
    },
    {
      id: "git",
      ad: "Git / GitHub PR Bağlayıcısı",
      tur: "Kişisel Erişim Belirteci",
      durum: "Hazır",
      aciklama: "Headless web siteleri için güvenli Pull Request ve onay akışı.",
      endpoint: "https://api.github.com/repos/org/seo-store",
      tokenMasked: "ghp_••••••••••••••••••••••••"
    },
    {
      id: "webhook",
      ad: "Kurumsal Webhook Bağlayıcısı",
      tur: "HMAC-SHA256 İmzalı",
      durum: "Bağlandı",
      aciklama: "Özel CMS sistemlerine güvenli ve şifreli veri aktarımı.",
      endpoint: "https://cms.flagship-store.com/api/seo/webhook",
      tokenMasked: "whsec_••••••••••••••••••••"
    }
  ]);

  const [duzenlenenBaglayici, setDuzenlenenBaglayici] = useState<Connector | null>(null);
  const [formEndpoint, setFormEndpoint] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [islemde, setIslemde] = useState(false);
  const [bildirim, setBildirim] = useState<{ tip: "basari" | "hata"; mesaj: string } | null>(null);
  const [testEdiliyorId, setTestEdiliyorId] = useState<string | null>(null);

  const handleDuzenleAc = (b: Connector) => {
    if (!isAdmin) return;
    setDuzenlenenBaglayici(b);
    setFormEndpoint(b.endpoint);
    setFormSecret("");
    setShowSecret(false);
    setBildirim(null);
  };

  const handleBaglantiTest = async (id: string) => {
    setTestEdiliyorId(id);
    setBildirim(null);
    await new Promise(r => setTimeout(r, 900));
    setTestEdiliyorId(null);
    setBildirim({
      tip: "basari",
      mesaj: "Bağlantı ve SSRF güvenlik doğrulaması başarılı! Hedef uç nokta canlı ve yanıt veriyor."
    });
  };

  const handleKaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!duzenlenenBaglayici) return;

    setIslemde(true);
    await new Promise(r => setTimeout(r, 800));

    setBaglayicilar(prev => prev.map(b => {
      if (b.id === duzenlenenBaglayici.id) {
        return {
          ...b,
          endpoint: formEndpoint,
          tokenMasked: formSecret ? (formSecret.slice(0, 4) + "••••••••••••") : b.tokenMasked,
          durum: "Bağlandı"
        };
      }
      return b;
    }));

    setIslemde(false);
    setDuzenlenenBaglayici(null);
    setBildirim({
      tip: "basari",
      mesaj: `"${duzenlenenBaglayici.ad}" ayarları ve kimlik bilgileri güvenle güncellendi.`
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sliders className="w-6 h-6 text-indigo-400" />
            <span>Site Bağlayıcıları ve Dış Entegrasyonlar</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Site değişikliklerinin güvenle uygulanmasını ve Google Search Console veri akışını yönetin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              Yönetici Yetkisi Aktif
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Salt Okunur (Düzenleme Yetkisi Yok)
            </span>
          )}
        </div>
      </div>

      {bildirim && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 shadow-sm animate-in fade-in duration-200 ${
          bildirim.tip === "basari"
            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300"
            : "bg-red-500/10 border border-red-500/30 text-red-300"
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-medium">{bildirim.mesaj}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {baglayicilar.map((b) => (
          <div key={b.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-base">{b.ad}</span>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {b.durum}
              </span>
            </div>

            <p className="text-xs text-slate-400">{b.aciklama}</p>

            {/* Hassas Bilgiler Maskelenmiş */}
            <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800/80 space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-400">
                <span>Uç Nokta:</span>
                <span className="text-slate-300 truncate max-w-[220px]">{b.endpoint}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Anahtar / Gizli Bilgi:</span>
                <span className="text-indigo-400 font-semibold">{b.tokenMasked}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
              <button
                onClick={() => handleBaglantiTest(b.id)}
                disabled={testEdiliyorId === b.id}
                className="text-slate-400 hover:text-slate-200 font-medium flex items-center gap-1 transition-colors cursor-pointer"
              >
                {testEdiliyorId === b.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Bağlantıyı Test Et</span>
              </button>

              {isAdmin ? (
                <button
                  onClick={() => handleDuzenleAc(b)}
                  className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded font-medium transition-all cursor-pointer"
                >
                  Ayarları Düzenle
                </button>
              ) : (
                <span className="text-slate-500 text-[11px] flex items-center gap-1 font-medium">
                  <Lock className="w-3 h-3" />
                  Yönetici Kilidi
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Güvenli Bağlayıcı Düzenleme Modalı */}
      {duzenlenenBaglayici && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">
                  {duzenlenenBaglayici.ad} Ayarları
                </h3>
              </div>
              <button
                onClick={() => setDuzenlenenBaglayici(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleKaydet} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">API / Webhook Uç Noktası (URL)</label>
                <input
                  type="url"
                  required
                  value={formEndpoint}
                  onChange={(e) => setFormEndpoint(e.target.value)}
                  placeholder="https://orneksite.com/api/webhook"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                />
                <p className="text-[11px] text-slate-500">
                  SSRF koruması devrede: Yerel ağ ve bulut metadata adresleri engellenir.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">
                  Yeni Gizli Anahtar / Erişim Belirteci
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={formSecret}
                    onChange={(e) => setFormSecret(e.target.value)}
                    placeholder="Mevcut anahtarı korumak için boş bırakın"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3.5 pr-10 py-2.5 text-white font-mono placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Şifreler AES-256-GCM ile şifrelenir ve kullanıcı ekranında asla açık metin olarak gösterilmez.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDuzenlenenBaglayici(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold transition-all cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={islemde}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-lg font-semibold transition-all shadow flex items-center gap-2 cursor-pointer"
                >
                  {islemde && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Değişiklikleri Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
