import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";
import { fetchKeywords, addKeyword, researchKeywords } from "../services/api";
import { KeywordItem, KeywordResearchItem } from "../types";

export const KeywordsScreen: React.FC = () => {
  const { selectedSite, setActiveTab } = useApp();
  const [activeSegment, setActiveSegment] = useState<"TRACKING" | "RESEARCH">("TRACKING");

  // Tracking state
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [loadingKeywords, setLoadingKeywords] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");

  // Add Keyword Modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newKeywordInput, setNewKeywordInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Research state
  const [researchQuery, setResearchQuery] = useState("");
  const [researchResults, setResearchResults] = useState<KeywordResearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (selectedSite) {
      setLoadingKeywords(true);
      fetchKeywords(selectedSite.id, selectedSite.domain)
        .then(setKeywords)
        .finally(() => setLoadingKeywords(false));
    }
  }, [selectedSite?.id, selectedSite?.domain]);

  const handleAddKeyword = async () => {
    if (!newKeywordInput.trim() || !selectedSite) return;
    setIsAdding(true);
    try {
      const created = await addKeyword(selectedSite.id, newKeywordInput.trim());
      setKeywords(prev => [created, ...prev]);
      setNewKeywordInput("");
      setAddModalVisible(false);
    } finally {
      setIsAdding(false);
    }
  };

  const handleResearch = async () => {
    if (!researchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await researchKeywords(researchQuery.trim());
      setResearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  const filteredKeywords = keywords.filter(k =>
    k.keyword.toLowerCase().includes(filterQuery.toLowerCase()) ||
    k.target_url.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Top Header & Navigation Back */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backBtn}
          onPress={() => setActiveTab("hub")}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Anahtar Kelimeler</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setAddModalVisible(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Segment Selector: Takip vs Araştırma */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "TRACKING" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("TRACKING")}
          activeOpacity={0.7}
        >
          <Ionicons
            name="trending-up"
            size={16}
            color={activeSegment === "TRACKING" ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.segmentText, activeSegment === "TRACKING" && styles.segmentTextActive]}>
            Kelime Takibi ({keywords.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "RESEARCH" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("RESEARCH")}
          activeOpacity={0.7}
        >
          <Ionicons
            name="search"
            size={16}
            color={activeSegment === "RESEARCH" ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.segmentText, activeSegment === "RESEARCH" && styles.segmentTextActive]}>
            Kelime Araştırması
          </Text>
        </TouchableOpacity>
      </View>

      {/* SEGMENT 1: TRACKING */}
      {activeSegment === "TRACKING" && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {/* Quick Filter Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Takip edilen kelimelerde ara..."
              placeholderTextColor={Colors.textMuted}
              value={filterQuery}
              onChangeText={setFilterQuery}
            />
            {filterQuery.length > 0 && (
              <TouchableOpacity onPress={() => setFilterQuery("")}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Tracking Summary Stats */}
          <GlassCard style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>
                {keywords.filter(k => k.current_pos <= 3).length}
              </Text>
              <Text style={styles.summaryLbl}>İlk 3 Sıra</Text>
            </View>
            <View style={styles.summaryDiv} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>
                {keywords.filter(k => k.current_pos <= 10).length}
              </Text>
              <Text style={styles.summaryLbl}>İlk Sayfa</Text>
            </View>
            <View style={styles.summaryDiv} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: Colors.success }]}>
                +{keywords.filter(k => k.change > 0).length}
              </Text>
              <Text style={styles.summaryLbl}>Yükselenler</Text>
            </View>
            <View style={styles.summaryDiv} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, { color: Colors.danger }]}>
                -{keywords.filter(k => k.change < 0).length}
              </Text>
              <Text style={styles.summaryLbl}>Düşenler</Text>
            </View>
          </GlassCard>

          {loadingKeywords ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Kelimeler taranıyor...</Text>
            </View>
          ) : filteredKeywords.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="trending-up-outline" size={38} color={Colors.textMuted} />
              <Text style={styles.emptyText}>Henüz anahtar kelime bulunmuyor.</Text>
            </View>
          ) : (
            filteredKeywords.map((kw) => {
              const isUp = kw.change > 0;
              const isDown = kw.change < 0;

              return (
                <GlassCard key={kw.id} style={styles.kwCard}>
                  <View style={styles.kwRow}>
                    <View style={styles.kwMain}>
                      <Text style={styles.kwTitle}>{kw.keyword}</Text>
                      <Text style={styles.kwUrl} numberOfLines={1}>{kw.target_url}</Text>
                      
                      <View style={styles.kwPillsRow}>
                        <View style={styles.kwPill}>
                          <Text style={styles.kwPillText}>Hacim: {kw.volume.toLocaleString()}</Text>
                        </View>
                        <View style={styles.kwPill}>
                          <Text style={styles.kwPillText}>Zorluk: %{kw.difficulty}</Text>
                        </View>
                        <View style={styles.kwPill}>
                          <Text style={styles.kwPillText}>CPC: ${kw.cpc}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Position & Movement Badge */}
                    <View style={styles.kwPosCol}>
                      <View style={[styles.posBadge, kw.current_pos <= 3 ? styles.posBadgeTop : styles.posBadgeNorm]}>
                        <Text style={styles.posBadgeText}>#{kw.current_pos}</Text>
                      </View>
                      <View style={[styles.changeBadge, isUp ? styles.badgeUp : isDown ? styles.badgeDown : styles.badgeEqual]}>
                        <Ionicons
                          name={isUp ? "arrow-up" : isDown ? "arrow-down" : "remove"}
                          size={11}
                          color={isUp ? Colors.success : isDown ? Colors.danger : Colors.textMuted}
                        />
                        <Text style={[styles.changeText, { color: isUp ? Colors.success : isDown ? Colors.danger : Colors.textMuted }]}>
                          {Math.abs(kw.change)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </GlassCard>
              );
            })
          )}
        </ScrollView>
      )}

      {/* SEGMENT 2: RESEARCH */}
      {activeSegment === "RESEARCH" && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.researchInputRow}>
            <TextInput
              style={styles.researchInput}
              placeholder="Yeni arama terimi girin (ör: e-ticaret seo)..."
              placeholderTextColor={Colors.textMuted}
              value={researchQuery}
              onChangeText={setResearchQuery}
              onSubmitEditing={handleResearch}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={styles.researchSubmitBtn}
              onPress={handleResearch}
              disabled={isSearching || !researchQuery.trim()}
              activeOpacity={0.8}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>

          {/* Preset Topics */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScroll}>
            {["SEO Araçları", "Kanonikleştirme", "Core Web Vitals", "Helpful Content", "GEO"].map((p) => (
              <TouchableOpacity
                key={p}
                style={styles.presetChip}
                onPress={() => {
                  setResearchQuery(p);
                  researchKeywords(p).then(setResearchResults);
                }}
              >
                <Text style={styles.presetChipText}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Research Results */}
          {researchResults.map((r, idx) => (
            <GlassCard key={idx} style={styles.kwCard}>
              <View style={styles.kwRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Text style={styles.kwTitle}>{r.keyword}</Text>
                    {r.has_ai_overview && (
                      <View style={styles.aiOverviewBadge}>
                        <Ionicons name="sparkles" size={9} color={Colors.accent} />
                        <Text style={styles.aiOverviewText}>AI Overview</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.kwPillsRow}>
                    <View style={styles.kwPill}>
                      <Text style={styles.kwPillText}>Hacim: {r.volume.toLocaleString()}</Text>
                    </View>
                    <View style={styles.kwPill}>
                      <Text style={styles.kwPillText}>Zorluk: %{r.difficulty}</Text>
                    </View>
                    <View style={styles.kwPill}>
                      <Text style={styles.kwPillText}>Intent: {r.intent}</Text>
                    </View>
                  </View>
                </View>

                {/* Add to Tracking Button */}
                <TouchableOpacity
                  style={styles.trackAddBtn}
                  onPress={async () => {
                    if (selectedSite) {
                      const created = await addKeyword(selectedSite.id, r.keyword);
                      setKeywords(prev => [created, ...prev]);
                      setActiveSegment("TRACKING");
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={16} color={Colors.primary} />
                  <Text style={styles.trackAddText}>Takip Et</Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          ))}
        </ScrollView>
      )}

      {/* Add Keyword Modal */}
      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Hedef Anahtar Kelime Ekle</Text>
            <Text style={styles.modalSub}>Google sıralamasını günlük takip etmek istediğiniz kelimeyi girin:</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Örn: organik seo uzmanı"
              placeholderTextColor={Colors.textMuted}
              value={newKeywordInput}
              onChangeText={setNewKeywordInput}
              autoFocus
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, !newKeywordInput.trim() && { opacity: 0.5 }]}
                disabled={!newKeywordInput.trim() || isAdding}
                onPress={handleAddKeyword}
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
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
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
    gap: 10,
    backgroundColor: Colors.surface,
  },
  segmentBtn: {
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
  segmentBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
  },
  segmentText: {
    fontSize: 13,
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
    gap: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
  },
  summaryVal: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  summaryLbl: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  summaryDiv: {
    width: 1,
    height: 24,
    backgroundColor: Colors.borderSubtle,
  },
  loadingBox: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  kwCard: {
    padding: 14,
    borderRadius: 14,
  },
  kwRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  kwMain: {
    flex: 1,
  },
  kwTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  kwUrl: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  kwPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  kwPill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  kwPillText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  kwPosCol: {
    alignItems: "center",
    gap: 6,
  },
  posBadge: {
    width: 44,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  posBadgeTop: {
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  posBadgeNorm: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  posBadgeText: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeUp: {
    backgroundColor: Colors.successSurface,
  },
  badgeDown: {
    backgroundColor: Colors.dangerSurface,
  },
  badgeEqual: {
    backgroundColor: Colors.surface,
  },
  changeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  researchInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  researchInput: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    color: Colors.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  researchSubmitBtn: {
    width: 46,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  presetScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  presetChip: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  presetChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  aiOverviewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aiOverviewText: {
    fontSize: 9,
    color: Colors.accent,
    fontWeight: "700",
  },
  trackAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  trackAddText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
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
