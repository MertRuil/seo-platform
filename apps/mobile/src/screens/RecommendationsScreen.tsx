import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert,
  ActivityIndicator 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { fetchRecommendations, executeRecommendation } from "../services/api";
import { RecommendationItem } from "../types";
import { useApp } from "../context/AppContext";

type CategoryFilter = "ALL" | "TECHNICAL" | "SCHEMA" | "CONTENT" | "INTERNAL_LINKING";

export const RecommendationsScreen: React.FC = () => {
  const { selectedSite, activeCrawl } = useApp();
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<CategoryFilter>("ALL");
  const [toast, setToast] = useState<string | null>(null);

  const isScanning = Boolean(selectedSite && !selectedSite.has_completed_crawl && selectedSite.id !== "site-1");

  useEffect(() => {
    if (isScanning) {
      setItems([]);
      setLoading(false);
    } else {
      loadData();
    }
  }, [selectedSite?.id, selectedSite?.has_completed_crawl, isScanning]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchRecommendations(selectedSite?.id || "site-1", selectedSite?.domain);
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (rec: RecommendationItem) => {
    setExecutingId(rec.id);
    try {
      const res = await executeRecommendation(rec.id);
      setToast(res.message || "Değişiklik seti canlı sisteme başarıyla uygulandı.");
      setTimeout(() => setToast(null), 4000);
      // Update local item status to EXECUTED
      setItems(prev => prev.map(item => item.id === rec.id ? { ...item, status: "EXECUTED" } : item));
    } catch {
      setToast("Uygulama sırasında bir hata oluştu.");
      setTimeout(() => setToast(null), 4000);
    } finally {
      setExecutingId(null);
    }
  };

  const filteredItems = items.filter(i => {
    if (filter === "ALL") return true;
    return i.category === filter;
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Otonom AI Tavsiyeleri</Text>
      <Text style={styles.pageSubtitle}>
        Çoklu ajan ağının ürettiği teknik, içerik ve schema düzeltmelerini inceleyin.
      </Text>

      {/* Success Toast Banner */}
      {toast && (
        <View style={styles.toastBanner}>
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Scanning In-Progress State */}
      {isScanning && (
        <GlassCard style={styles.scanningBox}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scanningTitle}>Yapay Zeka Analizi Sürüyor...</Text>
            <Text style={styles.scanningSub}>
              {activeCrawl?.pages_crawled
                ? `Sayfalar taranıyor (${activeCrawl.pages_crawled}/${activeCrawl.max_pages}). Tarama tamamlandığında sitenize özel optimizasyon önerileri oluşturulacaktır.`
                : "Googlebot simülasyonu sayfalarınızı tarıyor. Tamamlandığında sitenize özel teknik ve içerik tavsiyeleri burada listelenecektir."}
            </Text>
          </View>
        </GlassCard>
      )}

      {/* Filter Category Scroll */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        {(["ALL", "TECHNICAL", "SCHEMA", "CONTENT", "INTERNAL_LINKING"] as CategoryFilter[]).map((cat) => {
          const isActive = filter === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.filterChip, isActive && styles.filterChipActive]}
              onPress={() => setFilter(cat)}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {cat === "ALL" ? "Tümü" : cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Items List */}
      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
      ) : filteredItems.length === 0 ? (
        <GlassCard style={styles.emptyCard}>
          <Ionicons name="sparkles-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>
            {isScanning ? "Öneriler Hazırlanıyor" : "Bekleyen Öneri Yok"}
          </Text>
          <Text style={styles.emptyDesc}>
            {isScanning
              ? "Tarama devam ettiği için öneriler analiz tamamlandığında listelenecektir."
              : "Bu filtreye ait aktif bir AI tavsiyesi bulunmuyor veya siteniz bu kategorideki tüm kurallara uyum sağlıyor."}
          </Text>
        </GlassCard>
      ) : (
        filteredItems.map((rec) => {
          const isExecuted = rec.status === "EXECUTED";
          const isPending = rec.status === "PENDING";
          const isExecuting = executingId === rec.id;

          return (
            <GlassCard key={rec.id} style={styles.recCard}>
              <View style={styles.recTop}>
                <View style={styles.catBadge}>
                  <Ionicons 
                    name={
                      rec.category === "TECHNICAL" ? "construct-outline" :
                      rec.category === "SCHEMA" ? "code-slash-outline" :
                      rec.category === "CONTENT" ? "document-text-outline" : "git-network-outline"
                    } 
                    size={12} 
                    color={Colors.primary} 
                  />
                  <Text style={styles.catText}>{rec.category}</Text>
                </View>

                <View style={styles.badgesRow}>
                  <View style={[
                    styles.riskPill,
                    rec.risk_level === "LOW" && styles.riskLow,
                    rec.risk_level === "MEDIUM" && styles.riskMedium,
                  ]}>
                    <Text style={styles.riskText}>{rec.risk_level} RİSK</Text>
                  </View>

                  <View style={styles.impactPill}>
                    <Text style={styles.impactText}>+{rec.estimated_impact} Puan</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.recTitle}>{rec.title}</Text>
              <Text style={styles.recDesc}>{rec.description}</Text>

              {/* Action Buttons */}
              <View style={styles.recBottom}>
                {isExecuted ? (
                  <View style={styles.executedBadge}>
                    <Ionicons name="checkmark-done" size={16} color={Colors.success} />
                    <Text style={styles.executedText}>Canlıda Uygulandı</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.executeBtn}
                    onPress={() => handleExecute(rec)}
                    disabled={isExecuting}
                    activeOpacity={0.8}
                  >
                    {isExecuting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.executeBtnText}>Onayla & Canlıya Uygula</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </GlassCard>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    marginBottom: 16,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterContainer: {
    gap: 8,
  },
  filterChip: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  recCard: {
    marginBottom: 14,
    padding: 16,
  },
  recTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  catBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  catText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primary,
  },
  badgesRow: {
    flexDirection: "row",
    gap: 6,
  },
  riskPill: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  riskLow: {
    backgroundColor: Colors.successSurface,
  },
  riskMedium: {
    backgroundColor: Colors.warningSurface,
  },
  riskText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  impactPill: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  impactText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.primary,
  },
  recTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 6,
    lineHeight: 20,
  },
  recDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  recBottom: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  executeBtn: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  executeBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  executedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.successSurface,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 6,
  },
  executedText: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: "600",
  },
  toastBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  toastText: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  scanningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  scanningTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  scanningSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 12,
  },
});
