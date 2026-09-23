import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "./GlassCard";
import { useApp } from "../context/AppContext";
import { MOCK_KEYWORDS, MOCK_ISSUES, MOCK_TASKS, MOCK_COMPETITORS } from "../services/api";

interface GlobalSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: any) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  visible,
  onClose,
  onNavigateTab
}) => {
  const [query, setQuery] = useState("");
  const { setActiveTab } = useApp();

  const handleSelectTab = (tab: any) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    } else {
      setActiveTab(tab);
    }
    onClose();
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    const matchedKeywords = MOCK_KEYWORDS.filter(k => 
      k.keyword.toLowerCase().includes(q) || k.target_url.toLowerCase().includes(q)
    );

    const matchedIssues = MOCK_ISSUES.filter(i => 
      i.title.toLowerCase().includes(q) || 
      i.description.toLowerCase().includes(q) || 
      i.category.toLowerCase().includes(q)
    );

    const matchedTasks = MOCK_TASKS.filter(t => 
      t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );

    const matchedCompetitors = MOCK_COMPETITORS.filter(c => 
      c.name.toLowerCase().includes(q) || c.domain.toLowerCase().includes(q)
    );

    return {
      keywords: matchedKeywords,
      issues: matchedIssues,
      tasks: matchedTasks,
      competitors: matchedCompetitors,
      total: matchedKeywords.length + matchedIssues.length + matchedTasks.length + matchedCompetitors.length
    };
  }, [query]);

  const quickTags = ["Canonical", "404 Hatası", "Schema", "AI Overview", "LCP", "Robots.txt"];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header & Search Bar */}
          <View style={styles.header}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={Colors.primary} />
              <TextInput
                style={styles.input}
                placeholder="Kelime, hata, rakip veya görev ara..."
                placeholderTextColor={Colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoFocus
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>Kapat</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {/* Quick Filter Tags when query is empty */}
            {!query.trim() && (
              <View style={styles.quickTagsSection}>
                <Text style={styles.sectionTitle}>Hızlı Aramalar</Text>
                <View style={styles.tagsRow}>
                  {quickTags.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.tagChip}
                      onPress={() => setQuery(tag)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trending-up-outline" size={13} color={Colors.textSecondary} />
                      <Text style={styles.tagChipText}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.shortcutsSection}>
                  <Text style={styles.sectionTitle}>Hızlı Bölüm Kısayolları</Text>
                  <View style={styles.shortcutsGrid}>
                    <TouchableOpacity 
                      style={styles.shortcutCard} 
                      onPress={() => handleSelectTab("keywords")}
                    >
                      <View style={[styles.scIcon, { backgroundColor: "rgba(99, 102, 241, 0.15)" }]}>
                        <Ionicons name="trending-up" size={18} color={Colors.primary} />
                      </View>
                      <Text style={styles.scTitle}>Kelimeler</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.shortcutCard} 
                      onPress={() => handleSelectTab("quick_audit")}
                    >
                      <View style={[styles.scIcon, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                        <Ionicons name="flash" size={18} color={Colors.warning} />
                      </View>
                      <Text style={styles.scTitle}>Audit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.shortcutCard} 
                      onPress={() => handleSelectTab("geo")}
                    >
                      <View style={[styles.scIcon, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
                        <Ionicons name="globe-outline" size={18} color={Colors.success} />
                      </View>
                      <Text style={styles.scTitle}>GEO / AI</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={styles.shortcutCard} 
                      onPress={() => handleSelectTab("tasks")}
                    >
                      <View style={[styles.scIcon, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                        <Ionicons name="checkbox-outline" size={18} color={Colors.info} />
                      </View>
                      <Text style={styles.scTitle}>Görevler</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* Search Results */}
            {results && results.total === 0 && (
              <View style={styles.emptyResults}>
                <Ionicons name="search-outline" size={42} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>Eşleşen Sonuç Bulunamadı</Text>
                <Text style={styles.emptySub}>"{query}" için kayıtlı kelime veya SEO sorunu bulunamadı.</Text>
              </View>
            )}

            {results && results.total > 0 && (
              <View style={styles.resultsWrapper}>
                {/* Keywords Results */}
                {results.keywords.length > 0 && (
                  <View style={styles.resultGroup}>
                    <View style={styles.groupHeader}>
                      <Ionicons name="trending-up" size={15} color={Colors.primary} />
                      <Text style={styles.groupTitle}>Anahtar Kelimeler ({results.keywords.length})</Text>
                    </View>
                    {results.keywords.map((kw) => (
                      <GlassCard
                        key={kw.id}
                        style={styles.resultCard}
                        onPress={() => handleSelectTab("keywords")}
                      >
                        <View style={styles.resultRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.resMainText}>{kw.keyword}</Text>
                            <Text style={styles.resSubText}>Hacim: {kw.volume.toLocaleString()} • Zorluk: %{kw.difficulty}</Text>
                          </View>
                          <View style={styles.posBadge}>
                            <Text style={styles.posBadgeText}>#{kw.current_pos}</Text>
                          </View>
                        </View>
                      </GlassCard>
                    ))}
                  </View>
                )}

                {/* Issues Results */}
                {results.issues.length > 0 && (
                  <View style={styles.resultGroup}>
                    <View style={styles.groupHeader}>
                      <Ionicons name="alert-circle" size={15} color={Colors.danger} />
                      <Text style={styles.groupTitle}>SEO Sorunları & Hatalar ({results.issues.length})</Text>
                    </View>
                    {results.issues.map((iss) => (
                      <GlassCard
                        key={iss.rule_id}
                        style={styles.resultCard}
                        onPress={() => handleSelectTab("quick_audit")}
                      >
                        <View style={styles.resultRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.resMainText}>{iss.title}</Text>
                            <Text style={styles.resSubText} numberOfLines={2}>{iss.description}</Text>
                          </View>
                          <View style={[styles.sevBadge, { backgroundColor: iss.severity === "CRITICAL" ? Colors.dangerSurface : Colors.warningSurface }]}>
                            <Text style={[styles.sevBadgeText, { color: iss.severity === "CRITICAL" ? Colors.danger : Colors.warning }]}>
                              {iss.severity === "CRITICAL" ? "Kritik" : "Uyarı"}
                            </Text>
                          </View>
                        </View>
                      </GlassCard>
                    ))}
                  </View>
                )}

                {/* Tasks Results */}
                {results.tasks.length > 0 && (
                  <View style={styles.resultGroup}>
                    <View style={styles.groupHeader}>
                      <Ionicons name="checkbox" size={15} color={Colors.info} />
                      <Text style={styles.groupTitle}>SEO Görevleri ({results.tasks.length})</Text>
                    </View>
                    {results.tasks.map((task) => (
                      <GlassCard
                        key={task.id}
                        style={styles.resultCard}
                        onPress={() => handleSelectTab("tasks")}
                      >
                        <View style={styles.resultRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.resMainText}>{task.title}</Text>
                            <Text style={styles.resSubText}>{task.description}</Text>
                          </View>
                          <Text style={styles.taskStatusText}>{task.status}</Text>
                        </View>
                      </GlassCard>
                    ))}
                  </View>
                )}

                {/* Competitor Results */}
                {results.competitors.length > 0 && (
                  <View style={styles.resultGroup}>
                    <View style={styles.groupHeader}>
                      <Ionicons name="analytics" size={15} color={Colors.accent} />
                      <Text style={styles.groupTitle}>Rakipler ({results.competitors.length})</Text>
                    </View>
                    {results.competitors.map((comp) => (
                      <GlassCard
                        key={comp.id}
                        style={styles.resultCard}
                        onPress={() => handleSelectTab("competitors")}
                      >
                        <View style={styles.resultRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.resMainText}>{comp.name}</Text>
                            <Text style={styles.resSubText}>{comp.domain} • Trafik: {comp.organic_traffic.toLocaleString()}</Text>
                          </View>
                          <View style={styles.compScoreBadge}>
                            <Text style={styles.compScoreText}>{comp.seo_score}</Text>
                          </View>
                        </View>
                      </GlassCard>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "88%",
    borderWidth: 1,
    borderColor: Colors.border,
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  closeBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "500",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  quickTagsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 24,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  tagChipText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "500",
  },
  shortcutsSection: {
    marginTop: 8,
  },
  shortcutsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  shortcutCard: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 8,
  },
  scIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  scTitle: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  emptyResults: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 10,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  emptySub: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 260,
  },
  resultsWrapper: {
    gap: 20,
  },
  resultGroup: {
    gap: 8,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    textTransform: "uppercase",
  },
  resultCard: {
    padding: 12,
    borderRadius: 12,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resMainText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 3,
  },
  resSubText: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  posBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.4)",
  },
  posBadgeText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  sevBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sevBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  taskStatusText: {
    color: Colors.info,
    fontSize: 11,
    fontWeight: "600",
    backgroundColor: Colors.infoSurface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  compScoreBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  compScoreText: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: "700",
  },
});
