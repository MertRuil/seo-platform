import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";
import { fetchBacklinks, fetchBacklinkSummary, generateMobileDisavowText } from "../services/api";
import { BacklinkItem, BacklinkSummary } from "../types";

export const BacklinksScreen: React.FC = () => {
  const { selectedSite, setActiveTab } = useApp();
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [summary, setSummary] = useState<BacklinkSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<"ALL" | "TOXIC" | "DOFOLLOW" | "NOFOLLOW">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchBacklinks(selectedSite?.id, selectedSite?.domain),
      fetchBacklinkSummary(selectedSite?.id, selectedSite?.domain),
    ])
      .then(([links, sum]) => {
        setBacklinks(links);
        setSummary(sum);
      })
      .finally(() => setLoading(false));
  }, [selectedSite?.id, selectedSite?.domain]);

  const filteredLinks = useMemo(() => {
    return backlinks.filter((b) => {
      if (filter === "TOXIC" && !b.is_toxic) return false;
      if (filter === "DOFOLLOW" && !b.is_dofollow) return false;
      if (filter === "NOFOLLOW" && b.is_dofollow) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          b.source_domain.toLowerCase().includes(q) ||
          b.source_url.toLowerCase().includes(q) ||
          b.anchor_text.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [backlinks, filter, searchQuery]);

  const handleShareDisavow = async () => {
    const domain = (selectedSite?.domain || "acmestore.io").toLowerCase().replace(/^https?:\/\//, "").split("/")[0].trim();
    const toxicLinks = backlinks.filter((b) => b.is_toxic && b.target_url.toLowerCase().includes(domain));
    if (toxicLinks.length === 0) {
      Alert.alert(
        "Temiz Profil - Disavow Gerekli Değil",
        `"${domain}" sitesi için tespit edilen toksik ya da zararlı backlink bulunmuyor.\n\nSitenize link vermemiş yabancı alan adlarını disavow dosyasına eklemek Google arama sıralamalarınıza zarar verebilir.`
      );
      return;
    }

    const disavowText = generateMobileDisavowText(toxicLinks, domain);

    try {
      await Share.share({
        title: `Google Disavow Dosyası (${domain})`,
        message: disavowText,
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
        <Text style={styles.headerTitle}>Backlink & Toksik Link</Text>
        <TouchableOpacity style={styles.disavowBtn} onPress={handleShareDisavow} activeOpacity={0.7}>
          <Ionicons name="shield-checkmark" size={17} color={Colors.primary} />
          <Text style={styles.disavowBtnText}>Disavow</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 30 }} />
        ) : (
          <>
            {/* KPI Cards Strip */}
            <View style={styles.kpiRow}>
              <GlassCard style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Toplam Link</Text>
                <Text style={styles.kpiValue}>{summary?.total_backlinks || 0}</Text>
                <Text style={styles.kpiSub}>{summary?.referring_domains || 0} Domain</Text>
              </GlassCard>

              <GlassCard style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Dofollow Oranı</Text>
                <Text style={[styles.kpiValue, { color: Colors.success }]}>
                  %{summary?.dofollow_ratio || 0}
                </Text>
                <Text style={styles.kpiSub}>{summary?.dofollow_count || 0} dofollow</Text>
              </GlassCard>

              <GlassCard style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Ort. DR Otorite</Text>
                <Text style={styles.kpiValue}>{summary?.avg_domain_authority || 0}</Text>
                <Text style={styles.kpiSub}>/ 100 Puan</Text>
              </GlassCard>
            </View>

            {/* Toxic Warning Alert Card */}
            {(summary?.toxic_backlinks_count || 0) > 0 ? (
              <GlassCard style={styles.toxicAlertCard}>
                <View style={styles.toxicAlertHeader}>
                  <Ionicons name="alert-circle" size={20} color={Colors.danger} />
                  <Text style={styles.toxicAlertTitle}>
                    {summary?.toxic_backlinks_count} Adet Toksik Backlink Saptandı!
                  </Text>
                </View>
                <Text style={styles.toxicAlertDesc}>
                  PBN, kumar veya spam link çiftliklerinden gelen bu bağlantılar Google cezası riski taşır. Google Search Console için disavow dosyasını tek dokunuşla dışa aktarın.
                </Text>
                <TouchableOpacity style={styles.disavowActionBtn} onPress={handleShareDisavow} activeOpacity={0.8}>
                  <Ionicons name="download-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.disavowActionText}>Google Disavow (.txt) Paylaş / İndir</Text>
                </TouchableOpacity>
              </GlassCard>
            ) : (
              <GlassCard style={styles.cleanStatusCard}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                <Text style={styles.cleanStatusText}>Toksik veya zararlı backlink tespit edilmedi.</Text>
              </GlassCard>
            )}

            {/* Filter Chips */}
            <View style={styles.filterRow}>
              {[
                { id: "ALL", label: `Tümü (${backlinks.length})` },
                { id: "TOXIC", label: `🚨 Toksik (${summary?.toxic_backlinks_count || 0})` },
                { id: "DOFOLLOW", label: `Dofollow (${summary?.dofollow_count || 0})` },
                { id: "NOFOLLOW", label: `Nofollow (${summary?.nofollow_count || 0})` },
              ].map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterChip, filter === f.id && styles.filterChipActive]}
                  onPress={() => setFilter(f.id as any)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterChipText, filter === f.id && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Search Input */}
            <View style={styles.searchBox}>
              <Ionicons name="search" size={15} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Domain veya bağlantı metni ara..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={15} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Backlink List */}
            {filteredLinks.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name="link-outline" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Filtreye uygun backlink bulunamadı.</Text>
              </View>
            ) : (
              filteredLinks.map((item) => (
                <GlassCard
                  key={item.id}
                  style={[
                    styles.backlinkCard,
                    item.is_toxic && { borderColor: "rgba(239, 68, 68, 0.35)", backgroundColor: "rgba(239, 68, 68, 0.05)" }
                  ]}
                >
                  <View style={styles.cardTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.domainTitle} numberOfLines={1}>{item.source_domain}</Text>
                      <Text style={styles.sourceUrl} numberOfLines={1}>{item.source_url}</Text>
                    </View>
                    <View style={styles.scoreBadge}>
                      <Text style={styles.scoreText}>DR {item.domain_authority}</Text>
                    </View>
                  </View>

                  <View style={styles.anchorBox}>
                    <Text style={styles.anchorLabel}>Anchor:</Text>
                    <Text style={styles.anchorValue} numberOfLines={1}>"{item.anchor_text}"</Text>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{item.anchor_category}</Text>
                    </View>
                  </View>

                  <View style={styles.cardBottomRow}>
                    <View style={styles.badgesRow}>
                      <View style={[styles.typeBadge, item.is_dofollow ? styles.typeDofollow : styles.typeNofollow]}>
                        <Text style={[styles.typeBadgeText, item.is_dofollow ? { color: "#34D399" } : { color: Colors.textMuted }]}>
                          {item.is_dofollow ? "Dofollow" : "Nofollow"}
                        </Text>
                      </View>

                      <View style={[styles.spamBadge, item.spam_score > 60 ? styles.spamBadgeHigh : styles.spamBadgeLow]}>
                        <Text style={[styles.spamBadgeText, item.spam_score > 60 ? { color: Colors.danger } : { color: Colors.success }]}>
                          Spam %{item.spam_score}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.dateText}>{item.first_seen}</Text>
                  </View>

                  {item.is_toxic && item.toxicity_reasons.length > 0 && (
                    <View style={styles.toxicReasonBox}>
                      <Ionicons name="warning-outline" size={12} color={Colors.danger} />
                      <Text style={styles.toxicReasonText} numberOfLines={2}>
                        {item.toxicity_reasons.join(" • ")}
                      </Text>
                    </View>
                  )}
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
    backgroundColor: Colors.surface,
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  disavowBtn: {
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
  disavowBtnText: {
    fontSize: 12,
    fontWeight: "700",
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
  kpiRow: {
    flexDirection: "row",
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  kpiLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  kpiSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  toxicAlertCard: {
    padding: 14,
    borderRadius: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  toxicAlertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  toxicAlertTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  toxicAlertDesc: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
    marginBottom: 10,
  },
  disavowActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.danger,
    paddingVertical: 9,
    borderRadius: 9,
  },
  disavowActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  cleanStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
  },
  cleanStatusText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 8 : 4,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
  },
  emptyBox: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  backlinkCard: {
    padding: 12,
    borderRadius: 14,
    gap: 8,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  domainTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  sourceUrl: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginTop: 2,
  },
  scoreBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textPrimary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  anchorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    padding: 6,
    borderRadius: 6,
  },
  anchorLabel: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  anchorValue: {
    flex: 1,
    fontSize: 11,
    color: Colors.textPrimary,
    fontStyle: "italic",
  },
  categoryBadge: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 9,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeDofollow: {
    backgroundColor: "rgba(52, 211, 153, 0.15)",
  },
  typeNofollow: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  spamBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  spamBadgeLow: {
    backgroundColor: "rgba(52, 211, 153, 0.12)",
  },
  spamBadgeHigh: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  spamBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  toxicReasonBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    padding: 6,
    borderRadius: 6,
  },
  toxicReasonText: {
    flex: 1,
    fontSize: 10,
    color: Colors.danger,
    lineHeight: 14,
  },
});
