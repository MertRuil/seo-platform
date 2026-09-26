import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  TextInput,
  Switch,
  Platform,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";
import { fetchReports } from "../services/api";
import { SeoReportSummary } from "../types";

export const ReportsScreen: React.FC = () => {
  const { selectedSite, setActiveTab } = useApp();
  const [reports, setReports] = useState<SeoReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"GÜNLÜK" | "HAFTALIK" | "AYLIK">("HAFTALIK");

  // Whitelabel States
  const [showWhitelabelSettings, setShowWhitelabelSettings] = useState(false);
  const [isWhitelabelActive, setIsWhitelabelActive] = useState(false);
  const [agencyName, setAgencyName] = useState("Dijital Büyüme Ajansı");
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    if (selectedSite) {
      setLoading(true);
      setClientName(selectedSite.name || selectedSite.domain || "Müşteri Firma");
      fetchReports(selectedSite.id, selectedSite.domain, selectedSite.name)
        .then(setReports)
        .finally(() => setLoading(false));
    }
  }, [selectedSite?.id, selectedSite?.name, selectedSite?.domain]);

  const activeReport = reports.find(r => r.period_label === selectedPeriod) || reports[0];

  const handleShare = async (rep: SeoReportSummary, isPdfSummary: boolean = false) => {
    try {
      const site = clientName.trim() || selectedSite?.name || selectedSite?.domain || "Web Siteniz";
      const domain = selectedSite?.domain || "";
      const headerTitle = isWhitelabelActive ? `${agencyName} | SEO & GEO Performans Raporu` : `📊 SEO & GEO Performans Raporu`;
      const footer = isWhitelabelActive 
        ? `Hazırlayan: ${agencyName} | Müşteri: ${site}\nGizli & Özel Analiz Belgesi`
        : `Otonom SEO Platformu Mobil Raporu`;

      const text = `${headerTitle} (${rep.period_label})
🌐 Müşteri / Site: ${site}${domain ? ` (${domain})` : ""}
📅 Tarih Aralığı: ${rep.date_range}
🎯 Genel SEO Skoru: ${rep.overall_score}/100 (+${rep.score_change} puan)
⚡ Organik Tıklama: ${rep.organic_clicks.toLocaleString()} (+%${rep.clicks_change_pct})
📈 Kazanılan Kelimeler: +${rep.top_keywords_gained}
🤖 GEO & AI Skoru: ${rep.geo_score}/100
🛠️ Çözülen Problemler: ${rep.issues_resolved} adet

📝 Yönetici Özeti:
"${rep.executive_summary}"

${footer}`;

      await Share.share({
        title: `${site} SEO Raporu`,
        message: text,
      });
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setActiveTab("hub")} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SEO & GEO Raporları</Text>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => activeReport && handleShare(activeReport)}
          activeOpacity={0.7}
        >
          <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Active Client Bar */}
      <View style={styles.activeClientBar}>
        <Ionicons name="business-outline" size={13} color={Colors.primary} />
        <Text style={styles.activeClientText} numberOfLines={1}>
          Raporlanan Müşteri:{" "}
          <Text style={styles.activeClientBold}>
            {clientName.trim() || selectedSite?.name || selectedSite?.domain || "Müşteri Firma"}
          </Text>
          {selectedSite?.domain ? ` • ${selectedSite.domain}` : ""}
        </Text>
      </View>

      {/* Period Selector Chips */}
      <View style={styles.periodRow}>
        {(["GÜNLÜK", "HAFTALIK", "AYLIK"] as const).map((p) => {
          const isActive = selectedPeriod === p;
          return (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, isActive && styles.periodBtnActive]}
              onPress={() => setSelectedPeriod(p)}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodText, isActive && styles.periodTextActive]}>
                {p}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading || !activeReport ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 30 }} />
        ) : (
          <>
            {/* Top Score Card */}
            <GlassCard style={styles.scoreCard}>
              <View style={styles.scoreRow}>
                <View>
                  <Text style={styles.periodBadge}>{activeReport.period_label} RAPOR</Text>
                  <Text style={styles.dateRangeText}>{activeReport.date_range}</Text>
                </View>
                <View style={styles.scoreCircle}>
                  <Text style={styles.scoreNum}>{activeReport.overall_score}</Text>
                  <Text style={styles.scoreChange}>+{activeReport.score_change} Puan</Text>
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>{activeReport.organic_clicks.toLocaleString()}</Text>
                  <Text style={styles.statLbl}>Organik Tıklama (+%{activeReport.clicks_change_pct})</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNum}>+{activeReport.top_keywords_gained}</Text>
                  <Text style={styles.statLbl}>Kazanılan Kelime</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statNum, { color: Colors.accent }]}>{activeReport.geo_score}</Text>
                  <Text style={styles.statLbl}>GEO AI Görünürlük</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statNum, { color: Colors.success }]}>{activeReport.issues_resolved}</Text>
                  <Text style={styles.statLbl}>Çözülen Problem</Text>
                </View>
              </View>
            </GlassCard>

            {/* AI Executive Summary */}
            <GlassCard style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons name="sparkles" size={16} color={Colors.primary} />
                <Text style={styles.summaryTitle}>AI Yönetici Özeti</Text>
              </View>
              <Text style={styles.summaryBody}>{activeReport.executive_summary}</Text>
            </GlassCard>

            {/* Whitelabel Customization Section */}
            <GlassCard style={styles.whitelabelCard}>
              <View style={styles.whitelabelHeaderRow}>
                <View style={styles.whitelabelTitleGroup}>
                  <Ionicons name="business-outline" size={17} color={Colors.primary} />
                  <Text style={styles.whitelabelTitle}>Ajans Whitelabel Rapor Modu</Text>
                </View>
                <Switch
                  value={isWhitelabelActive}
                  onValueChange={setIsWhitelabelActive}
                  trackColor={{ false: Colors.borderSubtle, true: Colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {isWhitelabelActive && (
                <View style={styles.whitelabelInputsContainer}>
                  <Text style={styles.whitelabelDesc}>
                    Platform logoları gizlenir; rapor başlığı ve dipnotu ajansınıza özel olarak düzenlenir.
                  </Text>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Ajans Adı</Text>
                    <TextInput
                      style={styles.textInput}
                      value={agencyName}
                      onChangeText={setAgencyName}
                      placeholder="Örn: Büyüme Ajansı A.Ş."
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <View style={styles.inputLabelRow}>
                      <Text style={styles.inputLabel}>Müşteri Firma Adı</Text>
                      {selectedSite && clientName.trim() !== (selectedSite.name || selectedSite.domain) && (
                        <TouchableOpacity
                          onPress={() => setClientName(selectedSite.name || selectedSite.domain || "Müşteri Firma")}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.resetLabelBtn}>Site Adına Dönüştür</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      style={styles.textInput}
                      value={clientName}
                      onChangeText={setClientName}
                      placeholder={selectedSite?.name || "Örn: E-Ticaret Markası"}
                      placeholderTextColor={Colors.textMuted}
                    />
                  </View>
                </View>
              )}
            </GlassCard>

            {/* Share / Export Actions */}
            <View style={styles.exportRow}>
              <TouchableOpacity
                style={styles.exportBtnPrimary}
                onPress={() => handleShare(activeReport, false)}
                activeOpacity={0.8}
              >
                <Ionicons name="share-social-outline" size={16} color="#FFFFFF" />
                <Text style={styles.exportBtnText}>
                  {isWhitelabelActive ? "Whitelabel Raporu Paylaş" : "Raporu Paylaş / Gönder"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.exportBtnSecondary}
                onPress={() => handleShare(activeReport, true)}
                activeOpacity={0.8}
              >
                <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
                <Text style={styles.exportBtnSecText}>Metin Özeti</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
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
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  shareBtn: {
    padding: 6,
  },
  activeClientBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  activeClientText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  activeClientBold: {
    color: Colors.textPrimary,
    fontWeight: "700",
  },
  periodRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    backgroundColor: Colors.surface,
  },
  periodBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  periodBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
  },
  periodText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  periodTextActive: {
    color: Colors.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  scoreCard: {
    padding: 18,
    borderRadius: 18,
    gap: 16,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  periodBadge: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  dateRangeText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  scoreCircle: {
    alignItems: "center",
    justifyContent: "center",
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  scoreNum: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  scoreChange: {
    fontSize: 9,
    color: Colors.success,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statBox: {
    flex: 1,
    minWidth: "46%",
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  statNum: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  statLbl: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  summaryCard: {
    padding: 16,
    borderRadius: 16,
    gap: 8,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  summaryBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  exportRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  exportBtnPrimary: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
  },
  exportBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  exportBtnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  exportBtnSecText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  whitelabelCard: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  whitelabelHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  whitelabelTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  whitelabelTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  whitelabelInputsContainer: {
    gap: 10,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
  },
  whitelabelDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resetLabelBtn: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "600",
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  textInput: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: Colors.textPrimary,
  },
});
