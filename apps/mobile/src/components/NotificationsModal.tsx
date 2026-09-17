import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  ScrollView 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "./GlassCard";
import { NotificationItem } from "../types";

interface NotificationsModalProps {
  visible: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  visible,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead
}) => {
  const [filter, setFilter] = useState<"ALL" | "UNREAD" | "CRITICAL">("ALL");

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const filtered = notifications.filter(n => {
    if (filter === "UNREAD") return !n.is_read;
    if (filter === "CRITICAL") return n.type === "CRITICAL_ALERT";
    return true;
  });

  const getIconForType = (type: NotificationItem["type"]) => {
    switch (type) {
      case "CRITICAL_ALERT":
        return { name: "alert-circle" as const, color: Colors.danger };
      case "CRAWL_COMPLETE":
        return { name: "checkmark-circle" as const, color: Colors.success };
      case "AI_RECOMMENDATION":
        return { name: "sparkles" as const, color: Colors.primary };
      case "BILLING_UPDATE":
        return { name: "card" as const, color: Colors.info };
    }
  };

  const formatTimeAgo = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Az önce";
    if (diffMins < 60) return `${diffMins} dk önce`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} sa önce`;
    return `${Math.floor(diffHours / 24)} gün önce`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerTitle}>Bildirimler</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </View>

            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={onMarkAllAsRead} style={styles.markAllBtn}>
                  <Text style={styles.markAllText}>Tümünü Oku</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close-circle" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Chips */}
          <View style={styles.filterRow}>
            {(["ALL", "UNREAD", "CRITICAL"] as const).map((f) => {
              const isActive = filter === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                    {f === "ALL" ? "Tümü" : f === "UNREAD" ? "Okunmamış" : "Kritik"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Notification Items List */}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {filtered.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="notifications-off-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>Yeni bildiriminiz yok.</Text>
              </View>
            ) : (
              filtered.map((item) => {
                const icon = getIconForType(item.type);
                return (
                  <GlassCard
                    key={item.id}
                    style={styles.notifCard}
                    onPress={() => onMarkAsRead(item.id)}
                  >
                    <View style={styles.notifRow}>
                      <View style={[styles.iconBox, { backgroundColor: `${icon.color}15` }]}>
                        <Ionicons name={icon.name} size={18} color={icon.color} />
                      </View>

                      <View style={styles.notifContent}>
                        <View style={styles.notifTop}>
                          <Text style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]}>
                            {item.title}
                          </Text>
                          <Text style={styles.notifTime}>{formatTimeAgo(item.created_at)}</Text>
                        </View>
                        <Text style={styles.notifMessage}>{item.message}</Text>
                      </View>

                      {!item.is_read && (
                        <View style={styles.unreadDot} />
                      )}
                    </View>
                  </GlassCard>
                );
              })
            )}
          </ScrollView>
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
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  markAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  filterChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  scroll: {
    maxHeight: 480,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 4,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  notifCard: {
    marginBottom: 10,
    padding: 14,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  notifContent: {
    flex: 1,
  },
  notifTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    maxWidth: 200,
  },
  notifTitleUnread: {
    color: Colors.textPrimary,
    fontWeight: "800",
  },
  notifTime: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  notifMessage: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 6,
  },
});
