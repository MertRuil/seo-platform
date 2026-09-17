import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  ScrollView, 
  Linking,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "./GlassCard";
import { SiteIssueItem } from "../types";

interface IssueDetailModalProps {
  issue: SiteIssueItem | null;
  visible: boolean;
  onClose: () => void;
  onAction?: (issue: SiteIssueItem) => void;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issue,
  visible,
  onClose,
  onAction
}) => {
  if (!issue) return null;

  const isCritical = issue.severity === "CRITICAL";
  const isWarning = issue.severity === "WARNING";
  const sevColor = isCritical ? Colors.danger : isWarning ? Colors.warning : Colors.info;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Sheet Header */}
          <View style={styles.header}>
            <View style={styles.topBadges}>
              <View style={[styles.sevBadge, { backgroundColor: `${sevColor}20`, borderColor: sevColor }]}>
                <View style={[styles.sevDot, { backgroundColor: sevColor }]} />
                <Text style={[styles.sevText, { color: sevColor }]}>{issue.severity}</Text>
              </View>
              <View style={styles.catBadge}>
                <Text style={styles.catText}>{issue.category}</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close-circle" size={26} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {/* Title & Description */}
            <Text style={styles.title}>{issue.title}</Text>
            <Text style={styles.ruleId}>Kural Kodu: {issue.rule_id}</Text>
            <Text style={styles.desc}>{issue.description}</Text>

            {/* AI Recommendation Fix Box */}
            <GlassCard variant="tinted" style={styles.solutionBox}>
              <View style={styles.solutionHeader}>
                <Ionicons name="bulb-outline" size={18} color={Colors.primary} />
                <Text style={styles.solutionTitle}>Önerilen Çözüm Yolu</Text>
              </View>
              <Text style={styles.solutionText}>{issue.recommendation_template}</Text>
            </GlassCard>

            {/* Affected URLs List */}
            <View style={styles.affectedHeader}>
              <Ionicons name="link-outline" size={16} color={Colors.textPrimary} />
              <Text style={styles.affectedTitle}>
                Etkilenen Sayfalar ({issue.affected_url_count})
              </Text>
            </View>

            {issue.affected_urls && issue.affected_urls.length > 0 ? (
              issue.affected_urls.map((url, idx) => (
                <View key={idx} style={styles.urlCard}>
                  <Text style={styles.urlText} numberOfLines={1}>{url}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noUrls}>Kayıtlı örnek URL bulunamadı.</Text>
            )}

            {/* Documentation Link if available */}
            {issue.documentation_url && (
              <TouchableOpacity 
                style={styles.docLink}
                onPress={() => {
                  if (Platform.OS === "web" && typeof window !== "undefined") {
                    window.open(issue.documentation_url!, "_blank");
                  } else {
                    Linking.openURL(issue.documentation_url!);
                  }
                }}
              >
                <Ionicons name="book-outline" size={16} color={Colors.primary} />
                <Text style={styles.docLinkText}>Google Resmi Standart Kılavuzunu Oku</Text>
                <Ionicons name="open-outline" size={14} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Bottom Action Footer */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.actionBtn}
              onPress={() => {
                if (onAction) onAction(issue);
                onClose();
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Otonom AI Düzeltmesi Oluştur</Text>
            </TouchableOpacity>
          </View>
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
    alignItems: "center",
  },
  sheet: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "85%",
    borderTopWidth: 1,
    borderColor: Colors.border,
    paddingTop: 16,
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  topBadges: {
    flexDirection: "row",
    gap: 8,
  },
  sevBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  sevDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sevText: {
    fontSize: 10,
    fontWeight: "700",
  },
  catBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  catText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  closeBtn: {
    padding: 2,
  },
  scroll: {
    maxHeight: 450,
  },
  scrollContent: {
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  ruleId: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: "monospace",
    marginTop: 4,
    marginBottom: 12,
  },
  desc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  solutionBox: {
    padding: 14,
    marginBottom: 20,
  },
  solutionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  solutionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },
  solutionText: {
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  affectedHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  affectedTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  urlCard: {
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  urlText: {
    fontSize: 11,
    color: Colors.info,
    fontFamily: "monospace",
  },
  noUrls: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: "italic",
    marginBottom: 10,
  },
  docLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
    paddingVertical: 6,
  },
  docLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.surfaceElevated,
  },
  actionBtn: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
