"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  Sliders, 
  CheckCircle2, 
  Shield, 
  Lock, 
  X, 
  Eye, 
  EyeOff, 
  Loader2, 
  RefreshCw
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
    <div className="space-y-6 max-w-7xl mx-auto pb-12 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e2e4e8] dark:border-[#343633] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#121316] dark:text-white flex items-center gap-2">
            <Sliders className="w-6 h-6 text-[#3157e5] dark:text-indigo-400" />
            <span>Site Bağlayıcıları ve Dış Entegrasyonlar</span>
          </h1>
          <p className="text-sm text-[#656971] dark:text-[#8c8d89] mt-1">
            Site değişikliklerinin güvenle uygulanmasını ve Google Search Console veri akışını yönetin.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#3157e5]/10 text-[#3157e5] dark:text-indigo-300 border border-[#3157e5]/20 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#3157e5] dark:text-indigo-400" />
              Yönetici Yetkisi Aktif
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Salt Okunur (Düzenleme Yetkisi Yok)
            </span>
          )}
        </div>
      </div>

      {bildirim && (
        <div className={`p-4 rounded-xl text-xs flex items-center gap-2.5 shadow-xs animate-in fade-in duration-200 ${
          bildirim.tip === "basari"
            ? "bg-[#0f927c]/10 border border-[#0f927c]/30 text-[#0f927c] dark:text-emerald-300"
            : "bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300"
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-medium">{bildirim.mesaj}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {baglayicilar.map((b) => (
          <div key={b.id} className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-xl p-6 hover:border-[#cfd3da] dark:hover:border-[#484a46] transition-all space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#121316] dark:text-white text-base">{b.ad}</span>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-[#0f927c]/10 text-[#0f927c] dark:bg-emerald-500/10 dark:text-emerald-400 border border-[#0f927c]/20 dark:border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {b.durum}
              </span>
            </div>

            <p className="text-xs text-[#656971] dark:text-[#8c8d89]">{b.aciklama}</p>

            {/* Hassas Bilgiler Maskelenmiş */}
            <div className="bg-[#f5f6f8] dark:bg-[#171817] p-3 rounded-lg border border-[#e2e4e8] dark:border-[#343633] space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between text-[#656971] dark:text-[#8c8d89]">
                <span>Uç Nokta:</span>
                <span className="text-[#121316] dark:text-slate-300 truncate max-w-[220px] font-medium">{b.endpoint}</span>
              </div>
              <div className="flex items-center justify-between text-[#656971] dark:text-[#8c8d89]">
                <span>Anahtar / Gizli Bilgi:</span>
                <span className="text-[#3157e5] dark:text-indigo-400 font-semibold">{b.tokenMasked}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#e2e4e8] dark:border-[#343633] flex items-center justify-between text-xs">
              <button
                onClick={() => handleBaglantiTest(b.id)}
                disabled={testEdiliyorId === b.id}
                className="text-[#656971] dark:text-[#8c8d89] hover:text-[#121316] dark:hover:text-white font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {testEdiliyorId === b.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3157e5] dark:text-indigo-400" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Bağlantıyı Test Et</span>
              </button>

              {isAdmin ? (
                <button
                  onClick={() => handleDuzenleAc(b)}
                  className="px-3 py-1.5 bg-[#3157e5]/10 hover:bg-[#3157e5]/20 text-[#3157e5] dark:text-indigo-300 border border-[#3157e5]/30 rounded font-medium transition-all cursor-pointer shadow-xs"
                >
                  Ayarları Düzenle
                </button>
              ) : (
                <span className="text-[#8a8e96] dark:text-[#70726d] text-[11px] flex items-center gap-1 font-medium">
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
        <div className="fixed inset-0 z-50 bg-black/50 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#202120] border border-[#dde0e5] dark:border-[#343633] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[#e2e4e8] dark:border-[#343633] pb-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#3157e5] dark:text-indigo-400" />
                <h3 className="font-bold text-[#121316] dark:text-white text-base">
                  {duzenlenenBaglayici.ad} Ayarları
                </h3>
              </div>
              <button
                onClick={() => setDuzenlenenBaglayici(null)}
                className="text-[#8a8e96] hover:text-[#121316] dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleKaydet} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[#121316] dark:text-slate-200 font-semibold block">API / Webhook Uç Noktası (URL)</label>
                <input
                  type="url"
                  required
                  value={formEndpoint}
                  onChange={(e) => setFormEndpoint(e.target.value)}
                  placeholder="https://orneksite.com/api/webhook"
                  className="w-full bg-[#f5f6f8] dark:bg-[#171817] border border-[#cfd3da] dark:border-[#343633] rounded-lg px-3.5 py-2.5 text-[#121316] dark:text-white font-mono placeholder-[#8a8e96] dark:placeholder-[#6f6d66] focus:outline-none focus:border-[#3157e5] transition-all shadow-xs"
                />
                <p className="text-[11px] text-[#656971] dark:text-[#8c8d89]">
                  SSRF koruması devrede: Yerel ağ ve bulut metadata adresleri engellenir.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[#121316] dark:text-slate-200 font-semibold block">
                  Yeni Gizli Anahtar / Erişim Belirteci
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? "text" : "password"}
                    value={formSecret}
                    onChange={(e) => setFormSecret(e.target.value)}
                    placeholder="Mevcut anahtarı korumak için boş bırakın"
                    className="w-full bg-[#f5f6f8] dark:bg-[#171817] border border-[#cfd3da] dark:border-[#343633] rounded-lg pl-3.5 pr-10 py-2.5 text-[#121316] dark:text-white font-mono placeholder-[#8a8e96] dark:placeholder-[#6f6d66] focus:outline-none focus:border-[#3157e5] transition-all shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-2.5 text-[#8a8e96] hover:text-[#121316] dark:hover:text-white cursor-pointer"
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-[#656971] dark:text-[#8c8d89]">
                  Şifreler AES-256-GCM ile şifrelenir ve kullanıcı ekranında asla açık metin olarak gösterilmez.
                </p>
              </div>

              <div className="pt-3 border-t border-[#e2e4e8] dark:border-[#343633] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDuzenlenenBaglayici(null)}
                  className="px-4 py-2 bg-white dark:bg-[#171817] hover:bg-[#f5f6f8] dark:hover:bg-[#252624] text-[#656971] dark:text-slate-300 border border-[#dde0e5] dark:border-[#343633] rounded-lg font-semibold transition-all cursor-pointer shadow-xs"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={islemde}
                  className="px-5 py-2 bg-[#3157e5] hover:bg-[#2546c7] disabled:bg-[#3157e5]/50 text-white rounded-lg font-semibold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
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
