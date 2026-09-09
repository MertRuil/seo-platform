"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { History, ShieldCheck, UserCheck, Key, Lock, Search, Filter, Shield } from "lucide-react";

export default function DenetimGunluguPage() {
  const { user } = useAuth();
  const isAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin);
  const [arama, setArama] = useState("");
  const [kategoriFiltre, setKategoriFiltre] = useState("TÜMÜ");

  const kayitlar = [
    { saat: "00:25:12", kullanici: "Sistem (Otonom Motor)", islem: "DEĞİŞİKLİK_UYGULANDI", hedef: "/urunler/ayakkabi", ayrinti: "Canonical etiketi düzeltildi ve doğrulanarak kaydedildi.", ip: "127.0.0.1" },
    { saat: "00:20:04", kullanici: "mert@seo.com", islem: "DEĞİŞİKLİK_ONAYLANDI", hedef: "Değişiklik Seti #CS-4102", ayrinti: "Kullanıcı manuel inceleme ve onay verdi.", ip: "127.0.0.1" },
    { saat: "00:15:30", kullanici: "Sistem (Crawler)", islem: "TARAMA_TAMAMLANDI", hedef: "https://flagship-store.com", ayrinti: "124 sayfa başarıyla tarandı ve indeks durumu güncellendi.", ip: "127.0.0.1" },
    { saat: "00:10:02", kullanici: user?.email || "aybo@seo.com", islem: "OTURUM_ACILDI", hedef: "JWT Oturumu", ayrinti: "Güvenli HMAC-SHA256 oturumu başlatıldı.", ip: "127.0.0.1" }
  ];

  const filtrelenmis = kayitlar.filter(k => {
    const eslesmeArama = k.islem.toLowerCase().includes(arama.toLowerCase()) ||
      k.hedef.toLowerCase().includes(arama.toLowerCase()) ||
      k.kullanici.toLowerCase().includes(arama.toLowerCase()) ||
      k.ayrinti.toLowerCase().includes(arama.toLowerCase());
    
    if (kategoriFiltre === "TÜMÜ") return eslesmeArama;
    return eslesmeArama && k.islem.includes(kategoriFiltre);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-400" />
            <span>Sistem & Güvenlik Denetim Günlüğü (Audit Log)</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Kullanıcı eylemleri, yapay zeka optimizasyonları ve site yazma işlemlerinin değiştirilemez işlem defteri.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              Yönetici Denetim Modu
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              IP & Hassas Veri Maskelenmiş
            </span>
          )}
        </div>
      </div>

      {/* Arama & Filtre Çubuğu */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="İşlem, hedef veya kullanıcı ara..."
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {["TÜMÜ", "DEĞİŞİKLİK", "TARAMA", "OTURUM"].map((cat) => (
            <button
              key={cat}
              onClick={() => setKategoriFiltre(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                kategoriFiltre === cat
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-semibold text-white text-base">Son İşlemler ve Güvenlik Olayları</h3>
          <span className="text-xs text-slate-500 font-mono">{filtrelenmis.length} Kayıt Listeleniyor</span>
        </div>
        <div className="divide-y divide-slate-800/80">
          {filtrelenmis.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Arama kriterlerine uygun denetim kaydı bulunamadı.
            </div>
          ) : (
            filtrelenmis.map((k, idx) => (
              <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-all text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-indigo-400 font-bold">{k.saat}</span>
                    <span className="font-semibold text-white">{k.islem}</span>
                    <span className="text-slate-400">({k.hedef})</span>
                  </div>
                  <p className="text-slate-300">{k.ayrinti}</p>
                  {isAdmin && (
                    <span className="text-[10px] text-slate-500 font-mono block">
                      Kaynak IP: {k.ip}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-slate-400 shrink-0 font-medium">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{k.kullanici}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
