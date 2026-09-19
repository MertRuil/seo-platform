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
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";
import { fetchGeoScores, fetchGeoPrompts, addGeoPrompt } from "../services/api";
import { GeoPlatformScore, GeoPromptItem } from "../types";

export const GeoScreen: React.FC = () => {
  const { selectedSite, setActiveTab } = useApp();
  const [activeSegment, setActiveSegment] = useState<"PLATFORMS" | "PROMPTS" | "AEO">("PLATFORMS");

  const [platformScores, setPlatformScores] = useState<GeoPlatformScore[]>([]);
  const [prompts, setPrompts] = useState<GeoPromptItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Add Prompt Modal
  const [addModal, setAddModal] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (selectedSite) {
      setLoading(true);
      Promise.all([
        fetchGeoScores(selectedSite.id, selectedSite.domain),
        fetchGeoPrompts(selectedSite.id, selectedSite.domain)
      ]).then(([scores, pList]) => {
        setPlatformScores(scores);
        setPrompts(pList);
      }).finally(() => setLoading(false));
    }
  }, [selectedSite?.id, selectedSite?.domain]);

  const handleAddPrompt = async () => {
    if (!promptText.trim() || !selectedSite) return;
    setIsAdding(true);
    try {
      const created = await addGeoPrompt(selectedSite.id, promptText.trim());
      setPrompts(prev => [created, ...prev]);
      setPromptText("");
      setAddModal(false);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.geoBadge}>
            <Ionicons name="globe-outline" size={16} color={Colors.accent} />
          </View>
          <View>
            <Text style={styles.headerTitle}>GEO & AI Arama Görünürlüğü</Text>
            <Text style={styles.headerSub}>Generative Engine Optimization</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)} activeOpacity={0.7}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Segment Selector */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "PLATFORMS" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("PLATFORMS")}
        >
          <Text style={[styles.segmentText, activeSegment === "PLATFORMS" && styles.segmentTextActive]}>
            Platform Skorları
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "PROMPTS" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("PROMPTS")}
        >
          <Text style={[styles.segmentText, activeSegment === "PROMPTS" && styles.segmentTextActive]}>
            Prompt Takibi ({prompts.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "AEO" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("AEO")}
        >
          <Text style={[styles.segmentText, activeSegment === "AEO" && styles.segmentTextActive]}>
            AEO Önerileri
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* SEGMENT 1: PLATFORM SCORES */}
        {activeSegment === "PLATFORMS" && (
          <>
            {/* Overall GEO Score Card */}
            <LinearGradient
              colors={["#1E1B4B", "#12141F"]}
              style={styles.overallCard}
            >
              <View style={styles.overallTop}>
                <View>
                  <Text style={styles.overallLabel}>Genel Yapay Zeka Görünürlük Skoru</Text>
                  <Text style={styles.overallSub}>ChatGPT, Perplexity ve Google AI Overview ortalaması</Text>
                </View>
                <View style={styles.overallRing}>
                  <Text style={styles.overallScoreNum}>81</Text>
                  <Text style={styles.overallScoreScale}>/100</Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <View style={styles.mItem}>
                  <Text style={styles.mVal}>142</Text>
                  <Text style={styles.mLbl}>Toplam AI Alıntısı</Text>
                </View>
                <View style={styles.mDivider} />
                <View style={styles.mItem}>
                  <Text style={styles.mVal}>#1.8</Text>
                  <Text style={styles.mLbl}>Ort. Kaynak Sırası</Text>
                </View>
                <View style={styles.mDivider} />
                <View style={styles.mItem}>
                  <Text style={[styles.mVal, { color: Colors.success }]}>%84</Text>
                  <Text style={styles.mLbl}>Pozitif Atıf Oranı</Text>
                </View>
              </View>
            </LinearGradient>

            {/* Platforms Breakdown */}
            <Text style={styles.sectionHeader}>Platform Bazında Alıntı ve Otorite</Text>
            {loading ? (
              <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
            ) : (
              platformScores.map((p, idx) => (
                <GlassCard key={idx} style={styles.platformCard}>
                  <View style={styles.pHeader}>
                    <View style={styles.pTitleRow}>
                      <Ionicons
                        name={p.platform.includes("Google") ? "logo-google" : "sparkles"}
                        size={18}
                        color={p.platform === "Perplexity" ? Colors.accent : Colors.primary}
                      />
                      <Text style={styles.pName}>{p.platform}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: p.status === "DOMINANT" ? Colors.successSurface : Colors.warningSurface }]}>
                      <Text style={[styles.statusText, { color: p.status === "DOMINANT" ? Colors.success : Colors.warning }]}>
                        {p.status === "DOMINANT" ? "Baskın Otorite" : p.status === "VISIBLE" ? "Görünür" : "Nadir"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.pStatsRow}>
                    <View style={styles.pStat}>
                      <Text style={styles.pStatNum}>{p.score}/100</Text>
                      <Text style={styles.pStatLbl}>Platform Skoru</Text>
                    </View>
                    <View style={styles.pStat}>
                      <Text style={styles.pStatNum}>{p.mentions}</Text>
                      <Text style={styles.pStatLbl}>Marka Mention</Text>
                    </View>
                    <View style={styles.pStat}>
                      <Text style={styles.pStatNum}>{p.citations}</Text>
                      <Text style={styles.pStatLbl}>Doğrudan Atıf</Text>
                    </View>
                  </View>
                </GlassCard>
              ))
            )}
          </>
        )}

        {/* SEGMENT 2: PROMPT TRACKING */}
        {activeSegment === "PROMPTS" && (
          <>
            <GlassCard style={styles.promptIntroCard}>
              <Text style={styles.pIntroTitle}>Yapay Zeka Soru ve Prompt Takibi</Text>
              <Text style={styles.pIntroDesc}>
                Kullanıcıların yapay zeka sistemlerine yönelttiği arama sorgularında markanızın nasıl ve hangi kaynaklarla alıntılandığını izleyin.
              </Text>
            </GlassCard>

            {prompts.map((item) => (
              <GlassCard key={item.id} style={styles.promptCard}>
                <View style={styles.promptTop}>
                  <View style={styles.promptPill}>
                    <Text style={styles.promptPillText}>{item.frequency}</Text>
                  </View>
                  {item.brand_mentioned ? (
                    <View style={styles.citedBadge}>
                      <Ionicons name="checkmark-circle" size={13} color={Colors.success} />
                      <Text style={styles.citedBadgeText}>Atıf Yapıldı (#{item.citation_rank || 1})</Text>
                    </View>
                  ) : (
                    <View style={styles.notCitedBadge}>
                      <Ionicons name="close-circle" size={13} color={Colors.danger} />
                      <Text style={styles.notCitedText}>Atıf Bulunamadı</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.promptQuery}>"{item.prompt}"</Text>

                {/* Platform Snippets */}
                <View style={styles.snippetsList}>
                  {Object.entries(item.platform_results).map(([plat, res]) => (
                    <View key={plat} style={styles.snippetItem}>
                      <View style={styles.snippetHeader}>
                        <Text style={styles.platTitle}>{plat}</Text>
                        <Text style={[styles.mentionStatus, { color: res.mentioned ? Colors.success : Colors.textMuted }]}>
                          {res.mentioned ? "✓ Marka Geçti" : "✗ Yok"}
                        </Text>
                      </View>
                      <Text style={styles.snippetSnippet}>{res.snippet}</Text>
                    </View>
                  ))}
                </View>

                {item.top_competitor_cited && (
                  <Text style={styles.compCitedText}>
                    En Çok Atıf Alan Rakip: <Text style={{ color: Colors.primary }}>{item.top_competitor_cited}</Text>
                  </Text>
                )}
              </GlassCard>
            ))}
          </>
        )}

        {/* SEGMENT 3: AEO RECOMMENDATIONS */}
        {activeSegment === "AEO" && (
          <>
            <GlassCard style={styles.promptIntroCard}>
              <Text style={styles.pIntroTitle}>Answer Engine Optimization (AEO)</Text>
              <Text style={styles.pIntroDesc}>
                Yapay zekanın sitenizden doğrudan 'snippet' alıntı yapabilmesi için aşağıdaki yapılandırılmış veri ve format önerilerini uygulayın:
              </Text>
            </GlassCard>

            {[
              {
                title: "Tanım Blokları (Definition Format)",
                desc: "Ana hedef kelimenizi 'Nedir?' başlığı altında ilk 40 kelimede net ve kesin bir cümleyle tanımlayın. ChatGPT ve Perplexity doğrudan bu tanımı alıntı olarak çeker.",
                icon: "help-circle-outline",
                action: "Tanım Şablonu Oluştur"
              },
              {
                title: "Organization & Author Schema",
                desc: "Marka kimliğini ve makale yazarının uzmanlık otoritesini Google Knowledge Graph'a tanıtmak için JSON-LD schema yerleştirin.",
                icon: "person-circle-outline",
                action: "Schema Ekle"
              },
              {
                title: "FAQ & Sıkça Sorulan Sorular",
                desc: "Sayfa sonlarına arama motorlarının 'People Also Ask' alanında gösterdiği en popüler 3 soruyu cevaplayan SSS bloğu ekleyin.",
                icon: "list-circle-outline",
                action: "FAQ Üret"
              }
            ].map((rec, idx) => (
              <GlassCard key={idx} style={styles.aeoCard}>
                <View style={styles.aeoTop}>
                  <View style={styles.aeoIconBox}>
                    <Ionicons name={rec.icon as any} size={20} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aeoTitle}>{rec.title}</Text>
                    <Text style={styles.aeoDesc}>{rec.desc}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.aeoActionBtn}
                  onPress={() => setActiveTab("ai")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="sparkles" size={13} color="#FFFFFF" />
                  <Text style={styles.aeoActionText}>{rec.action}</Text>
                </TouchableOpacity>
              </GlassCard>
            ))}
          </>
        )}
      </ScrollView>

      {/* Add Prompt Modal */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Yeni GEO Sorgusu Ekle</Text>
            <Text style={styles.modalSub}>ChatGPT ve Perplexity'de takip etmek istediğiniz arama sorusunu yazın:</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Örn: En iyi organik SEO ajansı hangisi?"
              placeholderTextColor={Colors.textMuted}
              value={promptText}
              onChangeText={setPromptText}
              autoFocus
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAddModal(false)}>
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, !promptText.trim() && { opacity: 0.5 }]}
                disabled={!promptText.trim() || isAdding}
                onPress={handleAddPrompt}
              >
                <Text style={styles.modalSubmitText}>{isAdding ? "Ekleniyor..." : "Takibe Al"}</Text>
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
  geoBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
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
    backgroundColor: Colors.primary,
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
    borderColor: Colors.primary,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  segmentTextActive: {
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
  overallCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  overallTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  overallLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  overallSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    maxWidth: 220,
  },
  overallRing: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  overallScoreNum: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.accent,
  },
  overallScoreScale: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: -2,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    paddingVertical: 10,
    borderRadius: 12,
  },
  mItem: {
    alignItems: "center",
  },
  mVal: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  mLbl: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  mDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.borderSubtle,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  platformCard: {
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  pHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pName: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  pStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: Colors.surface,
    padding: 8,
    borderRadius: 10,
  },
  pStat: {
    alignItems: "center",
    flex: 1,
  },
  pStatNum: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  pStatLbl: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2,
  },
  promptIntroCard: {
    padding: 14,
    borderRadius: 14,
  },
  pIntroTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  pIntroDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  promptCard: {
    padding: 16,
    borderRadius: 16,
    gap: 10,
  },
  promptTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  promptPill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  promptPillText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  citedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.successSurface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  citedBadgeText: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: "700",
  },
  notCitedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.dangerSurface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  notCitedText: {
    color: Colors.danger,
    fontSize: 11,
    fontWeight: "600",
  },
  promptQuery: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    fontStyle: "italic",
  },
  snippetsList: {
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  snippetItem: {
    gap: 2,
  },
  snippetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  platTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
  },
  mentionStatus: {
    fontSize: 10,
    fontWeight: "600",
  },
  snippetSnippet: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 15,
  },
  compCitedText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  aeoCard: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  aeoTop: {
    flexDirection: "row",
    gap: 12,
  },
  aeoIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  aeoTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  aeoDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  aeoActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 9,
    borderRadius: 10,
  },
  aeoActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
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
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
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
    backgroundColor: Colors.primary,
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
