import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  ActivityIndicator 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "./GlassCard";
import { useApp } from "../context/AppContext";

export const LiveCrawlCard: React.FC = () => {
  const { activeCrawl, startCrawl, dismissCrawl, selectedSite } = useApp();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedPages, setSelectedPages] = useState(selectedSite?.total_pages || 50);
  const [isStarting, setIsStarting] = useState(false);

  React.useEffect(() => {
    if (selectedSite?.total_pages) {
      setSelectedPages(selectedSite.total_pages);
    }
  }, [selectedSite?.total_pages]);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await startCrawl(selectedPages);
      setModalVisible(false);
    } finally {
      setIsStarting(false);
    }
  };

  const pct = activeCrawl 
    ? Math.min(100, Math.round((activeCrawl.pages_crawled / Math.max(1, activeCrawl.max_pages)) * 100))
    : 0;
  const isCompleted = activeCrawl?.status === "COMPLETED";
  const isRunning = activeCrawl?.status === "RUNNING" || activeCrawl?.status === "QUEUED";

  const dynamicPresets = Array.from(new Set([selectedSite?.total_pages || 14, 25, 50, 100]))
    .filter(n => n > 0)
    .sort((a, b) => a - b);

  return (
    <>
      {/* Active / Completed Crawl Banner */}
      {activeCrawl && (
        <GlassCard 
          variant={isCompleted ? "elevated" : "tinted"} 
          style={styles.crawlCard}
        >
          <View style={styles.topRow}>
            <View style={styles.statusGroup}>
              <View style={[
                styles.pulseDot, 
                { backgroundColor: isCompleted ? Colors.success : Colors.warning }
              ]} />
              <Text style={styles.statusTitle}>
                {isCompleted ? "Tarama Tamamlandı" : "Canlı Googlebot Taraması Sürüyor..."}
              </Text>
            </View>
            <TouchableOpacity onPress={dismissCrawl} style={styles.closeBtn}>
              <Ionicons name="close" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.detailsRow}>
            <Text style={styles.pagesText}>
              {`${activeCrawl.pages_crawled} / ${activeCrawl.max_pages} Sayfa Keşfedildi`}
            </Text>
            <Text style={styles.pctText}>{`%${pct}`}</Text>
          </View>

          {/* Animated Progress Bar */}
          <View style={styles.progressBarBg}>
            <View 
              style={[
                styles.progressBarFill, 
                { 
                  width: `${pct}%`,
                  backgroundColor: isCompleted ? Colors.success : Colors.primary
                }
              ]} 
            />
          </View>

          {/* Currently Scanning Live URL Indicator */}
          {activeCrawl.current_url && !isCompleted && (
            <View style={styles.currentUrlRow}>
              <Ionicons name="search-outline" size={12} color={Colors.primary} />
              <Text style={styles.currentUrlText} numberOfLines={1}>
                {`Taranıyor: ${activeCrawl.current_url}`}
              </Text>
            </View>
          )}

          {isCompleted && (
            <Text style={styles.completedSub}>
              {`Sitedeki ${activeCrawl.max_pages} sayfa eksiksiz denetlendi. SEO sağlık skoru ve bulgular güncellendi.`}
            </Text>
          )}
        </GlassCard>
      )}

      {/* Crawl Launcher Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Ionicons name="flash-outline" size={18} color={Colors.primary} />
                <Text style={styles.modalTitle}>Yeni Tarama Başlat</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              Sitenizdeki tüm bağlantıları ve teknik SEO kriterlerini denetlemek için taranacak sayfa limitini belirleyin.
            </Text>

            <Text style={styles.presetLabel}>Taranacak Sayfa Limiti:</Text>
            <View style={styles.presetsRow}>
              {dynamicPresets.map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.presetBtn,
                    selectedPages === num && styles.presetBtnActive
                  ]}
                  onPress={() => setSelectedPages(num)}
                >
                  <Text style={[
                    styles.presetBtnText,
                    selectedPages === num && styles.presetBtnTextActive
                  ]}>
                    {num}
                  </Text>
                  <Text style={styles.presetSub}>Sayfa</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.startBtn}
              onPress={handleStart}
              disabled={isStarting}
              activeOpacity={0.8}
            >
              {isStarting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="play" size={16} color="#FFFFFF" />
                  <Text style={styles.startBtnText}>Taramayı Başlat ({selectedPages} Sayfa)</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Trigger Button to expose modal */}
      {!isRunning && (
        <TouchableOpacity
          style={styles.launchPill}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="sync-outline" size={16} color={Colors.primary} />
          <Text style={styles.launchPillText}>Yeni Tarama Tetikle</Text>
        </TouchableOpacity>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  crawlCard: {
    marginBottom: 16,
    padding: 16,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: 2,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  pagesText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  pctText: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.primary,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  completedSub: {
    fontSize: 11,
    color: Colors.success,
    marginTop: 8,
    fontWeight: "500",
  },
  currentUrlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  currentUrlText: {
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
    fontFamily: "monospace",
  },
  launchPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 8,
    marginBottom: 16,
  },
  launchPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  modalDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  presetLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetBtnActive: {
    backgroundColor: "rgba(99, 102, 241, 0.18)",
    borderColor: Colors.primary,
  },
  presetBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textSecondary,
  },
  presetBtnTextActive: {
    color: Colors.primary,
  },
  presetSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  startBtn: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  startBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
