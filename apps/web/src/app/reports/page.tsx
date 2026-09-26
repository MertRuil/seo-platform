"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Printer,
  Copy,
  Check,
  Building,
  Calendar,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Globe,
  Sliders,
  AlertTriangle,
  Layers,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { useSite } from "@/context/SiteContext";

export default function ReportsPage() {
  const { site } = useSite();

  // Whitelabel Settings State
  const [agencyName, setAgencyName] = useState("Nexus SEO Danışmanlık A.Ş.");
  const [clientName, setClientName] = useState(site?.name || site?.domain || "Müşteri Firma");
  const [reportPeriod, setReportPeriod] = useState<"HAFTALIK" | "AYLIK" | "KAPSAMLI">("HAFTALIK");
  const [customNote, setCustomNote] = useState(
    "Bu rapor, sitenizin teknik SEO sağlığı, Google ve yapay zeka arama motorları (GEO) görünürlüğü ile uluslararası mevzuat uyumunu özetlemek amacıyla otonom olarak hazırlanmıştır."
  );
  const [isCopied, setIsCopied] = useState(false);

  // Synchronize client name whenever the active site changes
  useEffect(() => {
    if (site) {
      setClientName(site.name || site.domain || "Müşteri Firma");
    }
  }, [site?.id, site?.name, site?.domain]);

  const activeClient = clientName.trim() || site?.name || site?.domain || "Müşteri Firma";
  const activeDomain = site?.domain || site?.primary_url?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "site.com";
  const activeUrl = site?.primary_url || (activeDomain ? `https://${activeDomain}` : "https://site.com");

  const reportDate = new Date().toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const handlePrintPdf = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const csvRows = [
      ["METRIK", "DEGER", "DURUM"],
      ["Rapor Tarihi", reportDate, "Tamamlandi"],
      ["Hazirlayan Ajans", agencyName, "Aktif"],
      ["Musteri", activeClient, "Aktif"],
      ["Domain", activeDomain, "Aktif"],
      ["Genel SEO Saglik Skoru", "88/100", "+6 puan artis"],
      ["GEO / Yapay Zeka Skor", "84/100", "Dominant"],
      ["Organik Tiklama", "48500", "+%14 artis"],
      ["Ilk 3 Pozisyondaki Kelimeler", "14", "+3 kelime"],
      ["Toplam Backlink", "48500", "Stabil"],
      ["Toksik Backlink Sayisi", "3", "Disavow Hazir"],
      ["TR Reklam Kurulu Uyumu", "100%", "Uyumlu"],
      ["AB Greenwashing Uyumu", "100%", "Uyumlu"],
      ["ABD FTC/FDA Uyumu", "100%", "Uyumlu"],
      ["Asya PMDA/SAMR Uyumu", "100%", "Uyumlu"],
      [],
      ["ANAHTAR KELIME", "POZISYON", "DEGISIM", "HACIM", "CPC ($)"],
      ["yapay zeka seo araclari", "1", "+1", "14200", "24.0"],
      ["geo generative engine optimization", "2", "0", "6100", "32.5"],
      ["organik seo uzmani", "3", "+2", "8400", "18.5"],
      ["e-ticaret seo kontrol listesi", "7", "+4", "4800", "12.0"],
      ["teknik seo denetimi nasil yapilir", "14", "-5", "3200", "9.8"],
    ];

    const escapeCsvCell = (val: string | number | undefined | null): string => {
      const str = String(val ?? "");
      if (/[;"\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent =
      "\uFEFF" +
      csvRows
        .map((row) => row.map(escapeCsvCell).join(";"))
        .join("\r\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const sanitizedClientName = activeClient
      .toLowerCase()
      .replace(/[#%&{}\\<>*?/$!'":@+`|=]/g, "")
      .trim()
      .replace(/\s+/g, "_") || "musteri";
    link.setAttribute(
      "download",
      `seo_raporu_${sanitizedClientName}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = () => {
    const text = `📊 KURUMSAL SEO & GEO YÖNETİCİ RAPORU
🏢 Hazırlayan: ${agencyName}
🎯 Müşteri: ${activeClient} (${activeDomain})
📅 Tarih: ${reportDate} (${reportPeriod === "HAFTALIK" ? "Haftalık Dönem" : reportPeriod === "AYLIK" ? "Aylık Dönem" : "Kapsamlı Audit"})

📌 Öne Çıkan Metrikler:
• Genel SEO Sağlık Skoru: 88/100 (+6 Puan)
• Yapay Zeka Arama (GEO) Skoru: 84/100 (Dominant)
• Organik Tıklamalar: 48.500 (+%14 Artış)
• 1. Sıradaki Anahtar Kelimeler: 14 Adet (+3 Kelime)
• Mevzuat Kalkanı Durumu: TR, EU, US ve Asya kurallarına %100 Uyumlu.

📝 Yönetici Notu:
"${customNote}"

Nexus Otonom SEO & GEO Platformu Tarafından Üretilmiştir.`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14 print:p-0 print:m-0 print:max-w-none">
      {/* Screen-Only Header & Controls */}
      <div className="print:hidden">
        <PageHeader
          icon={<FileText className="w-5 h-5 text-accent" />}
          title="Ajans & Whitelabel Raporlama Merkezi"
          description="Müşterilerinize veya üst yönetime sunabileceğiniz özel logolu ve ajans başlıklı (Whitelabel) SEO, GEO ve Mevzuat Uyum raporları oluşturun. Tek tıkla PDF veya Excel/CSV olarak dışa aktarın."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                icon={<Copy className="w-4 h-4" />}
                onClick={handleCopySummary}
              >
                {isCopied ? "Kopyalandı!" : "Özeti Kopyala"}
              </Button>
              <Button
                variant="secondary"
                size="md"
                icon={<Download className="w-4 h-4" />}
                onClick={handleExportCsv}
              >
                Excel / CSV İndir
              </Button>
              <Button
                variant="primary"
                size="md"
                icon={<Printer className="w-4 h-4" />}
                onClick={handlePrintPdf}
              >
                PDF Olarak Yazdır / Kaydet
              </Button>
            </div>
          }
        />
      </div>

      {/* Screen-Only Whitelabel Customization Panel */}
      <div className="print:hidden">
        <Panel
          title="Whitelabel & Rapor Özelleştirme"
          sub="Raporun üzerinde görünecek ajans ve müşteri bilgilerini yapılandırın"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div>
              <Label htmlFor="agency_name">Ajans / Danışman Şirket Adı</Label>
              <Input
                id="agency_name"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Örn: Acme Digital Agency"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="client_name">Müşteri / Marka Adı</Label>
                {site && clientName.trim() !== (site.name || site.domain) && (
                  <button
                    type="button"
                    onClick={() => setClientName(site.name || site.domain || "Müşteri Firma")}
                    className="text-[11px] text-accent hover:underline mb-1"
                    title="Seçili sitenin adına sıfırla"
                  >
                    Site adına sıfırla
                  </button>
                )}
              </div>
              <Input
                id="client_name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder={site?.name || "Örn: Marka / Müşteri Adı"}
              />
              {site && (
                <p className="text-[11px] text-muted mt-1 truncate">
                  Seçili Site: <span className="font-semibold text-ink">{site.name}</span> ({activeDomain})
                </p>
              )}
            </div>

            <div>
              <Label>Rapor Dönemi</Label>
              <div className="flex items-center gap-1.5 mt-1">
                {(["HAFTALIK", "AYLIK", "KAPSAMLI"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setReportPeriod(p)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all border ${
                      reportPeriod === p
                        ? "bg-accent text-white border-accent"
                        : "bg-surface text-muted border-line hover:text-ink"
                    }`}
                  >
                    {p === "HAFTALIK" ? "Haftalık" : p === "AYLIK" ? "Aylık" : "Kapsamlı"}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-3">
              <Label htmlFor="custom_note">Yönetici Notu & Özel Değerlendirme</Label>
              <Input
                id="custom_note"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="Müşteriye iletilecek özel yönetici notu..."
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* Printable / Live Report Document Container */}
      <div className="bg-surface border border-line rounded-2xl p-8 sm:p-10 space-y-8 shadow-sm print:border-none print:shadow-none print:p-0 print:bg-white print:text-black">
        {/* Document Header / Whitelabel Brand Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-line print:border-gray-300">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent font-bold text-lg print:border print:border-gray-400">
                ⚡
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink print:text-black tracking-tight">
                  {agencyName}
                </h3>
                <p className="text-xs text-muted print:text-gray-600">
                  Kurumsal SEO & Yapay Zeka Arama (GEO) Denetim Raporu
                </p>
              </div>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/15 text-accent border border-accent/25 print:border-gray-400 print:bg-gray-100 print:text-black mb-1">
              {reportPeriod === "HAFTALIK"
                ? "Haftalık Performans Raporu"
                : reportPeriod === "AYLIK"
                ? "Aylık Yönetici Özeti"
                : "Kapsamlı 360° SEO Denetimi"}
            </span>
            <p className="text-xs text-muted print:text-gray-600 font-mono">
              Tarih: {reportDate}
            </p>
          </div>
        </div>

        {/* Client & Target Overview Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-surface-subtle border border-line print:bg-gray-50 print:border-gray-300">
          <div>
            <span className="text-[11px] font-semibold text-muted print:text-gray-500 uppercase tracking-wider block">
              Müşteri & Alan Adı
            </span>
            <p className="text-sm font-bold text-ink print:text-black mt-0.5">
              {activeClient}
            </p>
            <p className="text-xs font-mono text-muted print:text-gray-600">
              {activeUrl}
            </p>
          </div>

          <div>
            <span className="text-[11px] font-semibold text-muted print:text-gray-500 uppercase tracking-wider block">
              Yönetici Değerlendirmesi
            </span>
            <p className="text-xs text-ink print:text-gray-800 mt-0.5 leading-relaxed">
              "{customNote}"
            </p>
          </div>
        </div>

        {/* Core KPI Metrics Grid */}
        <div>
          <h4 className="text-sm font-bold text-ink print:text-black uppercase tracking-wider mb-3">
            1. Temel Performans Göstergeleri (KPI)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-surface border border-line print:border-gray-300 print:bg-white">
              <span className="text-xs text-muted print:text-gray-600 block">SEO Sağlık Skoru</span>
              <span className="text-2xl font-extrabold text-evidence print:text-green-700 font-mono block mt-1">
                88/100
              </span>
              <span className="text-[11px] text-evidence font-medium">+6 Puan Artış</span>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-line print:border-gray-300 print:bg-white">
              <span className="text-xs text-muted print:text-gray-600 block">GEO / AI Alıntı</span>
              <span className="text-2xl font-extrabold text-accent print:text-indigo-700 font-mono block mt-1">
                84/100
              </span>
              <span className="text-[11px] text-muted print:text-gray-600">ChatGPT & Perplexity</span>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-line print:border-gray-300 print:bg-white">
              <span className="text-xs text-muted print:text-gray-600 block">Organik Tıklama</span>
              <span className="text-2xl font-extrabold text-ink print:text-black font-mono block mt-1">
                48.500
              </span>
              <span className="text-[11px] text-evidence font-medium">+%14 Son 30 Gün</span>
            </div>

            <div className="p-4 rounded-xl bg-surface border border-line print:border-gray-300 print:bg-white">
              <span className="text-xs text-muted print:text-gray-600 block">Domain Rating (DR)</span>
              <span className="text-2xl font-extrabold text-ink print:text-black font-mono block mt-1">
                58/100
              </span>
              <span className="text-[11px] text-muted print:text-gray-600">48.5K Backlink</span>
            </div>
          </div>
        </div>

        {/* Multi-Jurisdiction Compliance Shield Status */}
        <div>
          <h4 className="text-sm font-bold text-ink print:text-black uppercase tracking-wider mb-3">
            2. Küresel Mevzuat & Reklam Denetim Kalkanı (4 Bölge)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-evidence/30 bg-evidence/5 print:border-gray-300 print:bg-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">🇹🇷</span>
                <div>
                  <span className="text-xs font-bold text-ink print:text-black block">Türkiye (TR)</span>
                  <span className="text-[10px] text-muted print:text-gray-500">TİTCK & Reklam Kurulu</span>
                </div>
              </div>
              <Badge tone="evidence">Uyumlu</Badge>
            </div>

            <div className="p-3.5 rounded-xl border border-evidence/30 bg-evidence/5 print:border-gray-300 print:bg-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">🇪🇺</span>
                <div>
                  <span className="text-xs font-bold text-ink print:text-black block">Avrupa (EU)</span>
                  <span className="text-[10px] text-muted print:text-gray-500">EmpCo Greenwashing</span>
                </div>
              </div>
              <Badge tone="evidence">Uyumlu</Badge>
            </div>

            <div className="p-3.5 rounded-xl border border-evidence/30 bg-evidence/5 print:border-gray-300 print:bg-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">🇺🇸</span>
                <div>
                  <span className="text-xs font-bold text-ink print:text-black block">ABD (US)</span>
                  <span className="text-[10px] text-muted print:text-gray-500">FTC / FDA / SEC</span>
                </div>
              </div>
              <Badge tone="evidence">Uyumlu</Badge>
            </div>

            <div className="p-3.5 rounded-xl border border-evidence/30 bg-evidence/5 print:border-gray-300 print:bg-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">🌏</span>
                <div>
                  <span className="text-xs font-bold text-ink print:text-black block">Asya (APAC)</span>
                  <span className="text-[10px] text-muted print:text-gray-500">PMDA / SAMR / MAS</span>
                </div>
              </div>
              <Badge tone="evidence">Uyumlu</Badge>
            </div>
          </div>
        </div>

        {/* Top Keywords Ranking Progress */}
        <div>
          <h4 className="text-sm font-bold text-ink print:text-black uppercase tracking-wider mb-3">
            3. Anahtar Kelime Sıralama Değişimleri
          </h4>
          <div className="overflow-x-auto border border-line print:border-gray-300 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle print:bg-gray-100 border-b border-line print:border-gray-300 text-muted print:text-gray-700 font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3">Anahtar Kelime</th>
                  <th className="py-2.5 px-3 text-center">Mevcut Sıra</th>
                  <th className="py-2.5 px-3 text-center">Değişim</th>
                  <th className="py-2.5 px-3 text-right">Aylık Hacim</th>
                  <th className="py-2.5 px-3 text-right">TBM (CPC)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line print:divide-gray-300">
                {[
                  { kw: "yapay zeka seo araçları", pos: 1, ch: "+1", vol: "14.200", cpc: "$24.00" },
                  { kw: "geo generative engine optimization", pos: 2, ch: "0", vol: "6.100", cpc: "$32.50" },
                  { kw: "organik seo uzmanı", pos: 3, ch: "+2", vol: "8.400", cpc: "$18.50" },
                  { kw: "e-ticaret seo kontrol listesi", pos: 7, ch: "+4", vol: "4.800", cpc: "$12.00" },
                  { kw: "teknik seo denetimi nasıl yapılır", pos: 14, ch: "-5", vol: "3.200", cpc: "$9.80" },
                ].map((k, i) => (
                  <tr key={i} className="print:text-black">
                    <td className="py-2.5 px-3 font-semibold text-ink print:text-black">{k.kw}</td>
                    <td className="py-2.5 px-3 text-center font-bold font-mono">#{k.pos}</td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      <span className={k.ch.startsWith("+") ? "text-evidence font-bold" : k.ch === "0" ? "text-muted" : "text-warn"}>
                        {k.ch}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted print:text-black">{k.vol}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-muted print:text-black">{k.cpc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Resolved & Pending Issues Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-line print:border-gray-300">
            <h5 className="text-xs font-bold text-ink print:text-black uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-evidence" /> Bu Dönem Çözülen Problemler (18 Adet)
            </h5>
            <ul className="text-xs text-muted print:text-gray-700 space-y-1.5 list-disc list-inside">
              <li>3 adet kırık kategori URL'si kalıcı 301 yönlendirmesiyle düzeltildi.</li>
              <li>Tüm filtre sayfalarına self-referential rel=canonical etiketleri eklendi.</li>
              <li>Ürün sayfalarına Schema.org Product ve Offer JSON-LD enjekte edildi.</li>
              <li>Hero banner görselleri WebP sıkıştırmasına alındı, LCP 2.1s seviyesine indi.</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl border border-line print:border-gray-300">
            <h5 className="text-xs font-bold text-ink print:text-black uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-warn" /> Gelecek Dönem Aksiyon Planı (4 Görev)
            </h5>
            <ul className="text-xs text-muted print:text-gray-700 space-y-1.5 list-disc list-inside">
              <li>3 adet spam PBN linkinin Google Disavow dosyası ile reddedilmesi.</li>
              <li>Helpful Content için ince blog yazılarının konsolide edilmesi.</li>
              <li>Perplexity ve Claude alıntılarını artırmak için Tanım FAQ blokları eklenmesi.</li>
              <li>Hreflang çok dilli etiketlerin kontrol denetiminin yapılması.</li>
            </ul>
          </div>
        </div>

        {/* Document Footer */}
        <div className="pt-4 border-t border-line print:border-gray-300 flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted print:text-gray-500">
          <p>© {new Date().getFullYear()} {agencyName} • Tüm Hakları Saklıdır.</p>
          <p className="font-mono">Nexus Autonomous SEO Platform v2.4 Enterprise Raporlama</p>
        </div>
      </div>
    </div>
  );
}
