import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp, TouchableOpacity } from "react-native";
import { Colors } from "../theme/colors";

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  variant?: "default" | "elevated" | "tinted";
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  children, 
  style, 
  onPress,
  variant = "default" 
}) => {
  const containerStyle = [
    styles.card,
    variant === "elevated" && styles.elevated,
    variant === "tinted" && styles.tinted,
    style
  ];

  if (onPress) {
    return (
      <TouchableOpacity 
        activeOpacity={0.75} 
        onPress={onPress} 
        style={containerStyle}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  elevated: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  tinted: {
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    borderColor: "rgba(99, 102, 241, 0.25)",
  },
});
