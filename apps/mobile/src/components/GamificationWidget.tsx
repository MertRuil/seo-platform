import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, tint } from "../theme/colors";
import { GlassCard } from "./GlassCard";

interface GamificationWidgetProps {
  streakDays?: number;
  scoreImprovement?: number;
  completedTasks?: number;
  weeklyGoalTotal?: number;
}

export const GamificationWidget: React.FC<GamificationWidgetProps> = ({
  streakDays = 7,
  scoreImprovement = 15,
  completedTasks = 3,
  weeklyGoalTotal = 4
}) => {
  return (
    <GlassCard variant="elevated" style={styles.card}>
      <View style={styles.row}>
        {/* Streak Item */}
        <View style={styles.item}>
          <View style={[styles.iconBox, { backgroundColor: tint(Colors.warning, 0.15) }]}>
            <Ionicons name="flame" size={20} color={Colors.warning} />
          </View>
          <View style={styles.text}>
            <Text style={styles.statValue}>{streakDays} Gün</Text>
            <Text style={styles.statLabel}>SEO serisi</Text>
          </View>
        </View>

        <View style={styles.separator} />

        {/* Health Improvement */}
        <View style={styles.item}>
          <View style={[styles.iconBox, { backgroundColor: tint(Colors.success, 0.15) }]}>
            <Ionicons name="trending-up" size={20} color={Colors.success} />
          </View>
          <View style={styles.text}>
            <Text style={[styles.statValue, { color: Colors.success }]}>+{scoreImprovement}</Text>
            <Text style={styles.statLabel}>Aylık Artış</Text>
          </View>
        </View>

        <View style={styles.separator} />

        {/* Weekly Goal */}
        <View style={styles.item}>
          <View style={[styles.iconBox, { backgroundColor: tint(Colors.primaryFill, 0.15) }]}>
            <Ionicons name="trophy" size={18} color={Colors.primary} />
          </View>
          <View style={styles.text}>
            <Text style={styles.statValue}>{completedTasks}/{weeklyGoalTotal}</Text>
            <Text style={styles.statLabel}>Haftalık Hedef</Text>
          </View>
        </View>
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // 12 pt etiketler üç sütunda yan yana sığmadığı için ikon üstte, metin altta.
  item: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  text: {
    alignItems: "center",
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "500",
    marginTop: 1,
  },
  separator: {
    width: 1,
    height: 48,
    backgroundColor: Colors.borderSubtle,
    marginHorizontal: 4,
  },
});
