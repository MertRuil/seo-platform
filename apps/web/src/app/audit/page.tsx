"use client";

import React from "react";
import { History, ShieldCheck, UserCheck, Key } from "lucide-react";

export default function DenetimGunluguPage() {
  const kayitlar = [
    { saat: "00:25:12", kullanici: "Sistem (Otonom Motor)", islem: "DEĞİŞİKLİK_UYGULANDI", hedef: "/urunler/ayakkabi", ayrinti: "Canonical etiketi düzeltildi ve doğrulanarak kaydedildi." },
    { saat: "00:20:04", kullanici: "lead@autonomous-seo.org", islem: "DEĞİŞİKLİK_ONAYLANDI", hedef: "Değişiklik Seti #CS-4102", ayrinti: "Kullanıcı manuel inceleme ve onay verdi." },
    { saat: "00:15:30", kullanici: "Sistem (Crawler)", islem: "TARAMA_TAMAMLANDI", hedef: "https://flagship-store.com", ayrinti: "124 sayfa başarıyla tarandı ve indeks durumu güncellendi." },
    { saat: "00:10:02", kullanici: "lead@autonomous-seo.org", islem: "OTURUM_ACILDI", hedef: "JWT Oturumu", ayrinti: "IP: 127.0.0.1 üzerinden güvenli oturum başlatıldı." }
  ];

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
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-800">
          <h3 className="font-semibold text-white text-base">Son İşlemler ve Güvenlik Olayları</h3>
        </div>
        <div className="divide-y divide-slate-800/80">
          {kayitlar.map((k, idx) => (
            <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-800/40 transition-all text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-indigo-400 font-bold">{k.saat}</span>
                  <span className="font-semibold text-white">{k.islem}</span>
                  <span className="text-slate-400">({k.hedef})</span>
                </div>
                <p className="text-slate-300">{k.ayrinti}</p>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 shrink-0 font-medium">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{k.kullanici}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
