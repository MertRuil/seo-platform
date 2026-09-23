import React, { useState, useEffect } from "react";
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
import * as LocalAuthentication from "expo-local-authentication";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useAuth } from "../context/AuthContext";
import { OnboardingModal } from "./OnboardingModal";

export const LoginScreen: React.FC = () => {
  const { 
    login, 
    register, 
    continueAsGuest, 
    loginAsDemo, 
    loginWithSocial, 
    loginWithBiometrics,
    isBiometricEnrolled,
    enrolledBiometricType 
  } = useAuth();

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

  // Biometric Detection & State
  type BiometricType = "FACIAL_RECOGNITION" | "FINGERPRINT" | "BOTH" | "NONE";
  const [biometricType, setBiometricType] = useState<BiometricType>("FACIAL_RECOGNITION");
  const [selectedBioTab, setSelectedBioTab] = useState<"FACE_ID" | "TOUCH_ID">("FACE_ID");
  const [showBiometricModal, setShowBiometricModal] = useState(false);
  const [bioStatus, setBioStatus] = useState<"IDLE" | "SCANNING" | "SUCCESS" | "FAILED">("IDLE");
  const [bioError, setBioError] = useState<string | null>(null);

  // Detect Hardware Capabilities on Mount
  useEffect(() => {
    let isMounted = true;
    const checkBiometricHardware = async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
        const types: LocalAuthentication.AuthenticationType[] = 
          await LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => [] as LocalAuthentication.AuthenticationType[]);

        const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

        if (!isMounted) return;

        if (hasFace && hasFingerprint) {
          setBiometricType("BOTH");
          setSelectedBioTab("FACE_ID");
        } else if (hasFace) {
          setBiometricType("FACIAL_RECOGNITION");
          setSelectedBioTab("FACE_ID");
        } else if (hasFingerprint) {
          setBiometricType("FINGERPRINT");
          setSelectedBioTab("TOUCH_ID");
        } else {
          // Web / Simulator heuristic: iOS/Mac defaults to Face ID, Android/Windows to Touch ID
          const isApple = Platform.OS === "ios" || (Platform.OS === "web" && typeof navigator !== "undefined" && /iPhone|iPad|Macintosh/i.test(navigator.userAgent));
          if (isApple) {
            setBiometricType("FACIAL_RECOGNITION");
            setSelectedBioTab("FACE_ID");
          } else {
            setBiometricType("FINGERPRINT");
            setSelectedBioTab("TOUCH_ID");
          }
        }
      } catch {
        if (isMounted) {
          setBiometricType("FACIAL_RECOGNITION");
          setSelectedBioTab("FACE_ID");
        }
      }
    };

    checkBiometricHardware();
    return () => {
      isMounted = false;
    };
  }, []);

  // Apple & Google OAuth Sheets
  const [showAppleModal, setShowAppleModal] = useState(false);
  const [appleHideEmail, setAppleHideEmail] = useState(true);
  const [appleLoading, setAppleLoading] = useState(false);

  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Demo & Guest Loaders
  const [demoLoading, setDemoLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const handleInstantDemoLogin = async () => {
    setDemoLoading(true);
    setEmail("admin@seoplatform.io");
    setPassword("admin123");
    try {
      await loginAsDemo();
    } finally {
      setDemoLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    try {
      await continueAsGuest();
    } finally {
      setGuestLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setBioStatus("IDLE");
    setBioError(null);

    // If on native device with enrolled biometrics, attempt native prompt directly
    if (Platform.OS !== "web") {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
        const isEnrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync().catch(() => false) : false;

        if (hasHardware && isEnrolled) {
          const isFace = selectedBioTab === "FACE_ID" || biometricType === "FACIAL_RECOGNITION";
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: isFace ? "Face ID ile Kimliğinizi Doğrulayın" : "Touch ID / Parmak İzinizi Okutun",
            cancelLabel: "Vazgeç",
            fallbackLabel: "Şifre ile Giriş",
            disableDeviceFallback: false,
          });

          if (result.success) {
            await loginWithBiometrics(isFace ? "FACE_ID" : "TOUCH_ID");
            return;
          } else if (result.error === "user_cancel" || result.error === "app_cancel") {
            // User cancelled native prompt
            return;
          }
        }
      } catch (err) {
        console.log("Native biometric error, showing interactive modal:", err);
      }
    }

    // On Web / Simulator or when manual verification is requested:
    // Open interactive prompt modal in IDLE state (NO AUTOMATIC LOGIN!)
    setShowBiometricModal(true);
  };

  const startBiometricScan = (forceFail = false) => {
    setBioStatus("SCANNING");
    setBioError(null);

    setTimeout(async () => {
      if (forceFail) {
        setBioStatus("FAILED");
        setBioError(
          selectedBioTab === "FACE_ID"
            ? "Yüzünüz tanınamadı. Lütfen doğrudan kameraya bakın veya şifrenizle giriş yapın."
            : "Parmak izi eşleşmedi. Lütfen sensörü temizleyip tekrar dokunun."
        );
        return;
      }

      setBioStatus("SUCCESS");
      setTimeout(async () => {
        setShowBiometricModal(false);
        await loginWithBiometrics(selectedBioTab);
      }, 700);
    }, 1100);
  };

  const handleConfirmAppleLogin = async () => {
    setAppleLoading(true);
    setTimeout(async () => {
      setShowAppleModal(false);
      setAppleLoading(false);
      const emailToUse = appleHideEmail ? "ayberk_privaterelay@privaterelay.appleid.com" : "ayberk@icloud.com";
      await loginWithSocial("Apple", emailToUse, "Ayberk Çalışkan (Apple)");
    }, 700);
  };

  const handleConfirmGoogleLogin = async (accEmail: string, accName: string) => {
    setGoogleLoading(true);
    setTimeout(async () => {
      setShowGoogleModal(false);
      setGoogleLoading(false);
      await loginWithSocial("Google", accEmail, accName);
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

          {/* Biometric Login (Face ID / Touch ID) - ONLY shown if already activated by user on this device */}
          {!isRegister && isBiometricEnrolled && (
            <TouchableOpacity 
              style={styles.biometricBtn}
              onPress={handleBiometricLogin}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={(enrolledBiometricType || biometricType) === "TOUCH_ID" || (enrolledBiometricType || biometricType) === "FINGERPRINT" ? "finger-print-outline" : "scan-outline"} 
                size={18} 
                color={Colors.primary} 
              />
              <Text style={styles.biometricBtnText}>
                {(enrolledBiometricType || biometricType) === "TOUCH_ID" || (enrolledBiometricType || biometricType) === "FINGERPRINT"
                  ? "Touch ID ile Hızlı Giriş"
                  : "Face ID ile Hızlı Giriş"}
              </Text>
              <View style={styles.bioHardwareBadge}>
                <View style={styles.bioHardwareDot} />
                <Text style={styles.bioHardwareBadgeText}>
                  {(enrolledBiometricType || biometricType) === "TOUCH_ID" || (enrolledBiometricType || biometricType) === "FINGERPRINT"
                    ? "Kayıtlı Touch ID"
                    : "Kayıtlı Face ID"}
                </Text>
              </View>
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
              onPress={() => setShowAppleModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="logo-apple" size={18} color={Colors.textPrimary} />
              <Text style={styles.socialBtnText}>Apple</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.socialBtn}
              onPress={() => setShowGoogleModal(true)}
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

          {/* Quick Demo & Guest Actions */}
          {!isRegister && (
            <View style={styles.demoActionsContainer}>
              <TouchableOpacity 
                style={styles.demoFillBtn}
                onPress={handleInstantDemoLogin}
                activeOpacity={0.8}
                disabled={demoLoading}
              >
                {demoLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <>
                    <Ionicons name="flash" size={14} color={Colors.primary} />
                    <Text style={styles.demoFillText}>Tek Tıkla Demo Girişi (admin123)</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <TouchableOpacity 
                  onPress={fillDemoCredentials}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.subtleLinkText}>Sadece Forma Yaz</Text>
                </TouchableOpacity>

                <Text style={{ color: Colors.border, fontSize: 11 }}>•</Text>

                <TouchableOpacity 
                  style={styles.guestBtn}
                  onPress={handleGuestLogin}
                  activeOpacity={0.7}
                  disabled={guestLoading}
                >
                  {guestLoading ? (
                    <ActivityIndicator size="small" color={Colors.textMuted} />
                  ) : (
                    <>
                      <Ionicons name="person-outline" size={12} color={Colors.textMuted} />
                      <Text style={styles.guestBtnText}>Misafir Olarak Giriş</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
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

      {/* Biometric Verification Modal (Adaptive Face ID / Touch ID) */}
      <Modal 
        visible={showBiometricModal} 
        transparent 
        animationType="fade" 
        onRequestClose={() => {
          if (bioStatus !== "SCANNING") setShowBiometricModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.bioModalCard}>
            {/* Device Hardware Detection Tag */}
            <View style={styles.bioDeviceHardwareTag}>
              <View style={styles.bioDeviceHardwareDot} />
              <Text style={styles.bioDeviceHardwareText}>
                {biometricType === "FACIAL_RECOGNITION" && "Cihaz Donanımı: TrueDepth Face ID"}
                {biometricType === "FINGERPRINT" && "Cihaz Donanımı: Touch ID Sensörü"}
                {biometricType === "BOTH" && "Cihaz Donanımı: Çoklu Biyometrik (Face + Touch)"}
                {biometricType === "NONE" && "Biyometrik Kimlik Doğrulama"}
              </Text>
            </View>

            {/* Segmented Mode Switcher (Face ID vs Touch ID) */}
            <View style={styles.bioTabContainer}>
              <TouchableOpacity 
                style={[styles.bioTabBtn, selectedBioTab === "FACE_ID" && styles.bioTabBtnActive]} 
                onPress={() => {
                  setSelectedBioTab("FACE_ID");
                  setBioStatus("IDLE");
                  setBioError(null);
                }}
                disabled={bioStatus === "SCANNING"}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="scan-outline" 
                  size={14} 
                  color={selectedBioTab === "FACE_ID" ? "#FFFFFF" : Colors.textMuted} 
                />
                <Text style={[styles.bioTabText, selectedBioTab === "FACE_ID" && styles.bioTabTextActive]}>
                  Face ID (Yüz)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.bioTabBtn, selectedBioTab === "TOUCH_ID" && styles.bioTabBtnActive]} 
                onPress={() => {
                  setSelectedBioTab("TOUCH_ID");
                  setBioStatus("IDLE");
                  setBioError(null);
                }}
                disabled={bioStatus === "SCANNING"}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name="finger-print-outline" 
                  size={14} 
                  color={selectedBioTab === "TOUCH_ID" ? "#FFFFFF" : Colors.textMuted} 
                />
                <Text style={[styles.bioTabText, selectedBioTab === "TOUCH_ID" && styles.bioTabTextActive]}>
                  Touch ID (Parmak İzi)
                </Text>
              </TouchableOpacity>
            </View>

            {/* Mode-Specific Graphic */}
            {selectedBioTab === "FACE_ID" ? (
              <View style={styles.bioReticleContainer}>
                <View 
                  style={[
                    styles.bioReticleBox, 
                    bioStatus === "SUCCESS" && styles.bioReticleBoxSuccess,
                    bioStatus === "FAILED" && styles.bioReticleBoxFailed,
                  ]}
                >
                  {/* Viewfinder Corner Markers */}
                  <View style={[styles.bioCornerMarker, styles.bioCornerTL, bioStatus === "SUCCESS" && { borderColor: Colors.success }, bioStatus === "FAILED" && { borderColor: Colors.danger }]} />
                  <View style={[styles.bioCornerMarker, styles.bioCornerTR, bioStatus === "SUCCESS" && { borderColor: Colors.success }, bioStatus === "FAILED" && { borderColor: Colors.danger }]} />
                  <View style={[styles.bioCornerMarker, styles.bioCornerBL, bioStatus === "SUCCESS" && { borderColor: Colors.success }, bioStatus === "FAILED" && { borderColor: Colors.danger }]} />
                  <View style={[styles.bioCornerMarker, styles.bioCornerBR, bioStatus === "SUCCESS" && { borderColor: Colors.success }, bioStatus === "FAILED" && { borderColor: Colors.danger }]} />

                  {bioStatus === "SUCCESS" ? (
                    <Ionicons name="checkmark-circle" size={54} color={Colors.success} />
                  ) : bioStatus === "FAILED" ? (
                    <Ionicons name="alert-circle" size={54} color={Colors.danger} />
                  ) : (
                    <Ionicons 
                      name={bioStatus === "SCANNING" ? "happy-outline" : "person-outline"} 
                      size={52} 
                      color={Colors.primary} 
                    />
                  )}

                  {/* Scanning beam line */}
                  {bioStatus === "SCANNING" && (
                    <View style={styles.bioScanningBeam} />
                  )}
                </View>
              </View>
            ) : (
              <View 
                style={[
                  styles.bioTouchRing, 
                  bioStatus === "SUCCESS" && styles.bioTouchRingSuccess,
                  bioStatus === "FAILED" && styles.bioTouchRingFailed,
                ]}
              >
                {bioStatus === "SUCCESS" ? (
                  <Ionicons name="checkmark-circle" size={54} color={Colors.success} />
                ) : bioStatus === "FAILED" ? (
                  <Ionicons name="close-circle" size={54} color={Colors.danger} />
                ) : (
                  <Ionicons 
                    name="finger-print" 
                    size={52} 
                    color={bioStatus === "SCANNING" ? Colors.accent : Colors.primary} 
                  />
                )}
              </View>
            )}

            {/* Dynamic Title */}
            <Text style={styles.bioModalTitle}>
              {bioStatus === "SUCCESS" 
                ? "Kimlik Doğrulandı!" 
                : bioStatus === "FAILED" 
                ? "Doğrulama Başarısız" 
                : bioStatus === "SCANNING"
                ? (selectedBioTab === "FACE_ID" ? "Yüz Taranıyor..." : "Parmak İzi Okunuyor...")
                : (selectedBioTab === "FACE_ID" ? "Face ID İsteniyor" : "Parmak İzi İsteniyor")}
            </Text>

            {/* Dynamic Subtitle */}
            <Text style={styles.bioModalSub}>
              {bioStatus === "SUCCESS"
                ? "Biyometrik doğrulama onaylandı. Yönetici oturumu başlatılıyor..."
                : bioStatus === "FAILED"
                ? (bioError || "Sensör eşleşmeyi doğrulayamadı. Lütfen tekrar deneyin.")
                : bioStatus === "SCANNING"
                ? (selectedBioTab === "FACE_ID" 
                    ? "TrueDepth 3D yüz haritası analiz ediliyor, lütfen kameraya bakın..." 
                    : "Parmak izi hatları taranıyor, parmağınızı kaldırmayın...")
                : (selectedBioTab === "FACE_ID"
                    ? "Kameraya doğrudan bakın ve yüz doğrulaması için aşağıdaki butona dokunun."
                    : "Parmağınızı sensöre yerleştirin ve doğrulamak için aşağıdaki butona basın.")}
            </Text>

            {/* Explicit Prompt Actions - Requiring User Action */}
            {bioStatus === "IDLE" && (
              selectedBioTab === "FACE_ID" ? (
                <TouchableOpacity 
                  style={styles.bioActionPrimaryBtn} 
                  onPress={() => startBiometricScan(false)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="scan" size={18} color="#FFFFFF" />
                  <Text style={styles.bioActionPrimaryText}>Yüzümü Tara ve Doğrula</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.bioTouchSensorPad} 
                  onPress={() => startBiometricScan(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="finger-print" size={20} color={Colors.primary} />
                  <Text style={styles.bioTouchSensorPadText}>Sensöre Dokunun (Doğrula)</Text>
                </TouchableOpacity>
              )
            )}

            {/* Scanning Indicator */}
            {bioStatus === "SCANNING" && (
              <View style={styles.bioScanningBox}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.bioScanningText}>
                  {selectedBioTab === "FACE_ID" ? "Yüz profili taranıyor..." : "Parmak izi sensörü okunuyor..."}
                </Text>
              </View>
            )}

            {/* Verified Badge */}
            {bioStatus === "SUCCESS" && (
              <View style={styles.bioVerifiedBox}>
                <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
                <Text style={styles.bioVerifiedText}>
                  {selectedBioTab === "FACE_ID" ? "Ayberk Çalışkan (Face ID)" : "Ayberk Çalışkan (Touch ID)"}
                </Text>
              </View>
            )}

            {/* Failed Error Message & Retry */}
            {bioStatus === "FAILED" && (
              <>
                <View style={styles.bioErrorBox}>
                  <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                  <Text style={styles.bioErrorText}>
                    {bioError || "Doğrulama gerçekleştirilemedi."}
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.bioRetryBtn} 
                  onPress={() => startBiometricScan(false)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="refresh" size={16} color="#FFFFFF" />
                  <Text style={styles.bioRetryText}>
                    {selectedBioTab === "FACE_ID" ? "Tekrar Yüz Tara" : "Tekrar Sensöre Dokun"}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Subtle Simulation & Cancel Actions */}
            {bioStatus !== "SCANNING" && bioStatus !== "SUCCESS" && (
              <>
                <TouchableOpacity 
                  style={styles.bioSimFailBtn}
                  onPress={() => startBiometricScan(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.bioSimFailText}>Başarısız Eşleşme Simülasyonu Test Et</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.bioCancelBtn} 
                  onPress={() => setShowBiometricModal(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.bioCancelText}>Vazgeç / Şifreyle Giriş</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Apple Sign-In Modal Sheet */}
      <Modal visible={showAppleModal} transparent animationType="slide" onRequestClose={() => setShowAppleModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.appleModalCard}>
            <View style={styles.appleHeader}>
              <View style={styles.appleIconBox}>
                <Ionicons name="logo-apple" size={26} color="#FFFFFF" />
              </View>
              <Text style={styles.appleModalTitle}>Apple ile Giriş Yap</Text>
              <Text style={styles.appleModalSub}>SEO Platform için Apple Kimliğiniz doğrulanacak</Text>
            </View>

            <View style={styles.appleAccountBox}>
              <View style={styles.appleAvatar}>
                <Text style={styles.appleAvatarText}>AÇ</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.appleAccountName}>Ayberk Çalışkan</Text>
                <Text style={styles.appleAccountEmail}>
                  {appleHideEmail ? "ayberk_relay@appleid.com (Gizli)" : "ayberk@icloud.com"}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
            </View>

            <TouchableOpacity 
              style={styles.appleOptionRow} 
              onPress={() => setAppleHideEmail(!appleHideEmail)}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={appleHideEmail ? "checkbox" : "square-outline"} 
                size={18} 
                color={Colors.primary} 
              />
              <Text style={styles.appleOptionText}>E-postamı Gizle (Özel Yönlendirme)</Text>
            </TouchableOpacity>

            <View style={styles.appleActionRow}>
              <TouchableOpacity 
                style={styles.appleCancelBtn}
                onPress={() => setShowAppleModal(false)}
                disabled={appleLoading}
              >
                <Text style={styles.appleCancelText}>Vazgeç</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.appleSubmitBtn}
                onPress={handleConfirmAppleLogin}
                disabled={appleLoading}
                activeOpacity={0.8}
              >
                {appleLoading ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="logo-apple" size={16} color="#000000" />
                    <Text style={styles.appleSubmitText}>Apple ID ile Onayla</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Google OAuth Modal Sheet */}
      <Modal visible={showGoogleModal} transparent animationType="slide" onRequestClose={() => setShowGoogleModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.googleModalCard}>
            <View style={styles.googleHeader}>
              <Ionicons name="logo-google" size={28} color="#EA4335" />
              <Text style={styles.googleModalTitle}>Google ile Oturum Açın</Text>
              <Text style={styles.googleModalSub}>seoplatform.io uygulamasına devam etmek için hesap seçin</Text>
            </View>

            {googleLoading ? (
              <View style={{ paddingVertical: 30, alignItems: "center", gap: 12 }}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={{ color: Colors.textSecondary, fontSize: 13 }}>Google yetkilendirmesi yapılıyor...</Text>
              </View>
            ) : (
              <View style={styles.googleAccountsList}>
                <TouchableOpacity 
                  style={styles.googleAccountItem}
                  onPress={() => handleConfirmGoogleLogin("ayberkcaliskan@gmail.com", "Ayberk Çalışkan (Google)")}
                  activeOpacity={0.7}
                >
                  <View style={[styles.googleAvatar, { backgroundColor: "#4285F4" }]}>
                    <Text style={styles.googleAvatarText}>A</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.googleAccountName}>Ayberk Çalışkan</Text>
                    <Text style={styles.googleAccountEmail}>ayberkcaliskan@gmail.com (Yönetici)</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.googleAccountItem}
                  onPress={() => handleConfirmGoogleLogin("seo.agency@gmail.com", "SEO Ajansı (Google)")}
                  activeOpacity={0.7}
                >
                  <View style={[styles.googleAvatar, { backgroundColor: "#34A853" }]}>
                    <Text style={styles.googleAvatarText}>S</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.googleAccountName}>SEO Ajansı Hesabı</Text>
                    <Text style={styles.googleAccountEmail}>seo.agency@gmail.com</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}

            {!googleLoading && (
              <TouchableOpacity 
                style={styles.googleCancelBtn} 
                onPress={() => setShowGoogleModal(false)}
              >
                <Text style={styles.googleCancelText}>Kapat</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
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
  subtleLinkText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  bioHardwareBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginLeft: 4,
  },
  bioHardwareDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  bioHardwareBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  // Biometric Modal Styles
  bioModalCard: {
    backgroundColor: Colors.surface,
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 20,
  },
  bioDeviceHardwareTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    marginBottom: 16,
  },
  bioDeviceHardwareDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  bioDeviceHardwareText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  bioTabContainer: {
    flexDirection: "row",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    padding: 4,
    gap: 4,
    width: "100%",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  bioTabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bioTabBtnActive: {
    backgroundColor: Colors.primary,
  },
  bioTabText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  bioTabTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  // Face ID Reticle Viewfinder
  bioReticleContainer: {
    width: 130,
    height: 130,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    position: "relative",
  },
  bioReticleBox: {
    width: 120,
    height: 120,
    borderRadius: 24,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.2)",
    position: "relative",
  },
  bioReticleBoxSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: Colors.success,
  },
  bioReticleBoxFailed: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: Colors.danger,
  },
  bioCornerMarker: {
    position: "absolute",
    width: 16,
    height: 16,
    borderColor: Colors.primary,
  },
  bioCornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  bioCornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bioCornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bioCornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  bioScanningBeam: {
    position: "absolute",
    top: "45%",
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  // Touch ID Sensor Ring
  bioTouchRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  bioTouchRingSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: Colors.success,
    shadowColor: Colors.success,
  },
  bioTouchRingFailed: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: Colors.danger,
    shadowColor: Colors.danger,
  },
  bioModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 6,
    textAlign: "center",
  },
  bioModalSub: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  // Explicit Action Buttons
  bioActionPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: 14,
    marginBottom: 12,
  },
  bioActionPrimaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  bioTouchSensorPad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: 14,
    marginBottom: 12,
  },
  bioTouchSensorPadText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  bioScanningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    width: "100%",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  bioScanningText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: "600",
  },
  bioVerifiedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.successSurface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    marginBottom: 12,
    width: "100%",
    justifyContent: "center",
  },
  bioVerifiedText: {
    fontSize: 13,
    color: Colors.success,
    fontWeight: "700",
  },
  bioErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.dangerSurface,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    marginBottom: 12,
    width: "100%",
  },
  bioErrorText: {
    flex: 1,
    fontSize: 12,
    color: Colors.danger,
    lineHeight: 16,
  },
  bioRetryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 10,
  },
  bioRetryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  bioSimFailBtn: {
    paddingVertical: 6,
    marginBottom: 4,
  },
  bioSimFailText: {
    fontSize: 11,
    color: Colors.textMuted,
    textDecorationLine: "underline",
  },
  bioCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginTop: 2,
  },
  bioCancelText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  // Apple Modal Styles
  appleModalCard: {
    backgroundColor: "#161618",
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  appleHeader: {
    alignItems: "center",
    marginBottom: 18,
  },
  appleIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  appleModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  appleModalSub: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 4,
    textAlign: "center",
  },
  appleAccountBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 12,
  },
  appleAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#404040",
    alignItems: "center",
    justifyContent: "center",
  },
  appleAvatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  appleAccountName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  appleAccountEmail: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 2,
  },
  appleOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    marginBottom: 18,
  },
  appleOptionText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
  },
  appleActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  appleCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
  },
  appleCancelText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  appleSubmitBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  appleSubmitText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "700",
  },
  // Google Modal Styles
  googleModalCard: {
    backgroundColor: Colors.surface,
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  googleHeader: {
    alignItems: "center",
    marginBottom: 18,
    gap: 6,
  },
  googleModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  googleModalSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 16,
  },
  googleAccountsList: {
    gap: 10,
    marginBottom: 16,
  },
  googleAccountItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  googleAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  googleAvatarText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  googleAccountName: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  googleAccountEmail: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  googleCancelBtn: {
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  googleCancelText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
});
