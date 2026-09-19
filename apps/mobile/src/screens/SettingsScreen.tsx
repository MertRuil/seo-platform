import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { fetchAppSettings, updateAppSettings } from "../services/api";
import { AppSettings } from "../types";

export const SettingsScreen: React.FC = () => {
  const { setActiveTab } = useApp();
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    fetchAppSettings().then(setSettings);
  }, []);

  const handleToggleBiometric = async (val: boolean) => {
    if (!settings) return;
    const updated = await updateAppSettings({ biometric_enabled: val });
    setSettings(updated);
  };

  const handleTogglePush = async (val: boolean) => {
    if (!settings) return;
    const updated = await updateAppSettings({ push_alerts: val });
    setSettings(updated);
  };

  const handleToggleMorningBrief = async (val: boolean) => {
    if (!settings) return;
    const updated = await updateAppSettings({ morning_brief_enabled: val });
    setSettings(updated);
  };

  const handleToggleIntegration = async (intId: string) => {
    if (!settings) return;
    const updatedList = settings.connected_integrations.map(i =>
      i.id === intId ? { ...i, is_connected: !i.is_connected } : i
    );
    const updated = await updateAppSettings({ connected_integrations: updatedList });
    setSettings(updated);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setActiveTab("hub")} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ayarlar & Güvenlik</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <GlassCard style={styles.profileCard}>
          <View style={styles.avatarBox}>
            <Ionicons name="person" size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.name || "Kullanıcı"}</Text>
            <Text style={styles.profileEmail}>{user?.email || "user@seoplatform.io"}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>GROWTH PRO PLAN</Text>
            </View>
          </View>
        </GlassCard>

        {/* Security & Biometrics */}
        <Text style={styles.sectionTitle}>Güvenlik & Giriş</Text>
        <GlassCard style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="scan-outline" size={20} color={Colors.primary} />
              <View>
                <Text style={styles.settingTitle}>Face ID / Biyometrik Giriş</Text>
                <Text style={styles.settingSub}>Uygulamayı biyometrik parmak izi veya yüz tanıma ile açın</Text>
              </View>
            </View>
            <Switch
              value={settings?.biometric_enabled ?? true}
              onValueChange={handleToggleBiometric}
              trackColor={{ false: Colors.surfaceElevated, true: Colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </GlassCard>

        {/* Notifications & Morning Brief */}
        <Text style={styles.sectionTitle}>Bildirimler & Raporlar</Text>
        <GlassCard style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={20} color={Colors.warning} />
              <View>
                <Text style={styles.settingTitle}>Push Bildirimleri</Text>
                <Text style={styles.settingSub}>Kritik SEO hataları ve sıralama değişikliklerinde uyar</Text>
              </View>
            </View>
            <Switch
              value={settings?.push_alerts ?? true}
              onValueChange={handleTogglePush}
              trackColor={{ false: Colors.surfaceElevated, true: Colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Ionicons name="sunny-outline" size={20} color="#FBBF24" />
              <View>
                <Text style={styles.settingTitle}>Sabah Brifingi (Morning Brief)</Text>
                <Text style={styles.settingSub}>Her sabah saat 09:00'da dünün SEO özetini göster</Text>
              </View>
            </View>
            <Switch
              value={settings?.morning_brief_enabled ?? true}
              onValueChange={handleToggleMorningBrief}
              trackColor={{ false: Colors.surfaceElevated, true: Colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </GlassCard>

        {/* Connected Integrations */}
        <Text style={styles.sectionTitle}>Bağlı Entegrasyonlar</Text>
        <GlassCard style={styles.groupCard}>
          {settings?.connected_integrations.map((int, i) => (
            <React.Fragment key={int.id}>
              {i > 0 && <View style={styles.divider} />}
              <View style={styles.settingRow}>
                <View style={styles.settingLeft}>
                  <Ionicons
                    name={int.icon === "google" ? "logo-google" : int.icon === "slack" ? "logo-slack" : "globe-outline"}
                    size={20}
                    color={int.is_connected ? Colors.success : Colors.textMuted}
                  />
                  <View>
                    <Text style={styles.settingTitle}>{int.name}</Text>
                    <Text style={styles.settingSub}>
                      {int.is_connected ? `Bağlı • ${int.last_synced || "Aktif"}` : "Bağlantı kesildi"}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.intBtn, int.is_connected ? styles.intBtnActive : styles.intBtnInactive]}
                  onPress={() => handleToggleIntegration(int.id)}
                >
                  <Text style={[styles.intBtnText, int.is_connected ? styles.intBtnTextActive : styles.intBtnTextInactive]}>
                    {int.is_connected ? "Bağlı" : "Bağla"}
                  </Text>
                </TouchableOpacity>
              </View>
            </React.Fragment>
          ))}
        </GlassCard>

        {/* Account Data & Logout */}
        <Text style={styles.sectionTitle}>Hesap Yönetimi</Text>
        <GlassCard style={styles.groupCard}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Alert.alert("Veri Dışa Aktarma", "Tüm SEO analitik verileriniz ve tarama kayıtlarınız JSON/CSV formatında e-posta adresinize gönderildi.")}
          >
            <Ionicons name="download-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.actionRowText}>Hesap Verilerini Dışa Aktar (GDPR)</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionRow} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
            <Text style={[styles.actionRowText, { color: Colors.danger }]}>Oturumu Kapat</Text>
          </TouchableOpacity>
        </GlassCard>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    gap: 14,
  },
  avatarBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  profileEmail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  roleBadgeText: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  groupCard: {
    padding: 14,
    borderRadius: 16,
    gap: 12,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  settingSub: {
    fontSize: 11,
    color: Colors.textMuted,
    maxWidth: 240,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
  },
  intBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  intBtnActive: {
    backgroundColor: Colors.successSurface,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  intBtnInactive: {
    backgroundColor: Colors.surface,
    borderColor: Colors.borderSubtle,
  },
  intBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  intBtnTextActive: {
    color: Colors.success,
  },
  intBtnTextInactive: {
    color: Colors.textMuted,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  actionRowText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
});
