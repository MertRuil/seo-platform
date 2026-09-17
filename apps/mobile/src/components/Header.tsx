import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { NotificationsModal } from "./NotificationsModal";
import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "../services/api";
import { NotificationItem } from "../types";

export const Header: React.FC = () => {
  const { sites, selectedSite, setSelectedSite, isLoading, refreshSites } = useApp();
  const { user, logout } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [notifsVisible, setNotifsVisible] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  React.useEffect(() => {
    fetchNotifications().then(setNotifications);
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAsRead = async (id: string) => {
    await markNotificationAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return (
    <>
      <View style={styles.container}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}>
            <Ionicons name="sparkles" size={16} color={Colors.primary} />
          </View>
          <Text style={styles.brandTitle}>SEO Platform</Text>
        </View>

        <View style={styles.actionsRow}>
          {/* Site Selector Pill */}
          <TouchableOpacity 
            style={styles.siteSelector} 
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="globe-outline" size={13} color={Colors.primary} />
            <Text style={styles.siteDomain} numberOfLines={1} ellipsizeMode="tail">
              {(selectedSite?.domain || "").replace(/^https?:\/\//, "") || "Site Ekle"}
            </Text>
            <Ionicons name="chevron-down" size={12} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Notifications Bell Button with Badge */}
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => setNotifsVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={15} color={Colors.textPrimary} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Refresh Button */}
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={refreshSites}
            disabled={isLoading}
          >
            <Ionicons 
              name="refresh-outline" 
              size={15} 
              color={isLoading ? Colors.textMuted : Colors.textPrimary} 
            />
          </TouchableOpacity>

          {/* User / Logout Button */}
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={logout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={15} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications Modal */}
      <NotificationsModal
        visible={notifsVisible}
        onClose={() => setNotifsVisible(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
      />

      {/* Site Switcher Modal Sheet */}
      <Modal 
        visible={modalVisible} 
        transparent 
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Aktif Web Siteleri</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={sites}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View style={{ paddingVertical: 20, alignItems: "center", gap: 6 }}>
                  <Ionicons name="globe-outline" size={28} color={Colors.textMuted} />
                  <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: "600" }}>
                    Henüz kayıtlı bir siteniz yok
                  </Text>
                  <Text style={{ color: Colors.textMuted, fontSize: 11, textAlign: "center", paddingHorizontal: 20 }}>
                    Ana paneldeki formu kullanarak ilk sitenizi hemen tanımlayabilirsiniz.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = selectedSite?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.siteOption, isSelected && styles.siteOptionActive]}
                    onPress={() => {
                      setSelectedSite(item);
                      setModalVisible(false);
                    }}
                  >
                    <View style={styles.siteOptionLeft}>
                      <Ionicons 
                        name="globe" 
                        size={18} 
                        color={isSelected ? Colors.primary : Colors.textSecondary} 
                      />
                      <View>
                        <Text style={[styles.siteOptionName, isSelected && styles.siteOptionNameActive]}>
                          {item.name}
                        </Text>
                        <Text style={styles.siteOptionDomain}>{item.domain}</Text>
                      </View>
                    </View>
                    <View style={styles.siteOptionScore}>
                      <Text style={styles.scoreText}>{item.health_score}</Text>
                      <Text style={styles.scoreLabel}>Sağlık</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    backgroundColor: Colors.background,
    width: "100%",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  logoBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  siteSelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRadius: 16,
    gap: 4,
    maxWidth: 105,
  },
  siteDomain: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textPrimary,
    maxWidth: 55,
  },
  iconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    position: "relative",
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: Colors.danger,
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  bellBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderColor: Colors.border,
    maxHeight: 380,
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  siteOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  siteOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
  },
  siteOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  siteOptionName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  siteOptionNameActive: {
    color: Colors.primary,
  },
  siteOptionDomain: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  siteOptionScore: {
    alignItems: "flex-end",
  },
  scoreText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.success,
  },
  scoreLabel: {
    fontSize: 10,
    color: Colors.textMuted,
  },
});
