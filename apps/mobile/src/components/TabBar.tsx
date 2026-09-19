import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { useApp, TabKey } from "../context/AppContext";

interface TabItem {
  key: TabKey;
  label: string;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
}

const TABS: TabItem[] = [
  { key: "dashboard", label: "Panel", iconActive: "speedometer", iconInactive: "speedometer-outline" },
  { key: "quick_audit", label: "Audit", iconActive: "flash", iconInactive: "flash-outline" },
  { key: "ai", label: "AI Asistan", iconActive: "sparkles", iconInactive: "sparkles-outline" },
  { key: "geo", label: "GEO", iconActive: "globe", iconInactive: "globe-outline" },
  { key: "hub", label: "Diğer", iconActive: "grid", iconInactive: "grid-outline" },
];

export const TabBar: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();

  const isHubChild = [
    "keywords", 
    "competitors", 
    "tasks", 
    "reports", 
    "settings", 
    "content_optimizer", 
    "recommendations", 
    "knowledge", 
    "billing"
  ].includes(activeTab);

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key || (tab.key === "hub" && isHubChild);
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabButton}
              activeOpacity={0.7}
              onPress={() => setActiveTab(tab.key)}
            >
              <View style={[styles.iconWrapper, isActive && styles.iconWrapperActive]}>
                <Ionicons
                  name={isActive ? tab.iconActive : tab.iconInactive}
                  size={20}
                  color={isActive ? Colors.primary : Colors.textMuted}
                />
              </View>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === "ios" ? 22 : 12,
    paddingTop: 6,
    backgroundColor: "transparent",
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },
  bar: {
    flexDirection: "row",
    backgroundColor: "rgba(18, 20, 31, 0.94)",
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    justifyContent: "space-between",
    alignItems: "center",
  },
  tabButton: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 2,
  },
  iconWrapper: {
    width: 36,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapperActive: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    color: Colors.textMuted,
    marginTop: 2,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: "700",
  },
});
