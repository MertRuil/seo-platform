"use client";

import React from "react";
import { Sliders, CheckCircle2, Shield, Globe, Key } from "lucide-react";

export default function EntegrasyonlarPage() {
  const baglayicilar = [
    { ad: "Google Search Console", tur: "OAuth2", durum: "Bağlandı", aciklama: "Arama analitiği ve dizin denetim verileri senkronize ediliyor." },
    { ad: "WordPress REST Bağlayıcısı", tur: "Application Password", durum: "Hazır", aciklama: "Yazı başlıkları, meta etiketleri ve canonical güncellemeleri." },
    { ad: "Git / GitHub PR Bağlayıcısı", tur: "Kişisel Erişim Belirteci", durum: "Hazır", aciklama: "Headless web siteleri için güvenli Pull Request ve onay akışı." },
    { ad: "Kurumsal Webhook Bağlayıcısı", tur: "HMAC-SHA256 İmzalı", durum: "Bağlandı", aciklama: "Özel CMS sistemlerine güvenli ve şifreli veri aktarımı." }
  ];

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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {baglayicilar.map((b, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-base">{b.ad}</span>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {b.durum}
              </span>
            </div>
            <p className="text-xs text-slate-400">{b.aciklama}</p>
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-mono">Kimlik Doğrulama: {b.tur}</span>
              <button className="text-indigo-400 hover:text-indigo-300 font-medium">Ayarları Düzenle</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
