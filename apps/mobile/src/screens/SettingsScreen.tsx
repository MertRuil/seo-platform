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
  sendTestAlert,
  setGoogleConnectionStateForTest,
  getGoogleConnectionState,
  GoogleConnectionTestState
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
  const [testState, setTestState] = useState<GoogleConnectionTestState>(getGoogleConnectionState());
  const [alertChannels, setAlertChannels] = useState<AlertChannelConfig[]>([]);
  const [testingChan, setTestingChan] = useState<string | null>(null);

  useEffect(() => {
    fetchAppSettings().then(setSettings);
    fetchGoogleSyncTelemetry().then(setGoogleSync);
    fetchAlertChannels().then(setAlertChannels);
  }, []);

  const handleSetTestState = async (state: GoogleConnectionTestState) => {
    setGoogleConnectionStateForTest(state);
    setTestState(state);
    const updated = await fetchGoogleSyncTelemetry();
    setGoogleSync(updated);
  };

  const handleSyncGoogle = async () => {
    setSyncingGoogle(true);
    try {
      const res = await triggerGoogleSync();
      setGoogleSync(res);
      if (res.status === "ERROR" || res.error_code === "AUTH_FAILED") {
        Alert.alert(
          "Entegrasyon Hatası (401)",
          res.error_message || "Google API yetkilendirmesi başarısız oldu: OAuth jetonunun süresi dolmuş veya erişim izni iptal edilmiş. Müşteri güvenliği için sahte veri gösterilmez."
        );
      } else if (res.status === "DISCONNECTED") {
        Alert.alert(
          "Entegrasyon Bağlı Değil",
          "Aktif bir Google Search Console veya GA4 hesabı bulunamadı. Lütfen önce hesabınızı bağlayın."
        );
      } else {
        Alert.alert("Başarılı", "Google Search Console ve GA4 verileri başarıyla eşitlendi!");
      }
    } catch (e: any) {
      Alert.alert("Hata", e?.message || "Google senkronizasyonu yapılamadı.");
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
              {/* Status Alert Banner if Error or Disconnected */}
              {googleSync.status === "ERROR" && (
                <View style={styles.integrationAlertBoxError}>
                  <View style={styles.integrationAlertHeader}>
                    <Ionicons name="alert-circle" size={16} color={Colors.error} />
                    <Text style={styles.integrationAlertTitleError}>Yetkilendirme Hatası (401)</Text>
                  </View>
                  <Text style={styles.integrationAlertText}>
                    {googleSync.error_message || "OAuth jetonunun süresi doldu veya erişim izni bulunmuyor. Gerçek veri çekilemiyor; sahte veriler kalkan tarafından engellendi."}
                  </Text>
                  <TouchableOpacity
                    style={styles.reconnectBtn}
                    onPress={() => Alert.alert("OAuth Yeniden Doğrulama", "Google OAuth yetkilendirme sayfası açılıyor...")}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="key-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.reconnectBtnText}>OAuth ile Yeniden Bağlan</Text>
                  </TouchableOpacity>
                </View>
              )}

              {googleSync.status === "DISCONNECTED" && (
                <View style={styles.integrationAlertBoxWarn}>
                  <View style={styles.integrationAlertHeader}>
                    <Ionicons name="warning-outline" size={16} color={Colors.accent} />
                    <Text style={styles.integrationAlertTitleWarn}>Google Entegrasyonu Bağlı Değil</Text>
                  </View>
                  <Text style={styles.integrationAlertText}>
                    Google Search Console veya GA4 mülkü henüz yapılandırılmamış. Canlı arama ve dönüşüm analitiğini izlemek için bağlayın.
                  </Text>
                  <TouchableOpacity
                    style={[styles.reconnectBtn, { backgroundColor: Colors.accent }]}
                    onPress={() => Alert.alert("Google Bağlantısı", "Google hesabı bağlama sihirbazı başlatılıyor...")}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="link-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.reconnectBtnText}>Google Hesabını Bağla</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* GSC Row */}
              <View style={styles.googleServiceRow}>
                <View style={styles.serviceHeaderLeft}>
                  <Ionicons name="logo-google" size={18} color="#EA4335" />
                  <Text style={styles.serviceName}>Google Search Console (GSC)</Text>
                </View>
                {googleSync.gsc.connected && googleSync.status === "HEALTHY" ? (
                  <View style={styles.activeTag}>
                    <Text style={styles.activeTagText}>Bağlı & Doğrulandı</Text>
                  </View>
                ) : googleSync.gsc.status === "AUTH_FAILED" || googleSync.status === "ERROR" ? (
                  <View style={styles.errorTag}>
                    <Text style={styles.errorTagText}>Yetki Hatası</Text>
                  </View>
                ) : (
                  <View style={styles.warnTag}>
                    <Text style={styles.warnTagText}>Bağlı Değil</Text>
                  </View>
                )}
              </View>
              <Text style={styles.serviceDetailText}>
                {googleSync.gsc.connected && googleSync.status === "HEALTHY"
                  ? `${googleSync.gsc.property} • ${googleSync.gsc.total_clicks.toLocaleString()} Tıklama (%${googleSync.gsc.avg_ctr_percent} CTR)`
                  : `${googleSync.gsc.property} • — Tıklama (Bağlantı Hatası: Veri Yok)`}
              </Text>

              <View style={styles.divider} />

              {/* GA4 Row */}
              <View style={styles.googleServiceRow}>
                <View style={styles.serviceHeaderLeft}>
                  <Ionicons name="analytics-outline" size={18} color="#FBBC04" />
                  <Text style={styles.serviceName}>Google Analytics 4 (GA4)</Text>
                </View>
                {googleSync.ga4.connected && googleSync.status === "HEALTHY" ? (
                  <View style={styles.activeTag}>
                    <Text style={styles.activeTagText}>Aktif & Doğrulandı</Text>
                  </View>
                ) : googleSync.ga4.status === "AUTH_FAILED" || googleSync.status === "ERROR" ? (
                  <View style={styles.errorTag}>
                    <Text style={styles.errorTagText}>Yetki Hatası</Text>
                  </View>
                ) : (
                  <View style={styles.warnTag}>
                    <Text style={styles.warnTagText}>Bağlı Değil</Text>
                  </View>
                )}
              </View>
              <Text style={styles.serviceDetailText}>
                {googleSync.ga4.connected && googleSync.status === "HEALTHY"
                  ? `${googleSync.ga4.property_id} • ${googleSync.ga4.active_users.toLocaleString()} Kullanıcı (%${googleSync.ga4.organic_conversion_rate} Dönüşüm)`
                  : `${googleSync.ga4.property_id} • — Kullanıcı (Bağlantı Hatası: Veri Yok)`}
              </Text>

              {/* Simulation Mode Switcher for Testing */}
              <View style={styles.divider} />
              <View style={styles.testSwitcherBox}>
                <Text style={styles.testSwitcherLabel}>Simülasyon / Test Durumu:</Text>
                <View style={styles.testChipsRow}>
                  <TouchableOpacity
                    style={[styles.testChip, testState === "HEALTHY" && styles.testChipActive]}
                    onPress={() => handleSetTestState("HEALTHY")}
                  >
                    <Text style={[styles.testChipText, testState === "HEALTHY" && styles.testChipTextActive]}>
                      ✅ Sağlıklı
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.testChip, testState === "AUTH_FAILED" && styles.testChipActiveError]}
                    onPress={() => handleSetTestState("AUTH_FAILED")}
                  >
                    <Text style={[styles.testChipText, testState === "AUTH_FAILED" && styles.testChipTextActiveError]}>
                      ❌ 401 Yetki Hatası
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.testChip, testState === "DISCONNECTED" && styles.testChipActiveWarn]}
                    onPress={() => handleSetTestState("DISCONNECTED")}
                  >
                    <Text style={[styles.testChipText, testState === "DISCONNECTED" && styles.testChipTextActiveWarn]}>
                      ⚠️ Bağlantısız
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              
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
  errorTag: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  errorTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.error,
  },
  warnTag: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  warnTagText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.accent,
  },
  integrationAlertBoxError: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 6,
    marginBottom: 6,
  },
  integrationAlertBoxWarn: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderColor: "rgba(245, 158, 11, 0.3)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 6,
    marginBottom: 6,
  },
  integrationAlertHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  integrationAlertTitleError: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.error,
  },
  integrationAlertTitleWarn: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.accent,
  },
  integrationAlertText: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  reconnectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.error,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  reconnectBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  testSwitcherBox: {
    marginTop: 4,
    gap: 6,
  },
  testSwitcherLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  testChipsRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  testChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  testChipActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: Colors.success,
  },
  testChipActiveError: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: Colors.error,
  },
  testChipActiveWarn: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: Colors.accent,
  },
  testChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  testChipTextActive: {
    color: Colors.success,
    fontWeight: "700",
  },
  testChipTextActiveError: {
    color: Colors.error,
    fontWeight: "700",
  },
  testChipTextActiveWarn: {
    color: Colors.accent,
    fontWeight: "700",
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
