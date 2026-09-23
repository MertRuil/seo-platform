import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";
import { useApp } from "../context/AppContext";
import { addKeyword, createTask, addCompetitor } from "../services/api";

interface QuickActionFabProps {
  onOpenSearch?: () => void;
}

export const QuickActionFab: React.FC<QuickActionFabProps> = ({ onOpenSearch }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"NONE" | "ADD_KEYWORD" | "ADD_TASK" | "ADD_COMPETITOR">("NONE");
  const [inputValue, setInputValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { selectedSite, startCrawl, setActiveTab } = useApp();

  const handleAction = (type: "CRAWL" | "AI" | "KEYWORD" | "TASK" | "COMPETITOR" | "SEARCH") => {
    setMenuOpen(false);
    switch (type) {
      case "CRAWL":
        if (selectedSite) {
          startCrawl(selectedSite.total_pages || 50, selectedSite);
          setActiveTab("quick_audit");
        }
        break;
      case "AI":
        setActiveTab("ai");
        break;
      case "KEYWORD":
        setInputValue("");
        setModalMode("ADD_KEYWORD");
        break;
      case "TASK":
        setInputValue("");
        setModalMode("ADD_TASK");
        break;
      case "COMPETITOR":
        setInputValue("");
        setModalMode("ADD_COMPETITOR");
        break;
      case "SEARCH":
        if (onOpenSearch) onOpenSearch();
        break;
    }
  };

  const handleSubmitModal = async () => {
    if (!inputValue.trim() || !selectedSite) return;
    setIsSubmitting(true);
    try {
      if (modalMode === "ADD_KEYWORD") {
        await addKeyword(selectedSite.id, inputValue.trim());
        setModalMode("NONE");
        setActiveTab("keywords");
      } else if (modalMode === "ADD_TASK") {
        await createTask(selectedSite.id, {
          title: inputValue.trim(),
          description: "Hızlı işlem menüsünden oluşturuldu.",
          priority: "HIGH",
          status: "TODO",
          estimated_impact: "HIGH",
          difficulty: "EASY"
        });
        setModalMode("NONE");
        setActiveTab("tasks");
      } else if (modalMode === "ADD_COMPETITOR") {
        await addCompetitor(selectedSite.id, inputValue.trim());
        setModalMode("NONE");
        setActiveTab("competitors");
      }
    } catch {
      Alert.alert("Hata", "İşlem gerçekleştirilemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fabButton}
        onPress={() => setMenuOpen(true)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Quick Action Sheet Modal */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        >
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHeader}>
              <View style={styles.handle} />
              <Text style={styles.sheetTitle}>Hızlı SEO Aksiyonları</Text>
              <Text style={styles.sheetSub}>Tek tıkla yeni tarama, görev veya optimizasyon başlatın</Text>
            </View>

            <View style={styles.actionsGrid}>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleAction("CRAWL")}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: "rgba(99, 102, 241, 0.18)" }]}>
                  <Ionicons name="play" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.actionLabel}>Siteyi Tara</Text>
                <Text style={styles.actionDesc}>Yeni audit başlat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleAction("AI")}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: "rgba(139, 92, 246, 0.18)" }]}>
                  <Ionicons name="sparkles" size={20} color={Colors.accent} />
                </View>
                <Text style={styles.actionLabel}>AI Asistan</Text>
                <Text style={styles.actionDesc}>Sohbet ve öneriler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleAction("KEYWORD")}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: "rgba(16, 185, 129, 0.18)" }]}>
                  <Ionicons name="trending-up" size={20} color={Colors.success} />
                </View>
                <Text style={styles.actionLabel}>Kelime Ekle</Text>
                <Text style={styles.actionDesc}>Sıralama takibi</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleAction("TASK")}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: "rgba(56, 189, 248, 0.18)" }]}>
                  <Ionicons name="checkbox" size={20} color={Colors.info} />
                </View>
                <Text style={styles.actionLabel}>Görev Ekle</Text>
                <Text style={styles.actionDesc}>SEO yapılacaklar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleAction("COMPETITOR")}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: "rgba(245, 158, 11, 0.18)" }]}>
                  <Ionicons name="people" size={20} color={Colors.warning} />
                </View>
                <Text style={styles.actionLabel}>Rakip Ekle</Text>
                <Text style={styles.actionDesc}>Rakip kıyaslama</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleAction("SEARCH")}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconBox, { backgroundColor: "rgba(239, 68, 68, 0.18)" }]}>
                  <Ionicons name="search" size={20} color={Colors.danger} />
                </View>
                <Text style={styles.actionLabel}>Hızlı Arama</Text>
                <Text style={styles.actionDesc}>Evrensel indeks</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setMenuOpen(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Dynamic Input Prompt Modal (for adding Keyword, Task, Competitor) */}
      <Modal
        visible={modalMode !== "NONE"}
        transparent
        animationType="slide"
        onRequestClose={() => setModalMode("NONE")}
      >
        <View style={styles.backdrop}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>
              {modalMode === "ADD_KEYWORD" && "Yeni Anahtar Kelime"}
              {modalMode === "ADD_TASK" && "Yeni SEO Görevi"}
              {modalMode === "ADD_COMPETITOR" && "Yeni Rakip Domain"}
            </Text>
            <Text style={styles.promptSub}>
              {modalMode === "ADD_KEYWORD" && "Takip etmek istediğiniz hedef anahtar kelimeyi yazın:"}
              {modalMode === "ADD_TASK" && "Yapılacak SEO işleminin başlığını yazın:"}
              {modalMode === "ADD_COMPETITOR" && "Kıyaslamak istediğiniz rakip alan adını girin (ör: rakip.com):"}
            </Text>

            <TextInput
              style={styles.promptInput}
              placeholder={
                modalMode === "ADD_KEYWORD" ? "ör: organik seo uzmanı" :
                modalMode === "ADD_TASK" ? "ör: Meta description optimizasyonu" : "ör: rakipstore.com"
              }
              placeholderTextColor={Colors.textMuted}
              value={inputValue}
              onChangeText={setInputValue}
              autoFocus
            />

            <View style={styles.promptActions}>
              <TouchableOpacity
                style={styles.promptCancelBtn}
                onPress={() => setModalMode("NONE")}
              >
                <Text style={styles.promptCancelText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.promptSubmitBtn, !inputValue.trim() && { opacity: 0.5 }]}
                disabled={!inputValue.trim() || isSubmitting}
                onPress={handleSubmitModal}
              >
                <Text style={styles.promptSubmitText}>
                  {isSubmitting ? "Ekleniyor..." : "Ekle"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fabButton: {
    position: "absolute",
    right: 18,
    bottom: Platform.OS === "ios" ? 104 : 94,
    width: 52,
    height: 52,
    borderRadius: 26,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 999,
  },
  fabGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    borderWidth: 1,
    borderColor: Colors.border,
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sheetSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 18,
  },
  actionItem: {
    width: "48%",
    backgroundColor: Colors.surfaceElevated,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    alignItems: "center",
    gap: 4,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  actionDesc: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  cancelButton: {
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  promptCard: {
    margin: 20,
    backgroundColor: Colors.surface,
    padding: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
    alignSelf: "center",
    width: "90%",
    maxWidth: 400,
    marginBottom: "auto",
    marginTop: "auto",
  },
  promptTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  promptSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  promptInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  promptActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
    marginTop: 6,
  },
  promptCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  promptCancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  promptSubmitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  promptSubmitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
