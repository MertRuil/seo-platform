"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  DollarSign,
  TrendingDown,
  Sparkles,
  Send,
  Check,
  Copy,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Globe,
  RefreshCw,
  Briefcase,
  Building,
  Mail,
  Phone,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { MetricStrip } from "@/components/ui/MetricStrip";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { useSite } from "@/context/SiteContext";
import {
  api,
  LeadCardResponse,
  GenerateLeadPayload,
  ExportCrmPayload,
  ExportCrmResponse,
} from "@/lib/api";

export default function LeadsCrmPage() {
  const { site } = useSite();

  const [leads, setLeads] = useState<LeadCardResponse[]>([]);
  const [selectedLead, setSelectedLead] = useState<LeadCardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [lastExportResult, setLastExportResult] = useState<ExportCrmResponse | null>(null);

  // Form State for Prospect Audit
  const [companyName, setCompanyName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [monthlyTraffic, setMonthlyTraffic] = useState(50000);
  const [aov, setAov] = useState(120);
  const [cvr, setCvr] = useState(2.0);

  // Auto-fill from active site if empty
  useEffect(() => {
    if (site) {
      if (!companyName) setCompanyName(site.name || site.domain || "Hedef Müşteri");
      if (!targetUrl) setTargetUrl(site.primary_url || `https://${site.domain}`);
      if (!contactEmail && site.domain) setContactEmail(`pazarlama@${site.domain}`);
    }
  }, [site?.id, site?.name, site?.domain, site?.primary_url]);

  // Load leads from backend
  const loadLeads = async () => {
    if (!site?.organization_id || !site?.id) return;
    setIsLoading(true);
    try {
      const data = await api.getSiteLeads(site.organization_id, site.id);
      setLeads(data);
      if (data.length > 0 && !selectedLead) {
        setSelectedLead(data[0]);
      }
    } catch (err) {
      console.error("Failed to load CRM leads:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [site?.organization_id, site?.id]);

  // Handle Calculate & Generate Lead
  const handleGenerateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!site?.organization_id || !site?.id) return;

    setIsCalculating(true);
    setLastExportResult(null);
    try {
      const payload: GenerateLeadPayload = {
        company_name: companyName.trim() || site.name || "Hedef Müşteri",
        url: targetUrl.trim() || site.primary_url || `https://${site.domain}`,
        contact_name: contactName.trim() || "Firma Yetkilisi",
        contact_email: contactEmail.trim() || `info@${site.domain}`,
        contact_phone: contactPhone.trim() || undefined,
        monthly_traffic: Number(monthlyTraffic),
        average_order_value: Number(aov),
        conversion_rate: Number(cvr) / 100.0,
        currency: "USD",
      };

      const newLead = await api.generateLead(site.organization_id, site.id, payload);
      setLeads((prev) => [newLead, ...prev]);
      setSelectedLead(newLead);
    } catch (err) {
      console.error("Failed to generate lead:", err);
    } finally {
      setIsCalculating(false);
    }
  };

  // Handle Export to Sistem CRM
  const handleExportToCrm = async (leadToExport?: LeadCardResponse) => {
    const lead = leadToExport || selectedLead;
    if (!lead || !site?.organization_id || !site?.id) return;

    setIsExporting(true);
    try {
      const exportPayload: ExportCrmPayload = {
        lead_id: lead.id,
        company_name: lead.company_name,
        contact_name: lead.contact_name || "Yetkili",
        contact_email: lead.contact_email || `info@${site.domain}`,
        contact_phone: lead.contact_phone || undefined,
        target_url: lead.target_url,
        annual_value: lead.metrics.annual_revenue_loss,
        proposal_pitch: lead.proposal_pitch,
        destination_crm: "Sistem CRM",
        custom_notes: `Teknik Sağlık Skoru: ${lead.metrics.health_score}/100. Önerilen Paket: ${lead.recommended_tier}`,
      };

      const res = await api.exportLeadToCrm(site.organization_id, site.id, exportPayload);
      setLastExportResult(res);

      // Update lead in local state
      setLeads((prev) =>
        prev.map((item) =>
          item.id === lead.id
            ? { ...item, crm_status: "synced", crm_lead_id: res.crm_lead_id }
            : item
        )
      );
      if (selectedLead?.id === lead.id) {
        setSelectedLead({
          ...selectedLead,
          crm_status: "synced",
          crm_lead_id: res.crm_lead_id,
        });
      }
    } catch (err) {
      console.error("Export to Sistem CRM failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Copy Pitch
  const handleCopyPitch = () => {
    if (!selectedLead?.proposal_pitch) return;
    navigator.clipboard.writeText(selectedLead.proposal_pitch);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Aggregate metrics
  const totalPipelineLoss = leads.reduce((sum, l) => sum + (l.metrics?.annual_revenue_loss || 0), 0);
  const totalTrafficAtRisk = leads.reduce((sum, l) => sum + (l.metrics?.traffic_at_risk || 0), 0);
  const syncedCount = leads.filter((l) => l.crm_status === "synced").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Müşteri & CRM Köprüsü"
        description="10-Saniyede SEO Denetimi, Finansal Gelir Kaybı Hesaplayıcı ve Sistem CRM Fırsat Aktarımı."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadLeads}
              disabled={isLoading}
              icon={<RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />}
            >
              Yenile
            </Button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
              <Zap className="w-3.5 h-3.5" />
              Sistem CRM Entegrasyonu Aktif
            </div>
          </div>
        }
      />

      {/* Hero Stats */}
      <MetricStrip
        items={[
          {
            label: "Toplam Kayıp Ciro Fırsatı",
            value: `$${totalPipelineLoss.toLocaleString()}`,
            trend: { text: "+%18 Çeyreklik", direction: "up" },
            tone: "critical",
          },
          {
            label: "Tehlikedeki Aylık Trafik",
            value: totalTrafficAtRisk.toLocaleString(),
            hint: "Organik kullanıcı kaybı",
          },
          {
            label: "Sistem CRM'e Aktarılan Leadler",
            value: `${syncedCount} / ${leads.length}`,
            hint: "Dönüştürülen fırsatlar",
            tone: "evidence",
          },
          {
            label: "Kurtarma & ROI Potansiyeli",
            value: "%85",
            trend: { text: "14 Günlük Hedef", direction: "up" },
          },
        ]}
      />

      {/* Main 2-Column Section: Calculator & Proposal Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Instant Audit & Loss Calculator */}
        <div className="lg:col-span-6 space-y-6">
          <Panel
            title="10-Saniyede Müşteri Denetimi & Gelir Kaybı Hesaplayıcı"
            actions={<Badge tone="accent">Lead Magnet Motoru</Badge>}
          >
            <form onSubmit={handleGenerateLead} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="companyName">Şirket / Müşteri Adı</Label>
                  <Input
                    id="companyName"
                    icon={<Building className="w-3.5 h-3.5" />}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Örn: Mega Retail A.Ş."
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="targetUrl">Web Sitesi / Domain</Label>
                  <Input
                    id="targetUrl"
                    icon={<Globe className="w-3.5 h-3.5" />}
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://example.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="contactName">Yetkili Kişi</Label>
                  <Input
                    id="contactName"
                    icon={<Users className="w-3.5 h-3.5" />}
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Örn: Ahmet Yılmaz"
                  />
                </div>
                <div>
                  <Label htmlFor="contactEmail">İletişim E-Postası</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    icon={<Mail className="w-3.5 h-3.5" />}
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="ahmet@firma.com"
                  />
                </div>
                <div>
                  <Label htmlFor="contactPhone">Telefon (İsteğe Bağlı)</Label>
                  <Input
                    id="contactPhone"
                    icon={<Phone className="w-3.5 h-3.5" />}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+90 532 000 0000"
                  />
                </div>
              </div>

              {/* Sliders for Loss Parameters */}
              <div className="pt-3 border-t border-line space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1">
                    <span className="text-muted">Aylık Organik Ziyaretçi:</span>
                    <span className="text-ink font-semibold">{Number(monthlyTraffic).toLocaleString()} ziyaretçi/ay</span>
                  </div>
                  <input
                    type="range"
                    min="5000"
                    max="500000"
                    step="5000"
                    value={monthlyTraffic}
                    onChange={(e) => setMonthlyTraffic(Number(e.target.value))}
                    className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-muted">Ortalama Sipariş:</span>
                      <span className="text-ink font-semibold">${aov}</span>
                    </div>
                    <input
                      type="range"
                      min="20"
                      max="1000"
                      step="10"
                      value={aov}
                      onChange={(e) => setAov(Number(e.target.value))}
                      className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1">
                      <span className="text-muted">Dönüşüm Oranı:</span>
                      <span className="text-ink font-semibold">%{cvr}</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="6.0"
                      step="0.1"
                      value={cvr}
                      onChange={(e) => setCvr(Number(e.target.value))}
                      className="w-full h-1.5 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isCalculating}
                  variant="primary"
                  className="w-full gap-2 font-semibold py-2.5"
                  icon={<Sparkles className={`w-4 h-4 ${isCalculating ? "animate-spin" : ""}`} />}
                >
                  {isCalculating ? "Denetim ve Kayıp Hesaplanıyor..." : "🎯 Finansal Kaybı Hesapla & Lead Kartı Oluştur"}
                </Button>
              </div>
            </form>
          </Panel>
        </div>

        {/* Right Column: Financial Impact Card & Proposal Pitch */}
        <div className="lg:col-span-6 space-y-6">
          {selectedLead ? (
            <Panel
              title={`${selectedLead.company_name} - Finansal Etki & Teklif Kartı`}
              actions={
                selectedLead.crm_status === "synced" ? (
                  <Badge tone="evidence">Sistem CRM Senkronize</Badge>
                ) : (
                  <Badge tone="warn">CRM'e Aktarılmayı Bekliyor</Badge>
                )
              }
            >
              <div className="space-y-4 pt-1">
                {/* Financial Loss Callout Banner */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-rose-500/10 via-amber-500/5 to-transparent border border-rose-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider font-semibold text-rose-400 flex items-center gap-1.5">
                      <TrendingDown className="w-4 h-4" /> Yıllık Tahmini Gelir Kaybı
                    </div>
                    <div className="text-3xl font-extrabold text-ink mt-1">
                      ${selectedLead.metrics.annual_revenue_loss.toLocaleString()}
                      <span className="text-xs font-normal text-muted ml-2">
                        (${(selectedLead.metrics.monthly_revenue_loss).toLocaleString()} / ay)
                      </span>
                    </div>
                    <div className="text-xs text-muted mt-1">
                      Teknik SEO ve GEO şema eksikliği nedeniyle kaybedilen potansiyel ciro
                    </div>
                  </div>
                  <div className="text-center sm:text-right px-4 py-2 rounded-lg bg-surface border border-line">
                    <div className="text-xs text-muted">Sağlık Skoru</div>
                    <div className="text-2xl font-bold text-amber-500">{selectedLead.metrics.health_score}/100</div>
                    <div className="text-[11px] text-muted">Kritik Risk</div>
                  </div>
                </div>

                {/* Top Critical Barriers */}
                <div>
                  <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Tespit Edilen Kritik Teknik ve GEO Bariyerleri
                  </h4>
                  <div className="space-y-1.5">
                    {selectedLead.metrics.critical_barriers.map((barrier, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-surface-2 text-xs text-ink">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                        <span>{barrier}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Proposal Pitch Text */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-accent" /> Müşteri Sunum & Teklif Metni (Executive Pitch)
                    </h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyPitch}
                      className="h-7 text-xs text-accent"
                      icon={isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    >
                      {isCopied ? "Kopyalandı!" : "Metni Kopyala"}
                    </Button>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-2 border border-line text-xs text-ink font-mono leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto">
                    {selectedLead.proposal_pitch}
                  </div>
                </div>

                {/* Export Feedback Banner */}
                {lastExportResult && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{lastExportResult.message} (CRM Lead ID: <b>{lastExportResult.crm_lead_id}</b>)</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <Button
                    onClick={() => handleExportToCrm(selectedLead)}
                    disabled={isExporting}
                    variant="evidence"
                    className="flex-1 gap-2 font-medium py-2"
                    icon={<Send className={`w-4 h-4 ${isExporting ? "animate-spin" : ""}`} />}
                  >
                    {isExporting ? "Sistem CRM'e Aktarılıyor..." : "⚡ Sistem CRM'e Aktar"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleCopyPitch}
                    icon={<Copy className="w-4 h-4" />}
                  >
                    Teklifi Kopyala
                  </Button>
                </div>
              </div>
            </Panel>
          ) : (
            <Panel title="Finansal Etki & Teklif Kartı">
              <div className="p-12 text-center text-muted text-sm">
                Sol taraftaki hesaplayıcıyı kullanarak veya aşağıdaki listeden bir müşteri seçerek finansal kayıp ve teklif kartını görüntüleyin.
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* Leads Table / Pipeline List */}
      <Panel
        title="Müşteri & Fırsat Havuzu (Lead Pipeline)"
        actions={<Badge tone="neutral">{leads.length} Aday Firma</Badge>}
      >
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-2 text-muted uppercase tracking-wider font-semibold border-b border-line">
              <tr>
                <th className="py-3 px-4">Şirket / Domain</th>
                <th className="py-3 px-4">İletişim Kişisi</th>
                <th className="py-3 px-4">Aylık Trafik</th>
                <th className="py-3 px-4">Yıllık Kayıp Değer</th>
                <th className="py-3 px-4">Önerilen Hizmet</th>
                <th className="py-3 px-4">CRM Durumu</th>
                <th className="py-3 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {leads.map((lead) => {
                const isSelected = selectedLead?.id === lead.id;
                return (
                  <tr
                    key={lead.id}
                    onClick={() => {
                      setSelectedLead(lead);
                      setLastExportResult(null);
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-accent/10 border-l-2 border-l-accent" : "hover:bg-surface-2"
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-ink flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-accent" />
                        {lead.company_name}
                      </div>
                      <div className="text-[11px] text-muted">{lead.target_url}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-ink">{lead.contact_name || "Yetkili"}</div>
                      <div className="text-[11px] text-muted">{lead.contact_email}</div>
                    </td>
                    <td className="py-3 px-4 text-ink font-medium">
                      {lead.metrics.monthly_traffic.toLocaleString()} / ay
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-rose-500">
                        ${lead.metrics.annual_revenue_loss.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-surface-2 text-ink text-[11px] border border-line">
                        {lead.recommended_tier}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {lead.crm_status === "synced" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                          <Check className="w-3 h-3" /> Sistem CRM'de
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-500 font-medium">
                          Taslak
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant={isSelected ? "primary" : "secondary"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLead(lead);
                          handleExportToCrm(lead);
                        }}
                        className="h-7 text-xs"
                        icon={<Send className="w-3 h-3" />}
                      >
                        CRM'e Gönder
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
