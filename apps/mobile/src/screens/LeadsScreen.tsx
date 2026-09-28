import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";
import { fetchLeads, generateLead, exportLeadToCrm } from "../services/api";
import { LeadCard } from "../types";

export const LeadsScreen: React.FC = () => {
  const { selectedSite, setActiveTab } = useApp();
  const [activeSegment, setActiveSegment] = useState<"AUDIT" | "LEADS" | "PITCH">("AUDIT");

  const [leads, setLeads] = useState<LeadCard[]>([]);
  const [activeLead, setActiveLead] = useState<LeadCard | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedPitch, setCopiedPitch] = useState<boolean>(false);

  // Quick Calculator States
  const [calcUrl, setCalcUrl] = useState<string>(selectedSite?.primary_url || "https://acmestore.io");
  const [calcTraffic, setCalcTraffic] = useState<string>("85000");
  const [calcAov, setCalcAov] = useState<string>("145");
  const [calcCvr, setCalcCvr] = useState<string>("2.4");
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // New Lead Modal
  const [leadModal, setLeadModal] = useState<boolean>(false);
  const [modalCompany, setModalCompany] = useState<string>("");
  const [modalContact, setModalContact] = useState<string>("");
  const [modalEmail, setModalEmail] = useState<string>("");
  const [modalPhone, setModalPhone] = useState<string>("");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadLeads();
  }, [selectedSite?.id]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const data = await fetchLeads(selectedSite?.id);
      setLeads(data);
      if (data.length > 0 && !activeLead) {
        setActiveLead(data[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculate = async () => {
    setIsCalculating(true);
    try {
      const trafficNum = parseInt(calcTraffic, 10) || 50000;
      const aovNum = parseFloat(calcAov) || 120;
      const cvrNum = (parseFloat(calcCvr) || 2.0) / 100;

      const created = await generateLead(selectedSite?.id || "site-1", {
        url: calcUrl,
        company_name: selectedSite?.name || "Potansiyel Müşteri",
        monthly_traffic: trafficNum,
        average_order_value: aovNum,
        conversion_rate: cvrNum,
        currency: "USD"
      });

      setLeads(prev => [created, ...prev]);
      setActiveLead(created);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleExportToCrm = async (lead: LeadCard) => {
    setIsExporting(true);
    setExportSuccessMsg(null);
    try {
      const res = await exportLeadToCrm(selectedSite?.id || "site-1", {
        lead_id: lead.id,
        company_name: lead.company_name,
        contact_name: lead.contact_name || "Yetkili",
        contact_email: lead.contact_email || "lead@sirket.com",
        contact_phone: lead.contact_phone,
        target_url: lead.target_url,
        annual_value: lead.metrics.annual_revenue_loss,
        proposal_pitch: lead.proposal_pitch,
        destination_crm: "Sistem CRM"
      });

      if (res && res.success) {
        setExportSuccessMsg(res.message);
        setLeads(prev =>
          prev.map(l =>
            l.id === lead.id
              ? { ...l, crm_status: "synced", crm_lead_id: res.crm_lead_id }
              : l
          )
        );
        if (activeLead?.id === lead.id) {
          setActiveLead({
            ...activeLead,
            crm_status: "synced",
            crm_lead_id: res.crm_lead_id
          });
        }
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyPitch = () => {
    const pitch = activeLead?.proposal_pitch || "";
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(pitch);
    }
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2500);
  };

  const currentMetrics = activeLead?.metrics || {
    health_score: 64,
    monthly_traffic: 85000,
    conversion_rate: 0.024,
    average_order_value: 145,
    traffic_at_risk: 12240,
    monthly_revenue_loss: 42595,
    annual_revenue_loss: 511140,
    critical_barriers: [
      "Kritik sayfalarda eksik rel=canonical ve kopya indeks sinyali",
      "Perplexity ve ChatGPT aramalarında %0 görünürlük",
      "Mobil LCP 4.2s (Yüksek hemen çıkma oranı)"
    ],
    top_quick_wins: [
      "Otonom Canonical ve JSON-LD Schema Enjeksiyonu (+18 Sağlık)",
      "AEO Tanım Blokları ile ChatGPT'de 1. Sırada Atıf Alınması"
    ],
    currency: "USD"
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconRing}>
            <Ionicons name="briefcase-outline" size={18} color="#10B981" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Sistem CRM & Lead Köprüsü</Text>
            <Text style={styles.headerSub}>Finansal Kayıp Analizi & Teklif Motoru</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setLeadModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Segment Selector */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "AUDIT" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("AUDIT")}
        >
          <Text style={[styles.segmentText, activeSegment === "AUDIT" && styles.segmentTextActive]}>
            Kayıp Analizi
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "LEADS" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("LEADS")}
        >
          <Text style={[styles.segmentText, activeSegment === "LEADS" && styles.segmentTextActive]}>
            CRM Havuzu ({leads.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "PITCH" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("PITCH")}
        >
          <Text style={[styles.segmentText, activeSegment === "PITCH" && styles.segmentTextActive]}>
            Yönetici Teklifi
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* SEGMENT 1: FINANCIAL LOSS AUDIT */}
        {activeSegment === "AUDIT" && (
          <>
            {/* Big Revenue Loss Card */}
            <LinearGradient colors={["#064E3B", "#0F172A"]} style={styles.lossCard}>
              <View style={styles.lossTop}>
                <View>
                  <Text style={styles.lossBadge}>10-SANİYEDE FİNANSAL KAYIP TESPİTİ</Text>
                  <Text style={styles.lossAmount}>
                    ${currentMetrics.annual_revenue_loss.toLocaleString()}
                  </Text>
                  <Text style={styles.lossSub}>Yıllık Kaçırılan Tahmini Organik Ciro</Text>
                </View>
                <View style={styles.healthScoreBox}>
                  <Text style={styles.healthScoreNum}>{currentMetrics.health_score}</Text>
                  <Text style={styles.healthScoreLbl}>SEO Sağlık</Text>
                </View>
              </View>

              <View style={styles.lossMetricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricVal}>
                    ${currentMetrics.monthly_revenue_loss.toLocaleString()}
                  </Text>
                  <Text style={styles.metricLbl}>Aylık Kayıp Ciro</Text>
                </View>
                <View style={styles.metricDiv} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricVal}>
                    {currentMetrics.traffic_at_risk.toLocaleString()}
                  </Text>
                  <Text style={styles.metricLbl}>Riskli Ziyaretçi</Text>
                </View>
                <View style={styles.metricDiv} />
                <View style={styles.metricItem}>
                  <Text style={[styles.metricVal, { color: "#34D399" }]}>
                    %{(currentMetrics.conversion_rate * 100).toFixed(1)}
                  </Text>
                  <Text style={styles.metricLbl}>Dönüşüm Oranı</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Quick Audit Parameter Calculator */}
            <GlassCard style={styles.calcCard}>
              <View style={styles.calcHeader}>
                <Ionicons name="calculator-outline" size={18} color="#10B981" />
                <Text style={styles.calcTitle}>Müşteri Trafik & Sepet Parametreleri</Text>
              </View>

              <View style={styles.calcInputGroup}>
                <Text style={styles.calcInputLbl}>Hedef Web Sitesi / URL</Text>
                <TextInput
                  style={styles.calcInput}
                  value={calcUrl}
                  onChangeText={setCalcUrl}
                  placeholder="https://musteri.com"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={styles.calcGrid}>
                <View style={styles.calcCol}>
                  <Text style={styles.calcInputLbl}>Aylık Organik Trafik</Text>
                  <TextInput
                    style={styles.calcInput}
                    value={calcTraffic}
                    onChangeText={setCalcTraffic}
                    keyboardType="numeric"
                    placeholder="85000"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <View style={styles.calcCol}>
                  <Text style={styles.calcInputLbl}>Ort. Sepet Tutarı ($)</Text>
                  <TextInput
                    style={styles.calcInput}
                    value={calcAov}
                    onChangeText={setCalcAov}
                    keyboardType="numeric"
                    placeholder="145"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
              </View>

              <View style={styles.calcGrid}>
                <View style={styles.calcCol}>
                  <Text style={styles.calcInputLbl}>Organik CVR (%)</Text>
                  <TextInput
                    style={styles.calcInput}
                    value={calcCvr}
                    onChangeText={setCalcCvr}
                    keyboardType="numeric"
                    placeholder="2.4"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>

                <View style={[styles.calcCol, { justifyContent: "flex-end" }]}>
                  <TouchableOpacity
                    style={styles.recalcBtn}
                    onPress={handleRecalculate}
                    disabled={isCalculating}
                    activeOpacity={0.8}
                  >
                    {isCalculating ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="flash" size={14} color="#FFFFFF" />
                        <Text style={styles.recalcBtnText}>Yeniden Hesapla</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </GlassCard>

            {/* Critical Barriers */}
            <Text style={styles.sectionHeader}>En Kritik SEO & GEO Bariyerleri</Text>
            {currentMetrics.critical_barriers.map((bar, idx) => (
              <GlassCard key={idx} style={styles.barrierCard}>
                <View style={styles.barrierIconBox}>
                  <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                </View>
                <Text style={styles.barrierText}>{bar}</Text>
              </GlassCard>
            ))}

            {/* Quick Wins */}
            <Text style={styles.sectionHeader}>Öncelikli Hızlı Kazanımlar (Quick Wins)</Text>
            {currentMetrics.top_quick_wins.map((win, idx) => (
              <GlassCard key={idx} style={styles.winCard}>
                <View style={styles.winIconBox}>
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                </View>
                <Text style={styles.winText}>{win}</Text>
              </GlassCard>
            ))}

            {/* Quick 1-Click Action */}
            <TouchableOpacity
              style={styles.actionCrmBtn}
              onPress={() => activeLead && handleExportToCrm(activeLead)}
              disabled={isExporting || !activeLead}
              activeOpacity={0.8}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={18} color="#FFFFFF" />
                  <Text style={styles.actionCrmBtnText}>⚡ Sistem CRM'e 1-Tıkla Aktar</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* SEGMENT 2: CRM LEADS LIST */}
        {activeSegment === "LEADS" && (
          <>
            <View style={styles.leadHeaderRow}>
              <Text style={styles.sectionHeader}>Müşteri Adayları & Senkronizasyon Durumu</Text>
            </View>

            {exportSuccessMsg && (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.successBannerText}>{exportSuccessMsg}</Text>
              </View>
            )}

            {loading ? (
              <ActivityIndicator size="small" color="#10B981" style={{ marginVertical: 20 }} />
            ) : leads.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <Ionicons name="people-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>Henüz Lead Kaydı Bulunmuyor</Text>
                <Text style={styles.emptyDesc}>Yeni bir denetim çalıştırarak müşteri adayı oluşturun.</Text>
              </GlassCard>
            ) : (
              leads.map((lead) => {
                const isSelected = activeLead?.id === lead.id;
                const isSynced = lead.crm_status === "synced";

                return (
                  <GlassCard
                    key={lead.id}
                    style={[styles.leadCard, isSelected && styles.leadCardSelected]}
                    onPress={() => setActiveLead(lead)}
                  >
                    <View style={styles.leadTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.leadCompany}>{lead.company_name}</Text>
                        <Text style={styles.leadContact}>
                          {lead.contact_name || "Yetkili"} • {lead.contact_email || "E-posta yok"}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.crmBadge,
                          {
                            backgroundColor: isSynced
                              ? "rgba(16, 185, 129, 0.15)"
                              : "rgba(245, 158, 11, 0.15)",
                            borderColor: isSynced
                              ? "rgba(16, 185, 129, 0.35)"
                              : "rgba(245, 158, 11, 0.35)"
                          }
                        ]}
                      >
                        <Text
                          style={[
                            styles.crmBadgeText,
                            { color: isSynced ? "#10B981" : "#F59E0B" }
                          ]}
                        >
                          {isSynced ? "SİSTEM CRM SENKRON" : "TASLAK LEAD"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.leadStatsRow}>
                      <View style={styles.leadStatCol}>
                        <Text style={styles.leadStatNum}>
                          ${lead.metrics.annual_revenue_loss.toLocaleString()}
                        </Text>
                        <Text style={styles.leadStatLbl}>Kayıp Ciro / Yıl</Text>
                      </View>

                      <View style={styles.leadStatCol}>
                        <Text style={styles.leadStatNum}>{lead.metrics.health_score}/100</Text>
                        <Text style={styles.leadStatLbl}>Sağlık Skoru</Text>
                      </View>

                      <View style={styles.leadStatCol}>
                        <Text style={styles.leadStatNum}>{lead.metrics.traffic_at_risk.toLocaleString()}</Text>
                        <Text style={styles.leadStatLbl}>Riskli Trafik</Text>
                      </View>
                    </View>

                    <View style={styles.leadActionsRow}>
                      <TouchableOpacity
                        style={styles.pitchQuickBtn}
                        onPress={() => {
                          setActiveLead(lead);
                          setActiveSegment("PITCH");
                        }}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="document-text-outline" size={14} color={Colors.primary} />
                        <Text style={styles.pitchQuickBtnText}>Teklifi Gör</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.crmSyncBtn,
                          isSynced && { backgroundColor: "rgba(16, 185, 129, 0.18)" }
                        ]}
                        onPress={() => handleExportToCrm(lead)}
                        disabled={isExporting}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={isSynced ? "cloud-done" : "cloud-upload"}
                          size={14}
                          color={isSynced ? "#10B981" : "#FFFFFF"}
                        />
                        <Text
                          style={[
                            styles.crmSyncBtnText,
                            isSynced && { color: "#10B981" }
                          ]}
                        >
                          {isSynced ? "Yeniden Senkronize Et" : "⚡ Sistem CRM'e Gönder"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </GlassCard>
                );
              })
            )}
          </>
        )}

        {/* SEGMENT 3: EXECUTIVE PITCH */}
        {activeSegment === "PITCH" && (
          <>
            <GlassCard style={styles.pitchIntroCard}>
              <View style={styles.pitchHeaderRow}>
                <Ionicons name="newspaper-outline" size={20} color="#10B981" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pitchTitle}>Otomatik Yönetici Teklif Metni</Text>
                  <Text style={styles.pitchSub}>
                    Müşteri karar vericisine sunulmak üzere üretilmiş hazır teklif metni
                  </Text>
                </View>
              </View>
            </GlassCard>

            <GlassCard style={styles.pitchBodyCard}>
              <Text style={styles.pitchContent}>
                {activeLead?.proposal_pitch ||
                  "Lütfen sol taraftan bir müşteri adayı seçerek teklif metnini inceleyin."}
              </Text>
            </GlassCard>

            <View style={styles.pitchButtonRow}>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={handleCopyPitch}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={copiedPitch ? "checkmark-done" : "copy-outline"}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.copyBtnText}>
                  {copiedPitch ? "Panoya Kopyalandı!" : "Metni Kopyala"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.crmBridgeBtn}
                onPress={() => activeLead && handleExportToCrm(activeLead)}
                disabled={isExporting || !activeLead}
                activeOpacity={0.8}
              >
                <Ionicons name="send" size={16} color="#FFFFFF" />
                <Text style={styles.crmBridgeBtnText}>Sistem CRM'e Aktar</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* New Lead Modal */}
      <Modal
        visible={leadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setLeadModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yeni Müşteri Lead Kartı</Text>
            <Text style={styles.modalSub}>
              Sistem CRM'e aktarılmak üzere müşteri adayı bilgilerini doldurun:
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Şirket / Marka Adı (Örn: Hedef Teknoloji)"
              placeholderTextColor={Colors.textMuted}
              value={modalCompany}
              onChangeText={setModalCompany}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Yetkili Kişi (Örn: Burak Kaya)"
              placeholderTextColor={Colors.textMuted}
              value={modalContact}
              onChangeText={setModalContact}
            />

            <TextInput
              style={styles.modalInput}
              placeholder="E-posta Adresi (Örn: burak@hedef.com)"
              placeholderTextColor={Colors.textMuted}
              value={modalEmail}
              onChangeText={setModalEmail}
              keyboardType="email-address"
            />

            <TextInput
              style={styles.modalInput}
              placeholder="Telefon Numarası (Örn: +90 532 000 0000)"
              placeholderTextColor={Colors.textMuted}
              value={modalPhone}
              onChangeText={setModalPhone}
              keyboardType="phone-pad"
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setLeadModal(false)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSubmitBtn,
                  !modalCompany.trim() && { opacity: 0.5 }
                ]}
                disabled={!modalCompany.trim()}
                onPress={async () => {
                  const created = await generateLead(selectedSite?.id || "site-1", {
                    company_name: modalCompany.trim(),
                    contact_name: modalContact.trim(),
                    contact_email: modalEmail.trim(),
                    contact_phone: modalPhone.trim(),
                    url: calcUrl,
                    monthly_traffic: parseInt(calcTraffic, 10) || 50000,
                    average_order_value: parseFloat(calcAov) || 120,
                    conversion_rate: (parseFloat(calcCvr) || 2.0) / 100,
                    currency: "USD"
                  });
                  setLeads(prev => [created, ...prev]);
                  setActiveLead(created);
                  setLeadModal(false);
                  setModalCompany("");
                  setModalContact("");
                  setModalEmail("");
                  setModalPhone("");
                  setActiveSegment("LEADS");
                }}
              >
                <Text style={styles.modalSubmitText}>Lead Oluştur</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconRing: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  segmentRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    backgroundColor: Colors.surface,
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  segmentBtnActive: {
    borderColor: "#10B981",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  segmentTextActive: {
    color: "#10B981",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  lossCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  lossTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  lossBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#34D399",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  lossAmount: {
    fontSize: 28,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  lossSub: {
    fontSize: 11,
    color: "#A7F3D0",
    marginTop: 2,
  },
  healthScoreBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#34D399",
  },
  healthScoreNum: {
    fontSize: 20,
    fontWeight: "800",
    color: "#34D399",
  },
  healthScoreLbl: {
    fontSize: 8,
    color: Colors.textMuted,
    marginTop: -2,
  },
  lossMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    paddingVertical: 10,
    borderRadius: 12,
  },
  metricItem: {
    alignItems: "center",
  },
  metricVal: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  metricLbl: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  metricDiv: {
    width: 1,
    height: 22,
    backgroundColor: Colors.borderSubtle,
  },
  calcCard: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  calcHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  calcTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  calcInputGroup: {
    gap: 4,
  },
  calcInputLbl: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  calcInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: Colors.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  calcGrid: {
    flexDirection: "row",
    gap: 10,
  },
  calcCol: {
    flex: 1,
    gap: 4,
  },
  recalcBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#10B981",
    height: 38,
    borderRadius: 10,
  },
  recalcBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 6,
  },
  barrierCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  barrierIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  barrierText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 17,
  },
  winCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#10B981",
  },
  winIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  winText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 17,
  },
  actionCrmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  actionCrmBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  leadHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  successBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#34D399",
    fontWeight: "600",
  },
  emptyCard: {
    padding: 30,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
  },
  leadCard: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  leadCardSelected: {
    borderColor: "#10B981",
    backgroundColor: "rgba(16, 185, 129, 0.05)",
  },
  leadTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  leadCompany: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  leadContact: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  crmBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  crmBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  leadStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 12,
  },
  leadStatCol: {
    alignItems: "center",
    flex: 1,
  },
  leadStatNum: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  leadStatLbl: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2,
  },
  leadActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  pitchQuickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  pitchQuickBtnText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "600",
  },
  crmSyncBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#10B981",
    paddingVertical: 8,
    borderRadius: 10,
  },
  crmSyncBtnText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  pitchIntroCard: {
    padding: 16,
    borderRadius: 16,
  },
  pitchHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pitchTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  pitchSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  pitchBodyCard: {
    padding: 16,
    borderRadius: 16,
  },
  pitchContent: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 21,
  },
  pitchButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  copyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingVertical: 12,
    borderRadius: 12,
  },
  copyBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  crmBridgeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#10B981",
    paddingVertical: 12,
    borderRadius: 12,
  },
  crmBridgeBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
    lineHeight: 17,
  },
  modalInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: Colors.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  modalSubmitBtn: {
    backgroundColor: "#10B981",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  modalSubmitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
