import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
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
          <View style={[styles.iconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
            <Ionicons name="flame" size={20} color="#F59E0B" />
          </View>
          <View>
            <Text style={styles.statValue}>{streakDays} Gün</Text>
            <Text style={styles.statLabel}>SEO Serisi 🔥</Text>
          </View>
        </View>

        <View style={styles.separator} />

        {/* Health Improvement */}
        <View style={styles.item}>
          <View style={[styles.iconBox, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
            <Ionicons name="trending-up" size={20} color={Colors.success} />
          </View>
          <View>
            <Text style={[styles.statValue, { color: Colors.success }]}>+{scoreImprovement}</Text>
            <Text style={styles.statLabel}>Aylık Artış</Text>
          </View>
        </View>

        <View style={styles.separator} />

        {/* Weekly Goal */}
        <View style={styles.item}>
          <View style={[styles.iconBox, { backgroundColor: "rgba(99, 102, 241, 0.15)" }]}>
            <Ionicons name="trophy" size={18} color={Colors.primary} />
          </View>
          <View>
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
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
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
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: "500",
    marginTop: 1,
  },
  separator: {
    width: 1,
    height: 28,
    backgroundColor: Colors.borderSubtle,
    marginHorizontal: 8,
  },
});
