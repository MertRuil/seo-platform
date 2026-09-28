import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";
import {
  scanTurkishCompliance,
  scanEuCompliance,
  scanUsCompliance,
  scanAsiaCompliance,
  scanUkCompliance,
  scanMenaCompliance
} from "../services/api";

type RegionKey = "TR" | "EU" | "US" | "UK" | "ASIA" | "MENA";

interface GenericViolation {
  rule_id: string;
  title: string;
  matched_term?: string;
  legal_basis: string;
  penalty_risk: string;
  suggested_fix: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export const ComplianceScreen: React.FC = () => {
  const { setActiveTab } = useApp();
  const [activeRegion, setActiveRegion] = useState<RegionKey>("TR");
  const [inputText, setInputText] = useState<string>(
    "En iyi doktor garantili tedavi eder, hastalıklara son! Türkiye'nin 1 numaralı kliniğinde kesin sonuç."
  );
  const [violations, setViolations] = useState<GenericViolation[]>([]);
  const [hasScanned, setHasScanned] = useState<boolean>(false);

  const REGIONS: Array<{ key: RegionKey; label: string; flag: string; badge: string }> = [
    { key: "TR", label: "Türkiye", flag: "🇹🇷", badge: "TİTCK & TBB" },
    { key: "EU", label: "Avrupa", flag: "🇪🇺", badge: "EmpCo & MiCA" },
    { key: "US", label: "ABD", flag: "🇺🇸", badge: "FTC & FDA" },
    { key: "UK", label: "İngiltere", flag: "🇬🇧", badge: "ASA & CMA" },
    { key: "ASIA", label: "Asya", flag: "🌏", badge: "SAMR & JCAA" },
    { key: "MENA", label: "Orta Doğu", flag: "🇦🇪", badge: "NMC & VARA" },
  ];

  const PRESETS: Record<RegionKey, string> = {
    TR: "En iyi doktor garantili tedavi eder, hastalıklara son! Türkiye'nin 1 numaralı kliniğinde kesin sonuç.",
    EU: "100% eco-friendly net zero product with carbon neutral packaging and guaranteed crypto return.",
    US: "FDA approved miracle cure, guaranteed weight loss in 7 days with honest unbiased reviews.",
    UK: "Buy botox injections online! 100% eco-friendly, only 2 left in stock immediately!",
    ASIA: "国家级最佳产品, JCAA gizli tanıtım ve %100 risksiz MAS kripto getirisi.",
    MENA: "كازينو أونلاين وتوصيل كحول مع علاج نهائي للسكري بدون ترخيص موثوق."
  };

  const handleSelectRegion = (region: RegionKey) => {
    setActiveRegion(region);
    setInputText(PRESETS[region]);
    setViolations([]);
    setHasScanned(false);
  };

  const handleScan = () => {
    if (!inputText.trim()) return;
    setHasScanned(true);

    let found: GenericViolation[] = [];

    if (activeRegion === "TR") {
      const v = scanTurkishCompliance(inputText);
      found = v.map(item => ({
        rule_id: item.rule_id,
        title: item.title,
        matched_term: item.matched_term,
        legal_basis: item.legal_basis,
        penalty_risk: item.penalty_risk,
        suggested_fix: item.suggested_fix,
        severity: item.severity
      }));
    } else if (activeRegion === "EU") {
      const v = scanEuCompliance(inputText);
      found = v.map(item => ({
        rule_id: item.rule_id,
        title: item.title,
        matched_term: item.matched_term,
        legal_basis: item.legal_basis,
        penalty_risk: item.penalty_risk,
        suggested_fix: item.suggested_fix,
        severity: item.severity
      }));
    } else if (activeRegion === "US") {
      const v = scanUsCompliance(inputText);
      found = v.map(item => ({
        rule_id: item.rule_id,
        title: item.title,
        matched_term: item.matched_term,
        legal_basis: item.legal_basis,
        penalty_risk: item.penalty_risk,
        suggested_fix: item.suggested_fix,
        severity: item.severity
      }));
    } else if (activeRegion === "UK") {
      const v = scanUkCompliance(inputText);
      found = v.map(item => ({
        rule_id: item.rule_id,
        title: item.title,
        matched_term: item.matched_term,
        legal_basis: item.legal_basis,
        penalty_risk: item.penalty_risk,
        suggested_fix: item.suggested_fix,
        severity: item.severity
      }));
    } else if (activeRegion === "ASIA") {
      const v = scanAsiaCompliance(inputText);
      found = v.map(item => ({
        rule_id: item.rule_id,
        title: item.title,
        matched_term: item.matched_term,
        legal_basis: item.legal_basis,
        penalty_risk: item.penalty_risk,
        suggested_fix: item.suggested_fix,
        severity: item.severity
      }));
    } else if (activeRegion === "MENA") {
      const v = scanMenaCompliance(inputText);
      found = v.map(item => ({
        rule_id: item.rule_id,
        title: item.title,
        matched_term: item.matched_term,
        legal_basis: item.legal_basis,
        penalty_risk: item.penalty_risk,
        suggested_fix: item.suggested_fix,
        severity: item.severity
      }));
    }

    setViolations(found);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconRing}>
            <Ionicons name="shield-half" size={18} color="#F59E0B" />
          </View>
          <View>
            <Text style={styles.headerTitle}>6-Bölge Mevzuat & Reklam Kalkanı</Text>
            <Text style={styles.headerSub}>TR • EU • US • UK • APAC • MENA</Text>
          </View>
        </View>
      </View>

      {/* Region Selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.regionScroll}
      >
        {REGIONS.map((r) => {
          const isActive = activeRegion === r.key;
          return (
            <TouchableOpacity
              key={r.key}
              style={[styles.regionChip, isActive && styles.regionChipActive]}
              onPress={() => handleSelectRegion(r.key)}
              activeOpacity={0.8}
            >
              <Text style={styles.regionFlag}>{r.flag}</Text>
              <View>
                <Text style={[styles.regionLabel, isActive && styles.regionLabelActive]}>
                  {r.label}
                </Text>
                <Text style={styles.regionBadge}>{r.badge}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Input Card */}
        <GlassCard style={styles.inputCard}>
          <View style={styles.inputCardHeader}>
            <Ionicons name="document-text-outline" size={16} color={Colors.primary} />
            <Text style={styles.inputCardTitle}>Taranacak Metin / Başlık / İçerik</Text>
          </View>

          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={4}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Analiz etmek istediğiniz sayfa içeriğini buraya yapıştırın..."
            placeholderTextColor={Colors.textMuted}
          />

          <View style={styles.inputActionRow}>
            <TouchableOpacity
              style={styles.presetBtn}
              onPress={() => setInputText(PRESETS[activeRegion])}
              activeOpacity={0.8}
            >
              <Ionicons name="reload-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.presetBtnText}>Örnek Metin</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.scanBtn}
              onPress={handleScan}
              activeOpacity={0.8}
            >
              <Ionicons name="scan" size={15} color="#FFFFFF" />
              <Text style={styles.scanBtnText}>⚡ Mevzuat İhlallerini Tara</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Scan Results */}
        {hasScanned && (
          <>
            <View style={styles.resultsHeaderRow}>
              <Text style={styles.sectionHeader}>
                Tespit Edilen İhlaller ({violations.length})
              </Text>
              <View
                style={[
                  styles.complianceStatusPill,
                  {
                    backgroundColor:
                      violations.length === 0
                        ? "rgba(16, 185, 129, 0.15)"
                        : "rgba(239, 68, 68, 0.15)"
                  }
                ]}
              >
                <Text
                  style={[
                    styles.complianceStatusText,
                    { color: violations.length === 0 ? "#10B981" : "#EF4444" }
                  ]}
                >
                  {violations.length === 0 ? "✓ TAM UYUMLU" : "⚠️ CEZA RİSKİ ALGILANDI"}
                </Text>
              </View>
            </View>

            {violations.length === 0 ? (
              <GlassCard style={styles.cleanCard}>
                <Ionicons name="checkmark-circle" size={44} color="#10B981" />
                <Text style={styles.cleanTitle}>Hiçbir Yasal İhlal Bulunamadı</Text>
                <Text style={styles.cleanDesc}>
                  Girilen içerik {REGIONS.find(r => r.key === activeRegion)?.label} reklam kurulu ve sektörel mevzuat kurallarına uygundur.
                </Text>
              </GlassCard>
            ) : (
              violations.map((v, idx) => (
                <GlassCard key={idx} style={styles.violationCard}>
                  <View style={styles.vTop}>
                    <View style={styles.vTitleBox}>
                      <Ionicons
                        name="warning"
                        size={16}
                        color={v.severity === "CRITICAL" ? Colors.danger : "#F59E0B"}
                      />
                      <Text style={styles.vTitle}>{v.title}</Text>
                    </View>
                    <View
                      style={[
                        styles.sevBadge,
                        {
                          backgroundColor:
                            v.severity === "CRITICAL"
                              ? "rgba(239, 68, 68, 0.15)"
                              : "rgba(245, 158, 11, 0.15)"
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.sevBadgeText,
                          {
                            color:
                              v.severity === "CRITICAL" ? "#EF4444" : "#F59E0B"
                          }
                        ]}
                      >
                        {v.severity === "CRITICAL" ? "KRİTİK CEZA" : "YÜKSEK RİSK"}
                      </Text>
                    </View>
                  </View>

                  {v.matched_term && (
                    <View style={styles.termRow}>
                      <Text style={styles.termLabel}>Eşleşen Yasaklı İfade:</Text>
                      <Text style={styles.termVal}>"{v.matched_term}"</Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLbl}>Yasal Dayanak:</Text>
                    <Text style={styles.detailVal}>{v.legal_basis}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLbl}>Yaptırım & Ceza:</Text>
                    <Text style={[styles.detailVal, { color: "#F87171" }]}>
                      {v.penalty_risk}
                    </Text>
                  </View>

                  <View style={styles.fixBox}>
                    <Ionicons name="bulb-outline" size={15} color="#10B981" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fixLbl}>Önerilen Güvenli İfade:</Text>
                      <Text style={styles.fixVal}>{v.suggested_fix}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.askAiBtn}
                    onPress={() => setActiveTab("ai")}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="sparkles" size={13} color="#FFFFFF" />
                    <Text style={styles.askAiBtnText}>AI Asistanından Yeniden Yazım İste</Text>
                  </TouchableOpacity>
                </GlassCard>
              ))
            )}
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconRing: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
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
  regionScroll: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: Colors.surface,
  },
  regionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  regionChipActive: {
    borderColor: "#F59E0B",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  regionFlag: {
    fontSize: 18,
  },
  regionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  regionLabelActive: {
    color: "#F59E0B",
  },
  regionBadge: {
    fontSize: 9,
    color: Colors.textMuted,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  inputCard: {
    padding: 16,
    borderRadius: 16,
    gap: 10,
  },
  inputCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    minHeight: 88,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  inputActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  presetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: Colors.surfaceElevated,
  },
  presetBtnText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F59E0B",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  scanBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  resultsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  complianceStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  complianceStatusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  cleanCard: {
    padding: 30,
    alignItems: "center",
    gap: 8,
  },
  cleanTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  cleanDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  violationCard: {
    padding: 16,
    borderRadius: 16,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  vTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  vTitleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  vTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
    flex: 1,
  },
  sevBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  sevBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  termRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    padding: 8,
    borderRadius: 8,
  },
  termLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  termVal: {
    fontSize: 11,
    fontWeight: "700",
    color: "#F87171",
  },
  detailRow: {
    gap: 2,
  },
  detailLbl: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  detailVal: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  fixBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
  },
  fixLbl: {
    fontSize: 10,
    color: "#34D399",
    fontWeight: "700",
  },
  fixVal: {
    fontSize: 11,
    color: Colors.textPrimary,
    marginTop: 2,
    lineHeight: 16,
  },
  askAiBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    borderRadius: 10,
  },
  askAiBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
});
