import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";
import { SeoOpportunityCard } from "../types";

interface OpportunityFeedProps {
  opportunities: SeoOpportunityCard[];
  onTakeAction?: (opp: SeoOpportunityCard) => void;
}

export const OpportunityFeedCard: React.FC<OpportunityFeedProps> = ({
  opportunities,
  onTakeAction
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={16} color={Colors.accent} />
          <Text style={styles.headerTitle}>SEO Fırsat Akışı</Text>
        </View>
        <Text style={styles.badgeCount}>{opportunities.length} Fırsat</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
      >
        {opportunities.map((opp) => (
          <LinearGradient
            key={opp.id}
            colors={["#181B2A", "#12141F"]}
            style={styles.card}
          >
            <View style={styles.cardTop}>
              <View style={styles.pillBadge}>
                <Text style={styles.pillBadgeText}>{opp.badge}</Text>
              </View>
              <View style={styles.diffBadge}>
                <Text style={styles.diffBadgeText}>{opp.difficulty}</Text>
              </View>
            </View>

            <Text style={styles.cardTitle}>{opp.title}</Text>
            <Text style={styles.cardSubtitle} numberOfLines={2}>{opp.subtitle}</Text>

            <View style={styles.potentialBox}>
              <Ionicons name="trending-up" size={14} color={Colors.success} />
              <Text style={styles.potentialText}>{opp.potential}</Text>
            </View>

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onTakeAction && onTakeAction(opp)}
              activeOpacity={0.8}
            >
              <Text style={styles.actionBtnText}>{opp.action_label}</Text>
              <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  badgeCount: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.accent,
    backgroundColor: "rgba(139, 92, 246, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  scrollContent: {
    gap: 12,
    paddingRight: 16,
  },
  card: {
    width: 260,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: "space-between",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  pillBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillBadgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  diffBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  diffBadgeText: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: "600",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: 12,
  },
  potentialBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  potentialText: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: "700",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
