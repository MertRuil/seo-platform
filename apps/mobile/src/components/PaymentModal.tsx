import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "./GlassCard";
import { BillingSummary } from "../types";
import { processSubscriptionUpgrade } from "../services/api";

export type PlanTier = "STARTER" | "GROWTH" | "SCALE";
export type BillingInterval = "month" | "year";

interface PlanConfig {
  code: PlanTier;
  title: string;
  monthlyPrice: number;
  yearlyMonthlyEquivalent: number;
  features: string[];
  isPopular?: boolean;
}

const PLANS: PlanConfig[] = [
  {
    code: "STARTER",
    title: "Starter",
    monthlyPrice: 49,
    yearlyMonthlyEquivalent: 39,
    features: ["15 Tarama / ay", "25.000 Sayfa Kotası", "500k AI Token"]
  },
  {
    code: "GROWTH",
    title: "Growth",
    monthlyPrice: 99,
    yearlyMonthlyEquivalent: 79,
    isPopular: true,
    features: ["50 Tarama / ay", "100.000 Sayfa Kotası", "2M AI Token", "Canlı Sıralama Takibi"]
  },
  {
    code: "SCALE",
    title: "Scale",
    monthlyPrice: 199,
    yearlyMonthlyEquivalent: 159,
    features: ["150 Tarama / ay", "250.000 Sayfa Kotası", "5M AI Token", "Otomatik Cloudflare / Edge Dağıtım"]
  }
];

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  initialPlan?: PlanTier;
  onSuccess: (updatedBilling: BillingSummary) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  initialPlan = "GROWTH",
  onSuccess
}) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>(initialPlan);
  const [interval, setInterval] = useState<BillingInterval>("year");
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    orderId: string;
    billing: BillingSummary;
  } | null>(null);

  // Format Card Number (XXXX XXXX XXXX XXXX)
  const handleCardNumberChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 16);
    const formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
    setCardNumber(formatted);
  };

  // Format Expiry (MM/YY)
  const handleExpiryChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 4);
    if (cleaned.length >= 3) {
      setExpiry(`${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`);
    } else {
      setExpiry(cleaned);
    }
  };

  // Format CVC
  const handleCvcChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 4);
    setCvc(cleaned);
  };

  // Detect card brand
  const getCardBrand = () => {
    const raw = cardNumber.replace(/\s/g, "");
    if (raw.startsWith("4")) return "VISA";
    if (/^(5[1-5]|2[2-7])/.test(raw)) return "MASTERCARD";
    if (/^(34|37)/.test(raw)) return "AMEX";
    if (raw.startsWith("9792")) return "TROY";
    return null;
  };

  const planCfg = PLANS.find((p) => p.code === selectedPlan) || PLANS[1];
  const unitPrice = interval === "year" ? planCfg.yearlyMonthlyEquivalent : planCfg.monthlyPrice;
  const subtotal = interval === "year" ? unitPrice * 12 : unitPrice;
  const discount = interval === "year" ? (planCfg.monthlyPrice - planCfg.yearlyMonthlyEquivalent) * 12 : 0;
  const vat = Math.round(subtotal * 0.2);
  const total = subtotal + vat;

  const handleSubmitPayment = async () => {
    setError(null);
    if (!cardHolder.trim()) {
      setError("Lütfen kart üzerindeki isim ve soyismi giriniz.");
      return;
    }
    const rawNumber = cardNumber.replace(/\s/g, "");
    if (rawNumber.length < 15) {
      setError("Lütfen geçerli 16 haneli bir kart numarası giriniz.");
      return;
    }
    if (expiry.length < 5) {
      setError("Lütfen geçerli son kullanma tarihi giriniz (AA/YY).");
      return;
    }
    if (cvc.length < 3) {
      setError("Lütfen 3 haneli güvenlik kodunu (CVC) giriniz.");
      return;
    }

    setLoading(true);
    try {
      const result = await processSubscriptionUpgrade({
        plan_name: selectedPlan,
        interval,
        card_holder: cardHolder.trim(),
        card_last4: rawNumber.slice(-4)
      });

      setSuccessData({
        orderId: result.order_id,
        billing: result.billing
      });
    } catch (err: any) {
      setError(err?.message || "Ödeme işlemi gerçekleştirilemedi. Lütfen bilgilerinizi kontrol ediniz.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    if (successData) {
      onSuccess(successData.billing);
    }
    // reset
    setSuccessData(null);
    setError(null);
    onClose();
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
              <View style={styles.shieldIconBox}>
                <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.headerTitle}>Güvenli Ödeme & Plan Yükseltme</Text>
                <Text style={styles.headerSub}>256-Bit Uçtan Uca SSL Güvenlik Hattı</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* SUCCESS VIEW */}
            {successData ? (
              <View style={styles.successContainer}>
                <View style={styles.successIconCircle}>
                  <Ionicons name="checkmark-sharp" size={44} color={Colors.success} />
                </View>

                <Text style={styles.successTitle}>Ödemeniz Onaylandı!</Text>
                <Text style={styles.successDesc}>
                  Aboneliğiniz başarıyla <Text style={{ color: Colors.primary, fontWeight: "700" }}>{successData.billing.plan_name}</Text> planına yükseltildi.
                </Text>

                <GlassCard style={styles.receiptCard}>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Sipariş Referansı</Text>
                    <Text style={styles.receiptValue}>{successData.orderId}</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Seçilen Plan</Text>
                    <Text style={styles.receiptValue}>{successData.billing.plan_name} ({interval === "year" ? "Yıllık" : "Aylık"})</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Tarama Limiti</Text>
                    <Text style={styles.receiptValue}>{successData.billing.crawls_limit} Site / ay</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>Sayfa Kotası</Text>
                    <Text style={styles.receiptValue}>{successData.billing.pages_limit.toLocaleString()} Sayfa</Text>
                  </View>
                  <View style={styles.receiptRow}>
                    <Text style={styles.receiptLabel}>AI Token Kotası</Text>
                    <Text style={styles.receiptValue}>{successData.billing.ai_tokens_limit.toLocaleString()} Token</Text>
                  </View>
                </GlassCard>

                <TouchableOpacity style={styles.finishBtn} onPress={handleFinish}>
                  <Text style={styles.finishBtnText}>Limitlerimi Kullanmaya Başla</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {/* Billing Interval Toggle */}
                <View style={styles.intervalToggleContainer}>
                  <TouchableOpacity
                    style={[styles.intervalBtn, interval === "month" && styles.intervalBtnActive]}
                    onPress={() => setInterval("month")}
                  >
                    <Text style={[styles.intervalBtnText, interval === "month" && styles.intervalBtnTextActive]}>
                      Aylık Ödeme
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.intervalBtn, interval === "year" && styles.intervalBtnActive]}
                    onPress={() => setInterval("year")}
                  >
                    <Text style={[styles.intervalBtnText, interval === "year" && styles.intervalBtnTextActive]}>
                      Yıllık Ödeme
                    </Text>
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountBadgeText}>%20 İndirim (2 Ay Ücretsiz)</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Plan Selection Cards */}
                <Text style={styles.sectionLabel}>Paket Seçimi</Text>
                <View style={styles.plansRow}>
                  {PLANS.map((plan) => {
                    const isSelected = selectedPlan === plan.code;
                    const price = interval === "year" ? plan.yearlyMonthlyEquivalent : plan.monthlyPrice;

                    return (
                      <TouchableOpacity
                        key={plan.code}
                        style={[
                          styles.planCard,
                          isSelected && styles.planCardSelected,
                          plan.isPopular && !isSelected && styles.planCardPopular
                        ]}
                        onPress={() => setSelectedPlan(plan.code)}
                        activeOpacity={0.8}
                      >
                        {plan.isPopular && (
                          <View style={styles.popularTag}>
                            <Text style={styles.popularTagText}>EN ÇOK SEÇİLEN</Text>
                          </View>
                        )}
                        <View style={styles.planCardTop}>
                          <Text style={[styles.planCardTitle, isSelected && styles.planCardTitleSelected]}>
                            {plan.title}
                          </Text>
                          <View style={styles.radioCircle}>
                            {isSelected && <View style={styles.radioCircleInner} />}
                          </View>
                        </View>

                        <Text style={styles.planCardPrice}>
                          ${price}
                          <Text style={styles.planCardInterval}> /ay</Text>
                        </Text>

                        {interval === "year" && (
                          <Text style={styles.yearlyNote}>Yıllık ${price * 12} faturalandırılır</Text>
                        )}

                        <View style={styles.planFeatureList}>
                          {plan.features.map((feat, i) => (
                            <View key={i} style={styles.planFeatureItem}>
                              <Ionicons name="checkmark-circle" size={13} color={isSelected ? Colors.primary : Colors.success} />
                              <Text style={styles.planFeatureText}>{feat}</Text>
                            </View>
                          ))}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Credit Card Input Form */}
                <Text style={styles.sectionLabel}>Kart ve Ödeme Bilgileri</Text>
                <GlassCard style={styles.formCard}>
                  {/* Cardholder Name */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Kart Üzerindeki İsim</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="person-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Örn: Ayberk Çalışkan"
                        placeholderTextColor={Colors.textMuted}
                        value={cardHolder}
                        onChangeText={setCardHolder}
                        autoCapitalize="words"
                      />
                    </View>
                  </View>

                  {/* Card Number */}
                  <View style={styles.inputGroup}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.inputLabel}>Kart Numarası</Text>
                      {getCardBrand() && (
                        <View style={styles.cardBrandBadge}>
                          <Text style={styles.cardBrandText}>{getCardBrand()}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.inputWrapper}>
                      <Ionicons name="card-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="4532 •••• •••• 8921"
                        placeholderTextColor={Colors.textMuted}
                        value={cardNumber}
                        onChangeText={handleCardNumberChange}
                        keyboardType="numeric"
                        maxLength={19}
                      />
                    </View>
                  </View>

                  {/* Expiry & CVC Row */}
                  <View style={styles.rowTwoInputs}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.inputLabel}>Son Kul. (AA/YY)</Text>
                      <View style={styles.inputWrapper}>
                        <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                        <TextInput
                          style={styles.textInput}
                          placeholder="12/28"
                          placeholderTextColor={Colors.textMuted}
                          value={expiry}
                          onChangeText={handleExpiryChange}
                          keyboardType="numeric"
                          maxLength={5}
                        />
                      </View>
                    </View>

                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.inputLabel}>CVC / CVV</Text>
                        <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
                      </View>
                      <View style={styles.inputWrapper}>
                        <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                        <TextInput
                          style={styles.textInput}
                          placeholder="892"
                          placeholderTextColor={Colors.textMuted}
                          value={cvc}
                          onChangeText={handleCvcChange}
                          keyboardType="numeric"
                          secureTextEntry
                          maxLength={4}
                        />
                      </View>
                    </View>
                  </View>
                </GlassCard>

                {/* Error Banner */}
                {error && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={18} color={Colors.danger} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Order Summary */}
                <Text style={styles.sectionLabel}>Sipariş Özeti</Text>
                <GlassCard style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{planCfg.title} Planı ({interval === "year" ? "12 Ay" : "1 Ay"})</Text>
                    <Text style={styles.summaryValue}>${subtotal}</Text>
                  </View>

                  {discount > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={[styles.summaryLabel, { color: Colors.success }]}>Yıllık Sadakat İndirimi (%20)</Text>
                      <Text style={[styles.summaryValue, { color: Colors.success }]}>-${discount}</Text>
                    </View>
                  )}

                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>KDV / Vergiler (%20)</Text>
                    <Text style={styles.summaryValue}>${vat}</Text>
                  </View>

                  <View style={styles.summaryDivider} />

                  <View style={styles.summaryTotalRow}>
                    <Text style={styles.summaryTotalLabel}>Toplam Tutar</Text>
                    <Text style={styles.summaryTotalValue}>${total}</Text>
                  </View>
                </GlassCard>

                {/* Trust Badges */}
                <View style={styles.trustBadgesRow}>
                  <View style={styles.trustBadgeItem}>
                    <Ionicons name="lock-closed" size={14} color={Colors.success} />
                    <Text style={styles.trustBadgeText}>256-Bit SSL</Text>
                  </View>
                  <View style={styles.trustBadgeItem}>
                    <Ionicons name="ribbon" size={14} color={Colors.primary} />
                    <Text style={styles.trustBadgeText}>PCI-DSS L1</Text>
                  </View>
                  <View style={styles.trustBadgeItem}>
                    <Ionicons name="refresh" size={14} color={Colors.info} />
                    <Text style={styles.trustBadgeText}>14 Gün İade</Text>
                  </View>
                </View>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.payButton, loading && styles.payButtonDisabled]}
                  onPress={handleSubmitPayment}
                  disabled={loading}
                >
                  {loading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.payButtonText}>Güvenli Bağlantı Kuruluyor...</Text>
                    </View>
                  ) : (
                    <View style={styles.payButtonRow}>
                      <Ionicons name="lock-closed" size={18} color="#FFFFFF" />
                      <Text style={styles.payButtonText}>Güvenle Öde ve Başlat (${total})</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={styles.secureDisclaimer}>
                  Ödemeniz 256-bit banka düzeyinde şifreleme ile işlenir. Kart bilgileriniz sunucularımızda saklanmaz.
                </Text>
              </>
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
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "flex-end",
    alignItems: "center"
  },
  sheet: {
    backgroundColor: Colors.surfaceElevated,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    borderTopWidth: 1,
    borderColor: Colors.border,
    paddingTop: 16,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center"
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  shieldIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    justifyContent: "center",
    alignItems: "center"
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textPrimary
  },
  headerSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2
  },
  scroll: {
    flexGrow: 1
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40
  },
  intervalToggleContainer: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    padding: 4,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderSubtle
  },
  intervalBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10
  },
  intervalBtnActive: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderFocus
  },
  intervalBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted
  },
  intervalBtnTextActive: {
    color: Colors.textPrimary,
    fontWeight: "700"
  },
  discountBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.success
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 6
  },
  plansRow: {
    gap: 10,
    marginBottom: 20
  },
  planCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    position: "relative"
  },
  planCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    borderWidth: 2
  },
  planCardPopular: {
    borderColor: "rgba(99, 102, 241, 0.4)"
  },
  popularTag: {
    position: "absolute",
    top: -10,
    right: 14,
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8
  },
  popularTagText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.5
  },
  planCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  planCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textPrimary
  },
  planCardTitleSelected: {
    color: Colors.primary
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.borderFocus,
    justifyContent: "center",
    alignItems: "center"
  },
  radioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary
  },
  planCardPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginTop: 4
  },
  planCardInterval: {
    fontSize: 12,
    fontWeight: "500",
    color: Colors.textMuted
  },
  yearlyNote: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 6
  },
  planFeatureList: {
    marginTop: 8,
    gap: 4
  },
  planFeatureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  planFeatureText: {
    fontSize: 12,
    color: Colors.textSecondary
  },
  formCard: {
    padding: 16,
    marginBottom: 16
  },
  inputGroup: {
    marginBottom: 12
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 6
  },
  cardBrandBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4
  },
  cardBrandText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.primary
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12
  },
  inputIcon: {
    marginRight: 8
  },
  textInput: {
    flex: 1,
    height: 44,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "500"
  },
  rowTwoInputs: {
    flexDirection: "row",
    gap: 12
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dangerSurface,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: Colors.danger,
    fontWeight: "600"
  },
  summaryCard: {
    padding: 16,
    marginBottom: 16
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginVertical: 8
  },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.textPrimary
  },
  summaryTotalValue: {
    fontSize: 19,
    fontWeight: "900",
    color: Colors.primary
  },
  trustBadgesRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle
  },
  trustBadgeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  trustBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.textSecondary
  },
  payButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4
  },
  payButtonDisabled: {
    opacity: 0.7
  },
  payButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  payButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  secureDisclaimer: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 14
  },
  // SUCCESS VIEW STYLES
  successContainer: {
    alignItems: "center",
    paddingVertical: 24
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.successSurface,
    borderWidth: 2,
    borderColor: Colors.successBorder,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.textPrimary,
    marginBottom: 8
  },
  successDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 16
  },
  receiptCard: {
    width: "100%",
    padding: 16,
    marginBottom: 24
  },
  receiptRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle
  },
  receiptLabel: {
    fontSize: 13,
    color: Colors.textMuted
  },
  receiptValue: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary
  },
  finishBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.success,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: "center"
  },
  finishBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF"
  }
});
