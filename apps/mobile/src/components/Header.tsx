import React, { useState } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  FlatList, 
  TextInput, 
  ActivityIndicator 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { NotificationsModal } from "./NotificationsModal";
import { GlobalSearchModal } from "./GlobalSearchModal";
import { fetchNotifications, markNotificationAsRead, markAllNotificationsAsRead } from "../services/api";
import { NotificationItem } from "../types";

export const Header: React.FC = () => {
  const { sites, selectedSite, setSelectedSite, isLoading, refreshSites, addNewSite, startCrawl } = useApp();
  const { user, logout } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [notifsVisible, setNotifsVisible] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Add site modal state
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [newSiteUrl, setNewSiteUrl] = useState("");
  const [newSiteName, setNewSiteName] = useState("");
  const [addSiteLoading, setAddSiteLoading] = useState(false);
  const [addSiteError, setAddSiteError] = useState<string | null>(null);

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

  const handleCreateNewSite = async () => {
    setAddSiteError(null);
    if (!newSiteUrl.trim()) {
      setAddSiteError("Lütfen web sitesi URL veya alan adını girin.");
      return;
    }
    setAddSiteLoading(true);
    try {
      const site = await addNewSite(newSiteName.trim(), newSiteUrl.trim(), newSiteUrl.trim());
      await startCrawl(site.total_pages || 50, site);
      setSelectedSite(site);
      setIsAddingSite(false);
      setModalVisible(false);
      setNewSiteUrl("");
      setNewSiteName("");
    } catch {
      setAddSiteError("Site eklenirken bir hata oluştu.");
    } finally {
      setAddSiteLoading(false);
    }
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
            onPress={() => {
              setIsAddingSite(false);
              setModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="globe-outline" size={13} color={Colors.primary} />
            <Text style={styles.siteDomain} numberOfLines={1} ellipsizeMode="tail">
              {(selectedSite?.domain || "").replace(/^https?:\/\//, "") || "Site Ekle"}
            </Text>
            <Ionicons name="chevron-down" size={12} color={Colors.textSecondary} />
          </TouchableOpacity>

          {/* Global Search Button */}
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => setSearchVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="search-outline" size={15} color={Colors.textPrimary} />
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

      {/* Global Search Modal */}
      <GlobalSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
      />

      {/* Notifications Modal */}
      <NotificationsModal
        visible={notifsVisible}
        onClose={() => setNotifsVisible(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
      />

      {/* Sites & Add Site Dropdown Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsAddingSite(false);
          setModalVisible(false);
        }}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => {
            setIsAddingSite(false);
            setModalVisible(false);
          }}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            {!isAddingSite ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Aktif Web Siteleri</Text>
                  <TouchableOpacity onPress={() => setModalVisible(false)}>
                    <Ionicons name="close-circle" size={24} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={sites}
                  keyExtractor={(item) => item.id}
                  style={{ maxHeight: 280 }}
                  ListEmptyComponent={
                    <View style={{ paddingVertical: 20, alignItems: "center", gap: 6 }}>
                      <Ionicons name="globe-outline" size={28} color={Colors.textMuted} />
                      <Text style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: "600" }}>
                        Henüz kayıtlı bir siteniz yok
                      </Text>
                      <Text style={{ color: Colors.textMuted, fontSize: 11, textAlign: "center", paddingHorizontal: 20 }}>
                        Aşağıdaki butona tıklayarak sitenizi hemen tanımlayabilirsiniz.
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

                {/* Add New Site Button Trigger */}
                <TouchableOpacity
                  style={styles.addNewSiteTriggerBtn}
                  onPress={() => {
                    setAddSiteError(null);
                    setIsAddingSite(true);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle" size={18} color={Colors.primary} />
                  <Text style={styles.addNewSiteTriggerText}>+ Yeni Web Sitesi Ekle</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Add New Site Form View */
              <View style={styles.addSiteFormContainer}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity 
                    style={styles.backButton}
                    onPress={() => setIsAddingSite(false)}
                  >
                    <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
                    <Text style={styles.modalTitle}>Yeni Web Sitesi Ekle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setIsAddingSite(false); setModalVisible(false); }}>
                    <Ionicons name="close-circle" size={24} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {addSiteError && (
                  <View style={styles.formErrorBanner}>
                    <Ionicons name="alert-circle" size={15} color={Colors.danger} />
                    <Text style={styles.formErrorText}>{addSiteError}</Text>
                  </View>
                )}

                <Text style={styles.formLabel}>Web Sitesi URL Adresi *</Text>
                <View style={styles.formInputWrapper}>
                  <Ionicons name="globe-outline" size={16} color={Colors.primary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.formInput}
                    placeholder="https://benimsitem.com"
                    placeholderTextColor={Colors.textMuted}
                    value={newSiteUrl}
                    onChangeText={setNewSiteUrl}
                    autoCapitalize="none"
                    keyboardType="url"
                    autoCorrect={false}
                  />
                </View>

                <Text style={[styles.formLabel, { marginTop: 10 }]}>Site Adı (İsteğe Bağlı)</Text>
                <View style={styles.formInputWrapper}>
                  <Ionicons name="business-outline" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.formInput}
                    placeholder="Örn: E-Ticaret Mağazam"
                    placeholderTextColor={Colors.textMuted}
                    value={newSiteName}
                    onChangeText={setNewSiteName}
                  />
                </View>

                {/* Sector Preset Chips */}
                <Text style={[styles.formLabel, { marginTop: 10 }]}>Hızlı Sektör Seçimi:</Text>
                <View style={styles.presetChipsRow}>
                  {[
                    { label: "🛍️ E-Ticaret", domain: "shop.acmestore.io", name: "Acme Butik" },
                    { label: "⚡ SaaS", domain: "cloudapp.tech", name: "CloudApp" },
                    { label: "📝 Blog", domain: "techtrends.blog", name: "Tech Trends" },
                    { label: "🏢 Kurumsal", domain: "atlasdanismanlik.com", name: "Atlas Danışmanlık" },
                  ].map((preset, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.presetChip}
                      onPress={() => {
                        setNewSiteUrl(`https://${preset.domain}`);
                        setNewSiteName(preset.name);
                      }}
                    >
                      <Text style={styles.presetChipText}>{preset.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[styles.addSiteSubmitBtn, addSiteLoading && { opacity: 0.7 }]}
                  onPress={handleCreateNewSite}
                  disabled={addSiteLoading}
                >
                  {addSiteLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name="rocket-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.addSiteSubmitText}>Siteyi Ekle & Taramayı Başlat</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}
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
    maxHeight: 520,
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
  addNewSiteTriggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    marginTop: 8,
  },
  addNewSiteTriggerText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },
  addSiteFormContainer: {
    paddingBottom: 10,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  formErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.dangerSurface,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  formErrorText: {
    fontSize: 11,
    color: Colors.danger,
    fontWeight: "600",
  },
  formLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  formInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    marginBottom: 8,
  },
  formInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    height: "100%",
  },
  presetChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
    marginBottom: 14,
  },
  presetChip: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  presetChipText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  addSiteSubmitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  addSiteSubmitText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
