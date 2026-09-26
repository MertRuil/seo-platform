import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { 
  fetchAppSettings, 
  updateAppSettings, 
  fetchGoogleSyncTelemetry, 
  triggerGoogleSync, 
  fetchAlertChannels, 
  sendTestAlert 
} from "../services/api";
import { AppSettings, GoogleSyncTelemetry, AlertChannelConfig } from "../types";

export const SettingsScreen: React.FC = () => {
  const { setActiveTab } = useApp();
  const { 
    user, 
    logout, 
    isBiometricEnrolled, 
    enrolledBiometricType, 
    enableBiometrics, 
    disableBiometrics,
    resetBiometricPrompt 
  } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [googleSync, setGoogleSync] = useState<GoogleSyncTelemetry | null>(null);
  const [syncingGoogle, setSyncingGoogle] = useState(false);
  const [alertChannels, setAlertChannels] = useState<AlertChannelConfig[]>([]);
  const [testingChan, setTestingChan] = useState<string | null>(null);

  useEffect(() => {
    fetchAppSettings().then(setSettings);
    fetchGoogleSyncTelemetry().then(setGoogleSync);
    fetchAlertChannels().then(setAlertChannels);
  }, []);

  const handleSyncGoogle = async () => {
    setSyncingGoogle(true);
    try {
      const res = await triggerGoogleSync();
      setGoogleSync(res);
      Alert.alert("Başarılı", "Google Search Console ve GA4 verileri başarıyla eşitlendi!");
    } catch {
      Alert.alert("Hata", "Google senkronizasyonu yapılamadı.");
    } finally {
      setSyncingGoogle(false);
    }
  };

  const handleSendTestAlert = async (chan: AlertChannelConfig) => {
    setTestingChan(chan.id);
    try {
      const res = await sendTestAlert(chan.id);
      Alert.alert(chan.name, res.message);
    } catch {
      Alert.alert("Hata", "Test bildirimi gönderilemedi.");
    } finally {
      setTestingChan(null);
    }
  };

  const handleToggleBiometric = async (val: boolean) => {
    if (val) {
      await enableBiometrics("FACE_ID");
    } else {
      await disableBiometrics();
    }
    if (settings) {
      const updated = await updateAppSettings({ biometric_enabled: val });
      setSettings(updated);
    }
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
              <Ionicons 
                name={enrolledBiometricType === "TOUCH_ID" ? "finger-print-outline" : "scan-outline"} 
                size={20} 
                color={Colors.primary} 
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.settingTitle}>
                  {enrolledBiometricType === "TOUCH_ID" ? "Touch ID / Parmak İzi ile Giriş" : "Face ID / Biyometrik Giriş"}
                </Text>
                <Text style={styles.settingSub}>
                  {isBiometricEnrolled 
                    ? "Cihazınızda biyometrik hızlı oturum açma aktif." 
                    : "Şifre girmeden tek dokunuşla güvenli giriş yapın."}
                </Text>
              </View>
            </View>
            <Switch
              value={isBiometricEnrolled}
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

        {/* Google Sync Hub (GSC & GA4) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Google Entegrasyon Hub'ı</Text>
          <TouchableOpacity 
            style={styles.syncNowBtn} 
            onPress={handleSyncGoogle} 
            disabled={syncingGoogle}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh-outline" size={14} color={Colors.primary} />
            <Text style={styles.syncNowText}>{syncingGoogle ? "Eşitleniyor..." : "Şimdi Eşitle"}</Text>
          </TouchableOpacity>
        </View>

        <GlassCard style={styles.groupCard}>
          {googleSync && (
            <View style={styles.googleSyncBox}>
              <View style={styles.googleServiceRow}>
                <View style={styles.serviceHeaderLeft}>
                  <Ionicons name="logo-google" size={18} color="#EA4335" />
                  <Text style={styles.serviceName}>Google Search Console (GSC)</Text>
                </View>
                <View style={styles.activeTag}>
                  <Text style={styles.activeTagText}>Bağlı</Text>
                </View>
              </View>
              <Text style={styles.serviceDetailText}>
                {googleSync.gsc.property} • {googleSync.gsc.total_clicks.toLocaleString()} Tıklama (%{googleSync.gsc.avg_ctr_percent} CTR)
              </Text>

              <View style={styles.divider} />

              <View style={styles.googleServiceRow}>
                <View style={styles.serviceHeaderLeft}>
                  <Ionicons name="analytics-outline" size={18} color="#FBBC04" />
                  <Text style={styles.serviceName}>Google Analytics 4 (GA4)</Text>
                </View>
                <View style={styles.activeTag}>
                  <Text style={styles.activeTagText}>Aktif</Text>
                </View>
              </View>
              <Text style={styles.serviceDetailText}>
                {googleSync.ga4.property_id} • {googleSync.ga4.active_users.toLocaleString()} Kullanıcı (%{googleSync.ga4.organic_conversion_rate} Dönüşüm)
              </Text>
              
              <Text style={styles.lastSyncMuted}>
                Son Eşitleme: {new Date(googleSync.last_synced_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          )}
        </GlassCard>

        {/* Anlık Alarm Kanalları (Slack, Telegram, Discord, Webhook) */}
        <Text style={styles.sectionTitle}>Anlık Alarm Kanalları</Text>
        <GlassCard style={styles.groupCard}>
          {alertChannels.map((chan, i) => (
            <React.Fragment key={chan.id}>
              {i > 0 && <View style={styles.divider} />}
              <View style={styles.alertChanRow}>
                <View style={{ flex: 1 }}>
                  <View style={styles.alertChanHeader}>
                    <Ionicons 
                      name={
                        chan.type === "SLACK" ? "logo-slack" :
                        chan.type === "TELEGRAM" ? "paper-plane-outline" :
                        chan.type === "DISCORD" ? "game-controller-outline" : "globe-outline"
                      } 
                      size={16} 
                      color={chan.enabled ? Colors.primary : Colors.textMuted} 
                    />
                    <Text style={styles.alertChanTitle}>{chan.name}</Text>
                    {chan.enabled && <View style={styles.miniDot} />}
                  </View>
                  <Text style={styles.alertChanSub} numberOfLines={1}>
                    {chan.target_url_or_id}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.testBtn}
                  onPress={() => handleSendTestAlert(chan)}
                  disabled={testingChan === chan.id}
                  activeOpacity={0.7}
                >
                  <Ionicons name="send-outline" size={12} color={Colors.primary} />
                  <Text style={styles.testBtnText}>
                    {testingChan === chan.id ? "..." : "Test"}
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
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  syncNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
  },
  syncNowText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
  googleSyncBox: {
    gap: 8,
  },
  googleServiceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  serviceHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  serviceName: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  activeTag: {
    backgroundColor: Colors.successSurface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.success,
  },
  serviceDetailText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    paddingLeft: 26,
  },
  lastSyncMuted: {
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: "italic",
    marginTop: 4,
    textAlign: "right",
  },
  alertChanRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  alertChanHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  alertChanTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  alertChanSub: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
  },
  testBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
});
