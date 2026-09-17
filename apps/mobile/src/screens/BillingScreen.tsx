import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { fetchBilling } from "../services/api";
import { BillingSummary } from "../types";
import { PaymentModal, PlanTier } from "../components/PaymentModal";

export const BillingScreen: React.FC = () => {
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [modalTargetPlan, setModalTargetPlan] = useState<PlanTier>("SCALE");

  useEffect(() => {
    loadBilling();
  }, []);

  const loadBilling = async () => {
    const data = await fetchBilling();
    setBilling(data);
  };

  const handleOpenUpgrade = (planName: PlanTier) => {
    if (billing?.plan_name === "SCALE" && planName === "SCALE") {
      setToast("Zaten en üst paket olan SCALE planını kullanıyorsunuz.");
      setTimeout(() => setToast(null), 4000);
      return;
    }
    setModalTargetPlan(planName);
    setPaymentModalVisible(true);
  };

  const handlePaymentSuccess = (updatedBilling: BillingSummary) => {
    setBilling(updatedBilling);
    setToast(`🎉 Tebrikler! Aboneliğiniz ${updatedBilling.plan_name} planına başarıyla yükseltildi. Yeni kotalarınız aktif.`);
    setTimeout(() => setToast(null), 5000);
  };


  if (!billing) return null;

  const crawlsPct = billing.crawls_limit > 0 ? Math.round((billing.crawls_used / billing.crawls_limit) * 100) : 0;
  const pagesPct = billing.pages_limit > 0 ? Math.round((billing.pages_used / billing.pages_limit) * 100) : 0;
  const tokensPct = billing.ai_tokens_limit > 0 ? Math.round((billing.ai_tokens_used / billing.ai_tokens_limit) * 100) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Abonelik & Kota Yönetimi</Text>
      <Text style={styles.pageSubtitle}>
        Mevcut plan limitlerinizi ve otonom ajan kullanımınızı takip edin.
      </Text>

      {/* Success Toast Banner */}
      {toast && (
        <View style={styles.toastBanner}>
          <Ionicons name="sparkles" size={18} color={Colors.primary} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}

      {/* Active Plan Card */}
      <GlassCard variant="elevated" style={styles.planCard}>
        <View style={styles.planHeader}>
          <View>
            <Text style={styles.planBadgeText}>MEVCUT ABONELİK</Text>
            <Text style={styles.planName}>{billing.plan_name} PLAN</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{billing.status}</Text>
          </View>
        </View>
        <Text style={styles.renewsText}>
          Yenilenme Tarihi: {new Date(billing.renews_at).toLocaleDateString("tr-TR")}
        </Text>
      </GlassCard>

      {/* Quota Usage Meters */}
      <Text style={styles.sectionHeader}>Kullanım Kotaları</Text>

      {/* Crawls Quota */}
      <GlassCard style={styles.quotaCard}>
        <View style={styles.quotaRow}>
          <Text style={styles.quotaLabel}>Aylık Site Taramaları</Text>
          <Text style={styles.quotaVal}>{billing.crawls_used} / {billing.crawls_limit} (%{crawlsPct})</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${Math.min(100, crawlsPct)}%` }]} />
        </View>
      </GlassCard>

      {/* Pages Quota */}
      <GlassCard style={styles.quotaCard}>
        <View style={styles.quotaRow}>
          <Text style={styles.quotaLabel}>Taranan Sayfa Kotası</Text>
          <Text style={styles.quotaVal}>{billing.pages_used.toLocaleString()} / {billing.pages_limit.toLocaleString()} (%{pagesPct})</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${Math.min(100, pagesPct)}%` }]} />
        </View>
      </GlassCard>

      {/* AI Tokens Quota */}
      <GlassCard style={styles.quotaCard}>
        <View style={styles.quotaRow}>
          <Text style={styles.quotaLabel}>AI Ajan Token Kullanımı</Text>
          <Text style={styles.quotaVal}>{billing.ai_tokens_used.toLocaleString()} / {billing.ai_tokens_limit.toLocaleString()} (%{tokensPct})</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${Math.min(100, tokensPct)}%`, backgroundColor: Colors.primary }]} />
        </View>
      </GlassCard>

      {/* Available Plans Highlight */}
      <Text style={styles.sectionHeader}>Plan Yükseltme Seçenekleri</Text>

      {/* Growth Plan Card */}
      <GlassCard style={[styles.tierCard, { marginBottom: 14 }]}>
        <View style={styles.tierHeader}>
          <View>
            <View style={styles.badgeRow}>
              <Text style={styles.tierName}>Growth Plan</Text>
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>POPÜLER</Text>
              </View>
            </View>
            <Text style={styles.tierSub}>Hızla büyüyen e-ticaret ve SaaS siteleri</Text>
          </View>
          <Text style={styles.tierPrice}>$99 <Text style={styles.tierMonth}>/ay</Text></Text>
        </View>
        <Text style={styles.tierFeature}>• 50 Derin Tarama / ay & Canlı İzleme</Text>
        <Text style={styles.tierFeature}>• 100,000 Sayfa / 2,000,000 AI Token</Text>
        <Text style={styles.tierFeature}>• Canlı Anahtar Kelime & Sıralama Takibi</Text>

        <TouchableOpacity 
          style={[styles.upgradeBtn, { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.primary }]}
          onPress={() => handleOpenUpgrade("GROWTH")}
        >
          <Text style={[styles.upgradeBtnText, { color: Colors.primary }]}>Growth Planını İncele & Yükselt</Text>
        </TouchableOpacity>
      </GlassCard>

      {/* Scale Plan Card */}
      <GlassCard style={styles.tierCard}>
        <View style={styles.tierHeader}>
          <View>
            <Text style={styles.tierName}>Scale Plan</Text>
            <Text style={styles.tierSub}>Kurumsal ve çoklu alan adı desteği</Text>
          </View>
          <Text style={styles.tierPrice}>$199 <Text style={styles.tierMonth}>/ay</Text></Text>
        </View>
        <Text style={styles.tierFeature}>• Sınırsız Hızlı Denetim & 150 Tarama/ay</Text>
        <Text style={styles.tierFeature}>• 250,000 Sayfa / 5,000,000 AI Token</Text>
        <Text style={styles.tierFeature}>• Cloudflare & Edge Otomatik Canlı Dağıtım</Text>

        <TouchableOpacity 
          style={styles.upgradeBtn}
          onPress={() => handleOpenUpgrade("SCALE")}
        >
          <Text style={styles.upgradeBtnText}>Scale Planına Yükselt</Text>
        </TouchableOpacity>
      </GlassCard>

      {/* Payment & Checkout Modal */}
      <PaymentModal
        visible={paymentModalVisible}
        onClose={() => setPaymentModalVisible(false)}
        initialPlan={modalTargetPlan}
        onSuccess={handlePaymentSuccess}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    marginBottom: 16,
  },
  planCard: {
    marginBottom: 20,
    padding: 20,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  planName: {
    fontSize: 24,
    fontWeight: "800",
    color: Colors.textPrimary,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: Colors.successSurface,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  statusText: {
    color: Colors.success,
    fontSize: 11,
    fontWeight: "700",
  },
  renewsText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 12,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  quotaCard: {
    marginBottom: 12,
    padding: 14,
  },
  quotaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  quotaLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  quotaVal: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.success,
    borderRadius: 3,
  },
  tierCard: {
    marginTop: 6,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  tierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  tierName: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  popularBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  popularBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  tierSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  tierPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.primary,
  },
  tierMonth: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "400",
  },
  tierFeature: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  upgradeBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 14,
  },
  upgradeBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  toastBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  toastText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
});
