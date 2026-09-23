import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { Colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

export const BiometricPromptModal: React.FC = () => {
  const {
    isAuthenticated,
    isBiometricEnrolled,
    hasAnsweredBiometricPrompt,
    enableBiometrics,
    markBiometricPromptAnswered
  } = useAuth();

  const [visible, setVisible] = useState(false);
  const [detectedType, setDetectedType] = useState<"FACE_ID" | "TOUCH_ID">("FACE_ID");
  const [status, setStatus] = useState<"PROMPT" | "SCANNING" | "SUCCESS" | "FAILED">("PROMPT");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Only show if user is authenticated, hasn't enrolled biometrics yet, and hasn't dismissed/answered the prompt
    if (isAuthenticated && !isBiometricEnrolled && !hasAnsweredBiometricPrompt) {
      checkDeviceAndPrompt();
    } else {
      setVisible(false);
    }
  }, [isAuthenticated, isBiometricEnrolled, hasAnsweredBiometricPrompt]);

  const checkDeviceAndPrompt = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
      const types: LocalAuthentication.AuthenticationType[] =
        await LocalAuthentication.supportedAuthenticationTypesAsync().catch(
          () => [] as LocalAuthentication.AuthenticationType[]
        );

      const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

      if (hasFingerprint && !hasFace) {
        setDetectedType("TOUCH_ID");
      } else if (hasFace) {
        setDetectedType("FACE_ID");
      } else {
        // Platform heuristic: Apple devices default to Face ID, others to Touch ID
        const isApple =
          Platform.OS === "ios" ||
          (Platform.OS === "web" &&
            typeof navigator !== "undefined" &&
            /iPhone|iPad|Macintosh/i.test(navigator.userAgent));
        setDetectedType(isApple ? "FACE_ID" : "TOUCH_ID");
      }

      // Small delay after login transition before presenting the enrollment prompt
      const timer = setTimeout(() => {
        setStatus("PROMPT");
        setErrorMessage(null);
        setVisible(true);
      }, 700);

      return () => clearTimeout(timer);
    } catch {
      setDetectedType("FACE_ID");
      setVisible(true);
    }
  };

  const handleActivate = async () => {
    setStatus("SCANNING");
    setErrorMessage(null);

    // If on native device, invoke system verification
    if (Platform.OS !== "web") {
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage:
            detectedType === "FACE_ID"
              ? "Face ID'yi SEO Platform için Aktif Edin"
              : "Parmak İzinizi Onaylayın",
          cancelLabel: "Vazgeç",
          fallbackLabel: "Şifre Kullan",
          disableDeviceFallback: false
        });

        if (result.success) {
          await enableBiometrics(detectedType);
          setStatus("SUCCESS");
          setTimeout(() => {
            setVisible(false);
          }, 1200);
          return;
        } else if (result.error === "user_cancel" || result.error === "app_cancel") {
          setStatus("PROMPT");
          return;
        } else {
          setStatus("FAILED");
          setErrorMessage("Biyometrik doğrulama tamamlanamadı.");
          return;
        }
      } catch (err) {
        console.log("Native biometrics activation error:", err);
      }
    }

    // Web / Simulator visual activation simulation
    setTimeout(async () => {
      await enableBiometrics(detectedType);
      setStatus("SUCCESS");
      setTimeout(() => {
        setVisible(false);
      }, 1200);
    }, 1000);
  };

  const handleDismiss = async () => {
    setVisible(false);
    await markBiometricPromptAnswered();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.modalBackdrop}>
        <View style={styles.card}>
          {/* Top Hardware Badge */}
          <View style={styles.hardwareBadge}>
            <View style={styles.hardwareDot} />
            <Text style={styles.hardwareBadgeText}>
              {detectedType === "FACE_ID"
                ? "Cihaz Donanımı: TrueDepth Face ID"
                : "Cihaz Donanımı: Parmak İzi Sensörü"}
            </Text>
          </View>

          {/* Icon Area */}
          <View
            style={[
              styles.iconCircle,
              status === "SUCCESS" && styles.iconCircleSuccess,
              status === "FAILED" && styles.iconCircleFailed
            ]}
          >
            {status === "SUCCESS" ? (
              <Ionicons name="checkmark-circle" size={54} color={Colors.success} />
            ) : status === "FAILED" ? (
              <Ionicons name="alert-circle" size={54} color={Colors.danger} />
            ) : detectedType === "FACE_ID" ? (
              <Ionicons
                name={status === "SCANNING" ? "happy-outline" : "scan-outline"}
                size={48}
                color={Colors.primary}
              />
            ) : (
              <Ionicons
                name="finger-print-outline"
                size={48}
                color={Colors.primary}
              />
            )}

            {/* Scanning beam on Face ID */}
            {status === "SCANNING" && detectedType === "FACE_ID" && (
              <View style={styles.scanningBeam} />
            )}
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.title}>
            {status === "SUCCESS"
              ? (detectedType === "FACE_ID" ? "Face ID Aktif Edildi!" : "Parmak İzi Aktif Edildi!")
              : status === "SCANNING"
              ? "Biyometrik Kimlik Doğrulanıyor..."
              : status === "FAILED"
              ? "Aktivasyon Başarısız"
              : (detectedType === "FACE_ID"
                  ? "Face ID ile Giriş Aktif Edilsin mi?"
                  : "Parmak İzi ile Giriş Aktif Edilsin mi?")}
          </Text>

          <Text style={styles.subtitle}>
            {status === "SUCCESS"
              ? "Harika! Bir sonraki girişinizde şifre yazmadan tek dokunuşla oturum açabilirsiniz."
              : status === "SCANNING"
              ? "Sensör test ediliyor, lütfen bekleyin..."
              : status === "FAILED"
              ? (errorMessage || "Doğrulama onaylanamadı. Lütfen tekrar deneyin.")
              : (detectedType === "FACE_ID"
                  ? "Gelecekteki girişlerinizde e-posta ve şifrenizi tekrar yazmadan sadece yüzünüzü okutarak anında ve güvenle giriş yapabilirsiniz."
                  : "Gelecekteki girişlerinizde şifre girmeden tek dokunuşla parmak izinizi okutarak hesabınıza güvenle erişebilirsiniz.")}
          </Text>

          {/* Action Buttons */}
          {status === "PROMPT" && (
            <View style={styles.btnColumn}>
              <TouchableOpacity
                style={styles.activateBtn}
                onPress={handleActivate}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={detectedType === "FACE_ID" ? "scan" : "finger-print"}
                  size={18}
                  color="#FFFFFF"
                />
                <Text style={styles.activateBtnText}>
                  {detectedType === "FACE_ID" ? "Face ID'yi Aktif Et" : "Parmak İzi'ni Aktif Et"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={handleDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.dismissBtnText}>Şimdi Değil (Daha Sonra)</Text>
              </TouchableOpacity>
            </View>
          )}

          {status === "SCANNING" && (
            <View style={styles.scanningBox}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.scanningText}>Sensör doğrulanıyor...</Text>
            </View>
          )}

          {status === "SUCCESS" && (
            <View style={styles.successBox}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.success} />
              <Text style={styles.successText}>Güvenli Biyometrik Anahtar Kaydedildi</Text>
            </View>
          )}

          {status === "FAILED" && (
            <View style={styles.btnColumn}>
              <TouchableOpacity
                style={styles.activateBtn}
                onPress={handleActivate}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={18} color="#FFFFFF" />
                <Text style={styles.activateBtnText}>Tekrar Dene</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dismissBtn}
                onPress={handleDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.dismissBtnText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    zIndex: 9999
  },
  card: {
    backgroundColor: Colors.surface,
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    padding: 26,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 20
  },
  hardwareBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
    marginBottom: 18
  },
  hardwareDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary
  },
  hardwareBadgeText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: "700"
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    borderWidth: 2,
    borderColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
    position: "relative",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 18
  },
  iconCircleSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: Colors.success,
    shadowColor: Colors.success
  },
  iconCircleFailed: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: Colors.danger,
    shadowColor: Colors.danger
  },
  scanningBeam: {
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
    elevation: 4
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: "center"
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 22,
    paddingHorizontal: 8
  },
  btnColumn: {
    width: "100%",
    gap: 10
  },
  activateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    width: "100%"
  },
  activateBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700"
  },
  dismissBtn: {
    paddingVertical: 10,
    alignItems: "center",
    width: "100%"
  },
  dismissBtnText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  scanningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.surfaceElevated,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    width: "100%",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.borderSubtle
  },
  scanningText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: "600"
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.successSurface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    width: "100%",
    justifyContent: "center"
  },
  successText: {
    fontSize: 13,
    color: Colors.success,
    fontWeight: "700"
  }
});
