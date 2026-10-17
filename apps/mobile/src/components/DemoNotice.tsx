import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";

/**
 * Ölçülmemiş veya örnek veri gösteren ekranların başında durur.
 * Kullanıcı örnek değerleri kendi sitesinin gerçek verisi sanmasın.
 */
export function DemoNotice({ text = "Bu ekrandaki değerler örnektir; siteniz için ölçülmüş veri değildir." }: { text?: string }) {
  return (
    <View style={styles.box} accessibilityRole="text" accessibilityLabel={`Örnek veri. ${text}`}>
      <Ionicons name="flask-outline" size={14} color={Colors.warning} />
      <Text style={styles.text}>
        <Text style={styles.strong}>Örnek veri · </Text>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.warningSurface,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    marginBottom: 12,
  },
  text: { flex: 1, color: Colors.warning, fontSize: 13, lineHeight: 18 },
  strong: { fontWeight: "700" },
});
