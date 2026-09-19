import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";
import { MorningBriefData } from "../services/api";

interface MorningBriefCardProps {
  data: MorningBriefData;
  onActionPress?: (action: string) => void;
}

export const MorningBriefCard: React.FC<MorningBriefCardProps> = ({ data, onActionPress }) => {
  return (
    <LinearGradient
      colors={["rgba(99, 102, 241, 0.15)", "rgba(139, 92, 246, 0.06)"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Ionicons name="sunny" size={13} color="#FBBF24" />
          <Text style={styles.badgeText}>GÜNLÜK SABAH BRİFİNGİ</Text>
        </View>
        <Text style={styles.greeting}>{data.greeting}</Text>
      </View>

      <Text style={styles.summaryText}>{data.summary_text}</Text>

      {/* Mini Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>+{data.keywords_up}</Text>
          <Text style={styles.statLabel}>Yükselen Kelime</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: Colors.danger }]}>-{data.keywords_down}</Text>
          <Text style={styles.statLabel}>Düşen Kelime</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: Colors.info }]}>{(data.impressions_today / 1000).toFixed(1)}k</Text>
          <Text style={styles.statLabel}>Organik Imp.</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: Colors.warning }]}>{data.critical_issues}</Text>
          <Text style={styles.statLabel}>Kritik Hata</Text>
        </View>
      </View>

      {/* Today's Recommended 3 Actions */}
      <View style={styles.actionsSection}>
        <Text style={styles.actionsTitle}>Bugün Önerilen 3 İşlem:</Text>
        {data.daily_actions.map((act, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.actionRow}
            onPress={() => onActionPress && onActionPress(act)}
            activeOpacity={0.7}
          >
            <View style={styles.actionNumberBox}>
              <Text style={styles.actionNumber}>{idx + 1}</Text>
            </View>
            <Text style={styles.actionText} numberOfLines={2}>{act}</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FBBF24",
    letterSpacing: 0.5,
  },
  greeting: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  summaryText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(18, 20, 31, 0.7)",
    borderRadius: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: 14,
  },
  statItem: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.success,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.borderSubtle,
  },
  actionsSection: {
    gap: 8,
  },
  actionsTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textPrimary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 10,
  },
  actionNumberBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionNumber: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
  actionText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
  },
});
