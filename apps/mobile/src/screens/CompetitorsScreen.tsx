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
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";
import { fetchCompetitors, addCompetitor, fetchCompetitorGap } from "../services/api";
import { CompetitorItem, CompetitorGapItem } from "../types";

export const CompetitorsScreen: React.FC = () => {
  const { selectedSite, setActiveTab } = useApp();
  const [activeTabSub, setActiveTabSub] = useState<"LIST" | "GAP">("LIST");

  const [competitors, setCompetitors] = useState<CompetitorItem[]>([]);
  const [gapItems, setGapItems] = useState<CompetitorGapItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Add Competitor Modal
  const [addModal, setAddModal] = useState(false);
  const [compDomain, setCompDomain] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    if (selectedSite) {
      setLoading(true);
      Promise.all([
        fetchCompetitors(selectedSite.id, selectedSite.domain),
        fetchCompetitorGap(selectedSite.id)
      ]).then(([comps, gap]) => {
        setCompetitors(comps);
        setGapItems(gap);
      }).finally(() => setLoading(false));
    }
  }, [selectedSite?.id, selectedSite?.domain]);

  const handleAdd = async () => {
    if (!compDomain.trim() || !selectedSite) return;
    setIsAdding(true);
    try {
      const created = await addCompetitor(selectedSite.id, compDomain.trim());
      setCompetitors(prev => [created, ...prev]);
      setCompDomain("");
      setAddModal(false);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setActiveTab("hub")} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rakip Analizi</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)} activeOpacity={0.7}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTabSub === "LIST" && styles.tabBtnActive]}
          onPress={() => setActiveTabSub("LIST")}
          activeOpacity={0.7}
        >
          <Ionicons name="people" size={15} color={activeTabSub === "LIST" ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTabSub === "LIST" && styles.tabTextActive]}>
            Rakipler ({competitors.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTabSub === "GAP" && styles.tabBtnActive]}
          onPress={() => setActiveTabSub("GAP")}
          activeOpacity={0.7}
        >
          <Ionicons name="git-compare" size={15} color={activeTabSub === "GAP" ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTabSub === "GAP" && styles.tabTextActive]}>
            Keyword Gap ({gapItems.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.loadingText}>Rakip verileri çekiliyor...</Text>
          </View>
        ) : activeTabSub === "LIST" ? (
          <>
            {/* My Site vs Competitors Benchmark Pill */}
            <GlassCard style={styles.benchmarkCard}>
              <View style={styles.benchHeader}>
                <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
                <Text style={styles.benchTitle}>Benim Sitem vs Rakipler</Text>
              </View>
              <Text style={styles.benchDesc}>
                {selectedSite?.name || "Web Siteniz"} alan adı sektördeki 3 ana rakiple indekslenme ve GEO görünürlüğü açısından karşılaştırılıyor.
              </Text>
            </GlassCard>

            {competitors.map((comp) => (
              <GlassCard key={comp.id} style={styles.compCard}>
                <View style={styles.compHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.compName}>{comp.name}</Text>
                    <Text style={styles.compDomain}>{comp.domain}</Text>
                  </View>
                  <View style={styles.scoreCircle}>
                    <Text style={styles.scoreCircleNum}>{comp.seo_score}</Text>
                    <Text style={styles.scoreCircleLbl}>SEO Skoru</Text>
                  </View>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{(comp.organic_traffic / 1000).toFixed(0)}K</Text>
                    <Text style={styles.statLbl}>Aylık Trafik</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{(comp.ranked_keywords / 1000).toFixed(1)}K</Text>
                    <Text style={styles.statLbl}>Kelimeler</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{(comp.backlinks / 1000).toFixed(0)}K</Text>
                    <Text style={styles.statLbl}>Backlink</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={[styles.statVal, { color: Colors.accent }]}>%{comp.geo_visibility}</Text>
                    <Text style={styles.statLbl}>GEO Görünürlük</Text>
                  </View>
                </View>

                {/* Top Keywords Chips */}
                <View style={styles.kwChipsRow}>
                  {comp.top_keywords.map((kw, i) => (
                    <View key={i} style={styles.chip}>
                      <Text style={styles.chipText}>{kw}</Text>
                    </View>
                  ))}
                </View>
              </GlassCard>
            ))}
          </>
        ) : (
          <>
            {/* Keyword Gap Explanation */}
            <GlassCard style={styles.benchmarkCard}>
              <View style={styles.benchHeader}>
                <Ionicons name="sparkles" size={16} color={Colors.accent} />
                <Text style={styles.benchTitle}>Yüksek Kazançlı Fırsat Kelimeleri</Text>
              </View>
              <Text style={styles.benchDesc}>
                Rakiplerinizin ilk sayfada olduğu ancak sitenizin henüz sıralanmadığı veya geride kaldığı kritik kelimeler:
              </Text>
            </GlassCard>

            {gapItems.map((gap, idx) => (
              <GlassCard key={idx} style={styles.gapCard}>
                <View style={styles.gapTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gapTitle}>{gap.keyword}</Text>
                    <Text style={styles.gapVolume}>Aranma Hacmi: {gap.volume.toLocaleString()} / Ay</Text>
                  </View>
                  <View style={styles.oppBadge}>
                    <Text style={styles.oppScore}>%{gap.opportunity_score} Fırsat</Text>
                  </View>
                </View>

                {/* Position Comparison */}
                <View style={styles.gapCompRow}>
                  <View style={styles.posBox}>
                    <Text style={styles.posBoxLbl}>Benim Sıram</Text>
                    <Text style={[styles.posBoxVal, { color: gap.my_position ? Colors.warning : Colors.danger }]}>
                      {gap.my_position ? `#${gap.my_position}` : "Yok (>100)"}
                    </Text>
                  </View>

                  {Object.entries(gap.competitor_positions).map(([d, p]) => (
                    <View key={d} style={styles.posBox}>
                      <Text style={styles.posBoxLbl} numberOfLines={1}>{d.split(".")[0]}</Text>
                      <Text style={[styles.posBoxVal, { color: Colors.success }]}>#{p}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={styles.gapActionBtn}
                  onPress={() => setActiveTab("ai")}
                  activeOpacity={0.8}
                >
                  <Ionicons name="flash" size={13} color="#FFFFFF" />
                  <Text style={styles.gapActionText}>AI ile Bu Kelime İçin İçerik Oluştur</Text>
                </TouchableOpacity>
              </GlassCard>
            ))}
          </>
        )}
      </ScrollView>

      {/* Add Competitor Modal */}
      <Modal visible={addModal} transparent animationType="slide" onRequestClose={() => setAddModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rakip Web Sitesi Ekle</Text>
            <Text style={styles.modalSub}>Sektörünüzde karşılaştırmak istediğiniz rakip alan adını yazın:</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Örn: ahrefs.com veya rakip.com"
              placeholderTextColor={Colors.textMuted}
              value={compDomain}
              onChangeText={setCompDomain}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAddModal(false)}>
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, !compDomain.trim() && { opacity: 0.5 }]}
                disabled={!compDomain.trim() || isAdding}
                onPress={handleAdd}
              >
                <Text style={styles.modalSubmitText}>{isAdding ? "Ekleniyor..." : "Rakibi Ekle"}</Text>
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
  loadingBox: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  benchmarkCard: {
    padding: 14,
    borderRadius: 14,
  },
  benchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  benchTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  benchDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  compCard: {
    padding: 16,
    borderRadius: 16,
  },
  compHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  compName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  compDomain: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  scoreCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 2,
    borderColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreCircleNum: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.success,
  },
  scoreCircleLbl: {
    fontSize: 8,
    color: Colors.textMuted,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: 8,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  statVal: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  statLbl: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2,
  },
  kwChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  gapCard: {
    padding: 16,
    borderRadius: 16,
  },
  gapTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  gapTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  gapVolume: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  oppBadge: {
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  oppScore: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  gapCompRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  posBox: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  posBoxLbl: {
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  posBoxVal: {
    fontSize: 13,
    fontWeight: "700",
  },
  gapActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  gapActionText: {
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
