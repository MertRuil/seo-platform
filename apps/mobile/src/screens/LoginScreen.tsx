import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView, 
  ActivityIndicator,
  Modal 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useAuth } from "../context/AuthContext";
import { OnboardingModal } from "./OnboardingModal";

export const LoginScreen: React.FC = () => {
  const { login, register, continueAsGuest } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Extended Auth & Modals State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalType, setLegalType] = useState<"KVKK" | "TERMS" | "PRIVACY">("KVKK");

  const [showOnboarding, setShowOnboarding] = useState(false);

  const handleBiometricLogin = async () => {
    // Simulated Face ID / Touch ID success
    setLoading(true);
    setTimeout(async () => {
      await continueAsGuest();
      setLoading(false);
    }, 600);
  };

  const handleSocialLogin = async (provider: "Apple" | "Google") => {
    setLoading(true);
    setTimeout(async () => {
      await continueAsGuest();
      setLoading(false);
    }, 600);
  };

  const openLegal = (type: "KVKK" | "TERMS" | "PRIVACY") => {
    setLegalType(type);
    setShowLegalModal(true);
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Lütfen e-posta ve şifrenizi girin.");
      return;
    }
    if (isRegister && !name.trim()) {
      setErrorMessage("Lütfen adınızı ve soyadınızı girin.");
      return;
    }

    setLoading(true);
    try {
      const res = isRegister 
        ? await register(email, password, name)
        : await login(email, password);

      if (!res.success) {
        setErrorMessage(res.error || "İşlem tamamlanamadı.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setIsRegister(false);
    setEmail("admin@seoplatform.io");
    setPassword("admin123");
    setErrorMessage(null);
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Brand Logo & Title */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Ionicons name="sparkles" size={28} color={Colors.primary} />
          </View>
          <Text style={styles.brandTitle}>SEO Platform</Text>
          <Text style={styles.brandTagline}>Otonom AI & Teknik SEO Mobil Yönetim</Text>

          {/* Value Proposition Pills */}
          <View style={styles.featuresRow}>
            <View style={styles.featurePill}>
              <Ionicons name="flash" size={10} color={Colors.primary} />
              <Text style={styles.featurePillText}>Canlı Googlebot</Text>
            </View>
            <View style={styles.featurePill}>
              <Ionicons name="sparkles" size={10} color={Colors.primary} />
              <Text style={styles.featurePillText}>Otonom AI</Text>
            </View>
            <View style={styles.featurePill}>
              <Ionicons name="shield-checkmark" size={10} color={Colors.primary} />
              <Text style={styles.featurePillText}>Sıfır Mit</Text>
            </View>
          </View>
        </View>

        {/* Auth Glass Card */}
        <GlassCard variant="elevated" style={styles.authCard}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {isRegister ? "Hesap Oluşturun" : "Giriş Yapın"}
            </Text>
            <Text style={styles.cardSub}>
              {isRegister
                ? "Sitenizi ekleyin ve otonom SEO analizini başlatın."
                : "Güvenli oturum açarak analitik verilerinizi yönetin."}
            </Text>
          </View>

          {/* Error Message */}
          {errorMessage && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.danger} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Form Fields */}
          {isRegister && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ad Soyad</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color={Colors.textMuted} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Örn: Ayberk Çalışkan"
                  placeholderTextColor={Colors.textMuted}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>E-Posta Adresi</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="ornek@alanadiniz.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Şifre</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="En az 6 karakter"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={18} 
                  color={Colors.textMuted} 
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot Password Link */}
          {!isRegister && (
            <TouchableOpacity 
              style={styles.forgotBtn} 
              onPress={() => setShowForgotModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotBtnText}>Şifremi Unuttum</Text>
            </TouchableOpacity>
          )}

          {/* Submit Button */}
          <TouchableOpacity 
            style={styles.submitBtn} 
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isRegister ? "Hesap Oluştur ve Başla" : "Güvenli Giriş Yap"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Biometric Login (Face ID / Touch ID) */}
          {!isRegister && (
            <TouchableOpacity 
              style={styles.biometricBtn}
              onPress={handleBiometricLogin}
              activeOpacity={0.7}
            >
              <Ionicons name="scan-outline" size={18} color={Colors.primary} />
              <Text style={styles.biometricBtnText}>Face ID / Biyometrik Giriş</Text>
            </TouchableOpacity>
          )}

          {/* Social Logins */}
          <View style={styles.socialDividerRow}>
            <View style={styles.socialDividerLine} />
            <Text style={styles.socialDividerText}>veya</Text>
            <View style={styles.socialDividerLine} />
          </View>

          <View style={styles.socialRow}>
            <TouchableOpacity 
              style={styles.socialBtn}
              onPress={() => handleSocialLogin("Apple")}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-apple" size={18} color={Colors.textPrimary} />
              <Text style={styles.socialBtnText}>Apple</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.socialBtn}
              onPress={() => handleSocialLogin("Google")}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-google" size={18} color={Colors.textPrimary} />
              <Text style={styles.socialBtnText}>Google</Text>
            </TouchableOpacity>
          </View>

          {/* Switch Mode Link */}
          <TouchableOpacity 
            style={styles.switchModeBtn}
            onPress={() => {
              setIsRegister(!isRegister);
              setErrorMessage(null);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.switchModeText}>
              {isRegister ? "Zaten bir hesabınız var mı? " : "Henüz bir hesabınız yok mu? "}
              <Text style={styles.switchModeHighlight}>
                {isRegister ? "Giriş Yapın" : "Kayıt Olun"}
              </Text>
            </Text>
          </TouchableOpacity>

          {/* Quick Demo Fill or Guest Login */}
          {!isRegister && (
            <View style={styles.demoActionsContainer}>
              <TouchableOpacity 
                style={styles.demoFillBtn}
                onPress={fillDemoCredentials}
                activeOpacity={0.7}
              >
                <Ionicons name="flash-outline" size={13} color={Colors.primary} />
                <Text style={styles.demoFillText}>Örnek Bilgileri Doldur (admin123)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.guestBtn}
                onPress={continueAsGuest}
                activeOpacity={0.7}
              >
                <Ionicons name="person-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.guestBtnText}>Misafir / Demo Olarak Devam Et</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Onboarding Wizard Trigger */}
          <TouchableOpacity 
            style={styles.onboardingTriggerBtn}
            onPress={() => setShowOnboarding(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="compass-outline" size={15} color={Colors.accent} />
            <Text style={styles.onboardingTriggerText}>Yeni Başlayanlar İçin Kurulum Sihirbazı</Text>
          </TouchableOpacity>
        </GlassCard>

        {/* Security & Legal Links */}
        <View style={styles.trustFooter}>
          <View style={styles.trustRow}>
            <Ionicons name="shield-checkmark-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.trustText}>256-Bit SSL Uçtan Uca Şifreli Oturum</Text>
          </View>
          <View style={styles.legalLinksRow}>
            <TouchableOpacity onPress={() => openLegal("KVKK")}>
              <Text style={styles.legalLink}>KVKK Onayı</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>•</Text>
            <TouchableOpacity onPress={() => openLegal("TERMS")}>
              <Text style={styles.legalLink}>Kullanım Koşulları</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>•</Text>
            <TouchableOpacity onPress={() => openLegal("PRIVACY")}>
              <Text style={styles.legalLink}>Gizlilik Politikası</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Forgot Password Modal */}
      <Modal visible={showForgotModal} transparent animationType="slide" onRequestClose={() => setShowForgotModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Ionicons name="key-outline" size={36} color={Colors.primary} style={{ alignSelf: "center" }} />
            <Text style={styles.modalTitle}>Şifrenizi mi Unuttunuz?</Text>
            <Text style={styles.modalSub}>Kayıtlı e-posta adresinize tek tıkla şifre sıfırlama bağlantısı gönderilecektir.</Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="ornek@alanadiniz.com"
              placeholderTextColor={Colors.textMuted}
              value={forgotEmail}
              onChangeText={setForgotEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {forgotSent ? (
              <View style={styles.forgotSuccess}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.forgotSuccessText}>Sıfırlama bağlantısı gönderildi!</Text>
              </View>
            ) : null}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowForgotModal(false)}>
                <Text style={styles.modalCancelText}>Kapat</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.modalSubmitBtn}
                onPress={() => {
                  setForgotSent(true);
                  setTimeout(() => {
                    setShowForgotModal(false);
                    setForgotSent(false);
                  }, 1500);
                }}
              >
                <Text style={styles.modalSubmitText}>Bağlantı Gönder</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Legal / KVKK Modal */}
      <Modal visible={showLegalModal} transparent animationType="slide" onRequestClose={() => setShowLegalModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {legalType === "KVKK" && "KVKK & GDPR Aydınlatma Metni"}
              {legalType === "TERMS" && "Kullanım Koşulları"}
              {legalType === "PRIVACY" && "Gizlilik Politikası"}
            </Text>
            <ScrollView style={{ maxHeight: 280, marginVertical: 12 }}>
              <Text style={styles.legalBody}>
                {legalType === "KVKK" && "6698 sayılı Kişisel Verilerin Korunması Kanunu ve GDPR uyarınca; kullanıcı bilgileri, domain analitik verileri ve SEO performans metrikleri en üst düzey şifreleme ve izole veritabanı altyapısıyla saklanmakta, üçüncü şahıslarla asla paylaşılmamaktadır."}
                {legalType === "TERMS" && "SEO Platform hizmetlerini kullanarak, web siteniz üzerinde otonom taranan sayfalar, robots.txt yönergeleri ve arama motoru kurallarına uygun işlem yapıldığını kabul etmektesiniz. Sistemimiz yalnızca yetkilendirilmiş alan adlarında analiz yürütür."}
                {legalType === "PRIVACY" && "Gizliliğiniz bizim için esastır. E-posta, şifre ve site verileriniz Keychain / Keystore standartlarında saklanmaktadır. İstediğiniz an tüm verilerinizi dışa aktarabilir veya hesabınızı kalıcı olarak silebilirsiniz."}
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalSubmitBtn} onPress={() => setShowLegalModal(false)}>
              <Text style={styles.modalSubmitText}>Anladım ve Kabul Ediyorum</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Onboarding Wizard Modal */}
      <OnboardingModal 
        visible={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 24,
    justifyContent: "center",
    minHeight: "100%",
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  authCard: {
    padding: 22,
    marginBottom: 20,
  },
  cardHeader: {
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  cardSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dangerSurface,
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
  },
  errorText: {
    fontSize: 12,
    color: Colors.danger,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    paddingVertical: 12,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  switchModeBtn: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 4,
  },
  switchModeText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  switchModeHighlight: {
    color: Colors.primary,
    fontWeight: "700",
  },
  featuresRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
  },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
    gap: 4,
  },
  featurePillText: {
    fontSize: 10,
    fontWeight: "600",
    color: Colors.primary,
  },
  trustFooter: {
    alignItems: "center",
    marginTop: 14,
    paddingHorizontal: 16,
    gap: 6,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trustText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  termsText: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 14,
    opacity: 0.8,
  },
  demoActionsContainer: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    gap: 8,
    alignItems: "center",
  },
  demoFillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  demoFillText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.primary,
  },
  guestBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  guestBtnText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginBottom: 12,
    marginTop: -6,
  },
  forgotBtnText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: "500",
  },
  biometricBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    marginTop: 10,
  },
  biometricBtnText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  socialDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 14,
  },
  socialDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderSubtle,
  },
  socialDividerText: {
    color: Colors.textMuted,
    fontSize: 11,
    textTransform: "uppercase",
  },
  socialRow: {
    flexDirection: "row",
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.surface,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  socialBtnText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: "600",
  },
  onboardingTriggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    marginTop: 10,
    backgroundColor: "rgba(139, 92, 246, 0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.2)",
  },
  onboardingTriggerText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  legalLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  legalLink: {
    color: Colors.textMuted,
    fontSize: 11,
    textDecorationLine: "underline",
  },
  legalDot: {
    color: Colors.textMuted,
    fontSize: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    width: "100%",
    maxWidth: 380,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginTop: 8,
    textAlign: "center",
  },
  modalSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    marginVertical: 10,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginVertical: 10,
  },
  forgotSuccess: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.successSurface,
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  forgotSuccessText: {
    color: Colors.success,
    fontSize: 13,
    fontWeight: "600",
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  modalSubmitBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
  },
  modalSubmitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  legalBody: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
});
