import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Platform,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";
import { analyzeContentUrl, generateAiSeoContent, scanTurkishCompliance } from "../services/api";
import { ContentOptimizationResult, GeneratedContentResult, ComplianceSector, ComplianceViolation } from "../types";

export const ContentOptimizerScreen: React.FC = () => {
  const { selectedSite, setActiveTab } = useApp();
  const [activeTabSub, setActiveTabSub] = useState<"OPTIMIZER" | "GENERATOR" | "COMPLIANCE">("COMPLIANCE");

  // Optimizer state
  const [urlInput, setUrlInput] = useState(selectedSite?.primary_url || "https://acmestore.io");
  const [targetKw, setTargetKw] = useState("organik seo uzmanı");
  const [analyzing, setAnalyzing] = useState(false);
  const [optResult, setOptResult] = useState<ContentOptimizationResult | null>(null);

  // Generator state
  const [genType, setGenType] = useState<GeneratedContentResult["type"]>("META_TITLE");
  const [topicInput, setTopicInput] = useState("E-Ticaret Dönüşüm Oranı Artırma");
  const [genTargetKw, setGenTargetKw] = useState("e-ticaret seo ipuçları");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<GeneratedContentResult | null>(null);

  // TR Compliance state
  const [complianceDraft, setComplianceDraft] = useState(
    "Kliniğimizde en iyi doktor kadromuzla kesin tedavi garantisi sunuyoruz. Öncesi sonrası fotoğraflarımızı inceleyin, sıfır risk ile şifa bulun."
  );
  const [complianceSector, setComplianceSector] = useState<ComplianceSector | "ALL">("ALL");

  const complianceViolations = useMemo(() => {
    return scanTurkishCompliance(
      complianceDraft,
      complianceSector === "ALL" ? undefined : complianceSector
    );
  }, [complianceDraft, complianceSector]);

  const handleFixViolation = (v: ComplianceViolation) => {
    const term = v.matched_term || v.matched_pattern;
    const fix = v.suggested_replacement || v.suggested_fix;
    if (!term || !fix) return;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    const updated = complianceDraft.replace(regex, fix);
    setComplianceDraft(updated);
    Alert.alert("Düzeltildi", `"${term}" yerine "${fix}" uygulandı.`);
  };

  const handleAnalyze = async () => {
    if (!urlInput.trim()) return;
    setAnalyzing(true);
    try {
      const res = await analyzeContentUrl(urlInput.trim(), targetKw.trim());
      setOptResult(res);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!topicInput.trim()) return;
    setGenerating(true);
    try {
      const res = await generateAiSeoContent(genType, topicInput.trim(), genTargetKw.trim());
      setGenResult(res);
    } finally {
      setGenerating(false);
    }
  };

  const handleShareResult = async (content: string) => {
    try {
      await Share.share({ message: content });
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
        <Text style={styles.headerTitle}>İçerik Optimizasyonu</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTabSub === "COMPLIANCE" && styles.tabBtnActive]}
          onPress={() => setActiveTabSub("COMPLIANCE")}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-checkmark" size={15} color={activeTabSub === "COMPLIANCE" ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTabSub === "COMPLIANCE" && styles.tabTextActive]}>
            🇹🇷 TR Uyum
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTabSub === "OPTIMIZER" && styles.tabBtnActive]}
          onPress={() => setActiveTabSub("OPTIMIZER")}
          activeOpacity={0.7}
        >
          <Ionicons name="scan-outline" size={15} color={activeTabSub === "OPTIMIZER" ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTabSub === "OPTIMIZER" && styles.tabTextActive]}>
            Sayfa Analizi
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTabSub === "GENERATOR" && styles.tabBtnActive]}
          onPress={() => setActiveTabSub("GENERATOR")}
          activeOpacity={0.7}
        >
          <Ionicons name="sparkles" size={15} color={activeTabSub === "GENERATOR" ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTabSub === "GENERATOR" && styles.tabTextActive]}>
            AI Üretici
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* TAB 3: TR COMPLIANCE SHIELD */}
        {activeTabSub === "COMPLIANCE" && (
          <>
            {/* Header info */}
            <GlassCard style={styles.complianceIntroCard}>
              <View style={styles.secHeader}>
                <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
                <Text style={styles.complianceIntroTitle}>Türkiye Mevzuat Denetim Kalkanı</Text>
              </View>
              <Text style={styles.complianceIntroText}>
                Ticaret Bakanlığı Reklam Kurulu, TİTCK (Sağlık Bakanlığı), TBB ve SPK/BDDK mevzuatına göre
                kullanımı yasak olan veya idari para cezası ve erişim engeline yol açabilecek kelimeleri anlık tarar.
              </Text>
            </GlassCard>

            {/* Quick Presets */}
            <Text style={styles.fieldLabel}>Hazır Test Senaryoları</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScroll}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() =>
                  setComplianceDraft(
                    "Kliniğimizde en iyi doktor kadromuzla kesin tedavi garantisi sunuyoruz. Öncesi sonrası fotoğraflarımızı inceleyin, sıfır risk ile şifa bulun."
                  )
                }
              >
                <Text style={styles.presetChipText}>🏥 Sağlık İhlali</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() =>
                  setComplianceDraft(
                    "İstanbul'un en iyi avukatı olarak ceza davalarında kesin beraat ve dava kazanma garantisi veriyoruz. İlk danışmanlık tamamen ücretsizdir."
                  )
                }
              >
                <Text style={styles.presetChipText}>⚖️ Avukatlık İhlali</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() =>
                  setComplianceDraft(
                    "Borsada garantili getiri ve kesin kazanç vaat eden algoritmamızla tanışın. Sicili bozuklara kredi ve senetle borç imkanı."
                  )
                }
              >
                <Text style={styles.presetChipText}>💳 Finans / Kredi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() =>
                  setComplianceDraft(
                    "Türkiye'nin en ucuz cep telefonu burada! Rakipsiz fiyat ve koşulsuz şartsız iade garantisi."
                  )
                }
              >
                <Text style={styles.presetChipText}>🛒 E-Ticaret / Fiyat</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() =>
                  setComplianceDraft(
                    "Uzman hekim kadromuz modern teşhis ve tetkik yöntemleriyle hizmetinizdedir. Randevu ve detaylı bilgi için bize ulaşabilirsiniz."
                  )
                }
              >
                <Text style={styles.presetChipText}>✅ Temiz Metin</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Sector Filters */}
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Sektör Filtresi</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScroll}>
              {[
                { id: "ALL", label: "Tüm Sektörler" },
                { id: "SAGLIK", label: "Sağlık & Klinik" },
                { id: "GIDA_TAKVIYESI", label: "Gıda & Zayıflama" },
                { id: "HUKUK", label: "Hukuk & Avukat" },
                { id: "FINANS", label: "Finans & Kredi" },
                { id: "E_TICARET", label: "E-Ticaret & Fiyat" },
                { id: "BAHIS_TUTUN", label: "Bahis & Tütün" },
              ].map((s) => {
                const isAct = complianceSector === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.typeChip, isAct && styles.typeChipActive]}
                    onPress={() => setComplianceSector(s.id as any)}
                  >
                    <Text style={[styles.typeChipText, isAct && styles.typeChipTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Editor Input Card */}
            <GlassCard style={[styles.inputCard, { marginTop: 12 }]}>
              <View style={styles.secHeader}>
                <Text style={styles.cardTitle}>Denetlenecek Metin Taslağı</Text>
                {complianceDraft.length > 0 && (
                  <TouchableOpacity onPress={() => setComplianceDraft("")}>
                    <Text style={styles.clearText}>Temizle</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={[styles.textInput, styles.draftInput]}
                placeholder="Web sitenizde veya reklamlarınızda yayınlanacak metni buraya yapıştırın..."
                placeholderTextColor={Colors.textMuted}
                value={complianceDraft}
                onChangeText={setComplianceDraft}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              <View style={styles.draftStatsRow}>
                <Text style={styles.draftStatsText}>
                  {complianceDraft.trim() ? complianceDraft.trim().split(/\s+/).length : 0} kelime • {complianceDraft.length} karakter
                </Text>
              </View>
            </GlassCard>

            {/* Scan Status Summary */}
            {complianceViolations.length === 0 ? (
              <GlassCard style={styles.cleanStatusCard}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.cleanStatusTitle}>Mevzuata Tam Uyumlu</Text>
                  <Text style={styles.cleanStatusDesc}>
                    Metninizde Türkiye Reklam Kurulu, TİTCK veya TBB mevzuatınca yasaklanmış herhangi bir kural ihlali bulunamadı.
                  </Text>
                </View>
              </GlassCard>
            ) : (
              <GlassCard style={styles.violationSummaryCard}>
                <Ionicons name="alert-circle" size={24} color={Colors.danger} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.violationSummaryTitle}>
                    {complianceViolations.length} Adet Mevzuat İhlali Tespit Edildi!
                  </Text>
                  <Text style={styles.violationSummaryDesc}>
                    Aşağıdaki ifadeler reklam ve içerik mevzuatına aykırıdır; idari para cezası ve içerik engeli riski taşır.
                  </Text>
                </View>
              </GlassCard>
            )}

            {/* Violation List Cards */}
            {complianceViolations.map((v, i) => (
              <GlassCard key={i} style={styles.violationItemCard}>
                <View style={styles.violationCardHeader}>
                  <View style={styles.sectorBadge}>
                    <Text style={styles.sectorBadgeText}>{v.sector}</Text>
                  </View>
                  <View
                    style={[
                      styles.riskBadge,
                      v.severity === "CRITICAL"
                        ? styles.riskBadgeCritical
                        : v.severity === "HIGH"
                        ? styles.riskBadgeHigh
                        : styles.riskBadgeMedium,
                    ]}
                  >
                    <Text style={styles.riskBadgeText}>
                      {v.severity === "CRITICAL" ? "AĞIR RİSK" : v.severity === "HIGH" ? "YÜKSEK RİSK" : "ORTA RİSK"}
                    </Text>
                  </View>
                </View>

                {/* Prohibited Term */}
                <View style={styles.termBox}>
                  <Text style={styles.termLabel}>Yasaklı İfade:</Text>
                  <Text style={styles.termValue}>"{v.matched_term}"</Text>
                </View>

                {/* Explanation */}
                <Text style={styles.violExplanation}>{v.explanation}</Text>

                {/* Law Reference & Fine Risk */}
                <View style={styles.legalInfoBox}>
                  <View style={styles.legalInfoRow}>
                    <Ionicons name="book-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.legalInfoText}>Mevzuat: {v.legal_reference}</Text>
                  </View>
                  <View style={styles.legalInfoRow}>
                    <Ionicons name="warning-outline" size={13} color={Colors.danger} />
                    <Text style={[styles.legalInfoText, { color: Colors.danger }]}>Yaptırım: {v.fine_risk}</Text>
                  </View>
                </View>

                {/* Suggested Replacement */}
                {v.suggested_replacement && (
                  <View style={styles.replacementRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.replLabel}>Önerilen Güvenli Alternatif:</Text>
                      <Text style={styles.replValue}>"{v.suggested_replacement}"</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.fixBtn}
                      onPress={() => handleFixViolation(v)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="sparkles" size={13} color="#FFFFFF" />
                      <Text style={styles.fixBtnText}>Metinde Düzelt</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </GlassCard>
            ))}
          </>
        )}
        {/* TAB 1: OPTIMIZER */}
        {activeTabSub === "OPTIMIZER" && (
          <>
            {/* Input Card */}
            <GlassCard style={styles.inputCard}>
              <Text style={styles.cardTitle}>URL & Hedef Kelime Denetimi</Text>
              
              <Text style={styles.fieldLabel}>Sayfa URL Adresi</Text>
              <TextInput
                style={styles.textInput}
                placeholder="https://siteniz.com/sayfa"
                placeholderTextColor={Colors.textMuted}
                value={urlInput}
                onChangeText={setUrlInput}
                autoCapitalize="none"
              />

              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Hedef Anahtar Kelime</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: organik seo uzmanı"
                placeholderTextColor={Colors.textMuted}
                value={targetKw}
                onChangeText={setTargetKw}
              />

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleAnalyze}
                disabled={analyzing || !urlInput.trim()}
                activeOpacity={0.8}
              >
                {analyzing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="flash" size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>İçeriği Analiz Et</Text>
                  </>
                )}
              </TouchableOpacity>
            </GlassCard>

            {/* Analysis Results */}
            {optResult && (
              <>
                {/* Score Grid */}
                <View style={styles.scoresGrid}>
                  <GlassCard style={styles.scoreBox}>
                    <Text style={styles.scoreNum}>{optResult.content_score}</Text>
                    <Text style={styles.scoreLbl}>İçerik Skoru</Text>
                  </GlassCard>
                  <GlassCard style={styles.scoreBox}>
                    <Text style={[styles.scoreNum, { color: Colors.accent }]}>{optResult.geo_score}</Text>
                    <Text style={styles.scoreLbl}>GEO Skoru</Text>
                  </GlassCard>
                  <GlassCard style={styles.scoreBox}>
                    <Text style={[styles.scoreNum, { color: Colors.success }]}>{optResult.readability_score}</Text>
                    <Text style={styles.scoreLbl}>Okunabilirlik</Text>
                  </GlassCard>
                  <GlassCard style={styles.scoreBox}>
                    <Text style={styles.scoreNum}>{optResult.word_count}</Text>
                    <Text style={styles.scoreLbl}>Kelime Sayısı</Text>
                  </GlassCard>
                </View>

                {/* Missing Entities */}
                <GlassCard style={styles.sectionCard}>
                  <View style={styles.secHeader}>
                    <Ionicons name="cube-outline" size={16} color={Colors.warning} />
                    <Text style={styles.secTitle}>Eksik Entity & Konu Kapsamı</Text>
                  </View>
                  <View style={styles.tagsWrap}>
                    {optResult.missing_entities.map((ent, i) => (
                      <View key={i} style={styles.tagItem}>
                        <Text style={styles.tagText}>{ent}</Text>
                      </View>
                    ))}
                  </View>
                </GlassCard>

                {/* Missing Headings */}
                <GlassCard style={styles.sectionCard}>
                  <View style={styles.secHeader}>
                    <Ionicons name="list-outline" size={16} color={Colors.info} />
                    <Text style={styles.secTitle}>Önerilen Başlık Hiyerarşisi</Text>
                  </View>
                  {optResult.missing_headings.map((h, i) => (
                    <View key={i} style={styles.headingItem}>
                      <Ionicons name="add-circle-outline" size={14} color={Colors.info} />
                      <Text style={styles.headingText}>{h}</Text>
                    </View>
                  ))}
                </GlassCard>

                {/* AI Suggestions */}
                <GlassCard style={styles.sectionCard}>
                  <View style={styles.secHeader}>
                    <Ionicons name="sparkles" size={16} color={Colors.primary} />
                    <Text style={styles.secTitle}>AI İyileştirme Önerileri</Text>
                  </View>
                  {optResult.ai_suggestions.map((sug, i) => (
                    <View key={i} style={styles.sugItem}>
                      <Text style={styles.sugBullet}>•</Text>
                      <Text style={styles.sugText}>{sug}</Text>
                    </View>
                  ))}
                </GlassCard>
              </>
            )}
          </>
        )}

        {/* TAB 2: AI GENERATOR */}
        {activeTabSub === "GENERATOR" && (
          <>
            {/* Format Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeScroll}>
              {[
                { id: "META_TITLE", label: "Meta Başlık" },
                { id: "META_DESCRIPTION", label: "Meta Açıklaması" },
                { id: "FAQ", label: "FAQ Schema" },
                { id: "BLOG_OUTLINE", label: "Blog Taslağı" }
              ].map((t) => {
                const isActive = genType === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeChip, isActive && styles.typeChipActive]}
                    onPress={() => setGenType(t.id as any)}
                  >
                    <Text style={[styles.typeChipText, isActive && styles.typeChipTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Generator Form */}
            <GlassCard style={styles.inputCard}>
              <Text style={styles.fieldLabel}>Konu / Başlık</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: E-Ticaret Dönüşüm Oranı Artırma"
                placeholderTextColor={Colors.textMuted}
                value={topicInput}
                onChangeText={setTopicInput}
              />

              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Hedef Anahtar Kelime</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: e-ticaret seo ipuçları"
                placeholderTextColor={Colors.textMuted}
                value={genTargetKw}
                onChangeText={setGenTargetKw}
              />

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleGenerate}
                disabled={generating || !topicInput.trim()}
                activeOpacity={0.8}
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>AI ile İçerik Üret</Text>
                  </>
                )}
              </TouchableOpacity>
            </GlassCard>

            {/* Generated Output */}
            {genResult && (
              <GlassCard style={styles.outputCard}>
                <View style={styles.outputHeader}>
                  <View>
                    <Text style={styles.outputTitle}>{genResult.title}</Text>
                    <Text style={styles.outputTokens}>{genResult.tokens_used} AI Token Kullanıldı</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={() => handleShareResult(genResult.content)}
                  >
                    <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.contentBox}>
                  <Text style={styles.contentText}>{genResult.content}</Text>
                </View>

                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => {
                    handleShareResult(genResult.content);
                    Alert.alert("Hazır", "İçerik panoya kopyalanmaya hazır.");
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="copy-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.copyBtnText}>İçeriği Kopyala / Paylaş</Text>
                </TouchableOpacity>
              </GlassCard>
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
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  tabRow: {
    flexDirection: "row",
    padding: 12,
    gap: 10,
    backgroundColor: Colors.surface,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  tabBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  tabTextActive: {
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
  inputCard: {
    padding: 16,
    borderRadius: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 11 : 8,
    color: Colors.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  scoresGrid: {
    flexDirection: "row",
    gap: 8,
  },
  scoreBox: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  scoreNum: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.primary,
  },
  scoreLbl: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  sectionCard: {
    padding: 16,
    borderRadius: 16,
    gap: 10,
  },
  secHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  secTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagItem: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  tagText: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: "600",
  },
  headingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headingText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sugItem: {
    flexDirection: "row",
    gap: 8,
  },
  sugBullet: {
    color: Colors.primary,
    fontSize: 14,
    lineHeight: 18,
  },
  sugText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  typeScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  typeChip: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  typeChipActive: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderColor: Colors.primary,
  },
  typeChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  typeChipTextActive: {
    color: Colors.primary,
  },
  outputCard: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  outputHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  outputTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  outputTokens: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  shareBtn: {
    padding: 6,
  },
  contentBox: {
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  contentText: {
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 20,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  copyBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  complianceIntroCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  complianceIntroTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  complianceIntroText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: 6,
  },
  presetScroll: {
    gap: 8,
    paddingBottom: 4,
    marginTop: 6,
  },
  presetChip: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  presetChipText: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  clearText: {
    fontSize: 12,
    color: Colors.textMuted,
    textDecorationLine: "underline",
  },
  draftInput: {
    minHeight: 100,
    fontSize: 13,
    lineHeight: 20,
    textAlignVertical: "top",
  },
  draftStatsRow: {
    alignItems: "flex-end",
    marginTop: 6,
  },
  draftStatsText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  cleanStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 6,
  },
  cleanStatusTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.success,
  },
  cleanStatusDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  violationSummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 6,
  },
  violationSummaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.danger,
  },
  violationSummaryDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  violationItemCard: {
    padding: 14,
    borderRadius: 14,
    marginTop: 10,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  violationCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectorBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sectorBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  riskBadgeCritical: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  riskBadgeHigh: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
  },
  riskBadgeMedium: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  riskBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.danger,
  },
  termBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  termLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  termValue: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.danger,
  },
  violExplanation: {
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  legalInfoBox: {
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  legalInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legalInfoText: {
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
  },
  replacementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    padding: 10,
    borderRadius: 10,
    gap: 8,
    marginTop: 4,
  },
  replLabel: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  replValue: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.success,
  },
  fixBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fixBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
