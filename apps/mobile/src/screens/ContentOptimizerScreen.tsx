import React, { useState } from "react";
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
import { analyzeContentUrl, generateAiSeoContent } from "../services/api";
import { ContentOptimizationResult, GeneratedContentResult } from "../types";

export const ContentOptimizerScreen: React.FC = () => {
  const { selectedSite, setActiveTab } = useApp();
  const [activeTabSub, setActiveTabSub] = useState<"OPTIMIZER" | "GENERATOR">("OPTIMIZER");

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
            AI İçerik Üretici
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
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
});
