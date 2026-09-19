import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";

export const HubScreen: React.FC = () => {
  const { setActiveTab, selectedSite } = useApp();
  const { user } = useAuth();

  const HUB_MODULES = [
    {
      tab: "keywords" as const,
      title: "Anahtar Kelimeler",
      desc: "Sıralama takibi, arama hacimleri ve kelime araştırması",
      icon: "trending-up" as const,
      color: Colors.primary,
      bg: "rgba(99, 102, 241, 0.12)"
    },
    {
      tab: "competitors" as const,
      title: "Rakip Analizi",
      desc: "Sektör rakipleri, SEO skoru ve keyword gap karşılaştırması",
      icon: "people" as const,
      color: Colors.accent,
      bg: "rgba(139, 92, 246, 0.12)"
    },
    {
      tab: "tasks" as const,
      title: "SEO Görevleri",
      desc: "AI önceliklendirmeli yapılacaklar listesi ve iş takibi",
      icon: "checkbox" as const,
      color: Colors.info,
      bg: "rgba(56, 189, 248, 0.12)"
    },
    {
      tab: "content_optimizer" as const,
      title: "İçerik Optimizasyonu",
      desc: "Sayfa kelime yoğunluğu, eksik entityler ve AI içerik üretici",
      icon: "document-text" as const,
      color: Colors.success,
      bg: "rgba(16, 185, 129, 0.12)"
    },
    {
      tab: "reports" as const,
      title: "Raporlar & Paylaşım",
      desc: "Günlük, haftalık ve aylık yönetici özetleri ve PDF paylaşımı",
      icon: "bar-chart" as const,
      color: "#F59E0B",
      bg: "rgba(245, 158, 11, 0.12)"
    },
    {
      tab: "knowledge" as const,
      title: "SEO Rehberi & Kılavuz",
      desc: "Google Search Central doğrulanmış dokümantasyonu",
      icon: "book" as const,
      color: Colors.primary,
      bg: "rgba(99, 102, 241, 0.12)"
    },
    {
      tab: "billing" as const,
      title: "Plan & AI Kotası",
      desc: "Aktif abonelik planı, crawl kotaları ve token yönetimi",
      icon: "card" as const,
      color: Colors.info,
      bg: "rgba(56, 189, 248, 0.12)"
    },
    {
      tab: "settings" as const,
      title: "Ayarlar & Güvenlik",
      desc: "Biyometrik Face ID, push bildirimler ve CMS entegrasyonları",
      icon: "settings-sharp" as const,
      color: Colors.textSecondary,
      bg: Colors.surfaceElevated
    }
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.hubIcon}>
            <Ionicons name="grid" size={18} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>SEO Araçları & Modüller</Text>
            <Text style={styles.headerSub}>Tüm gelişmiş özelliklere hızlı erişim</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Site Profile Banner */}
        <GlassCard style={styles.profileBanner}>
          <View style={styles.bannerRow}>
            <View style={styles.siteIconBox}>
              <Ionicons name="globe-outline" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerSiteName}>{selectedSite?.name || "Web Siteniz"}</Text>
              <Text style={styles.bannerDomain}>{selectedSite?.domain || "siteniz.com"}</Text>
            </View>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>PRO</Text>
            </View>
          </View>
        </GlassCard>

        {/* Modules Grid */}
        <View style={styles.modulesGrid}>
          {HUB_MODULES.map((m) => (
            <TouchableOpacity
              key={m.tab}
              style={styles.moduleCard}
              onPress={() => setActiveTab(m.tab)}
              activeOpacity={0.7}
            >
              <View style={[styles.moduleIconBox, { backgroundColor: m.bg }]}>
                <Ionicons name={m.icon} size={22} color={m.color} />
              </View>
              <Text style={styles.moduleTitle}>{m.title}</Text>
              <Text style={styles.moduleDesc} numberOfLines={2}>{m.desc}</Text>
              <View style={styles.arrowRow}>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hubIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  profileBanner: {
    padding: 14,
    borderRadius: 16,
  },
  bannerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  siteIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerSiteName: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  bannerDomain: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  planBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.4)",
  },
  planBadgeText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: "800",
  },
  modulesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  moduleCard: {
    width: "48%",
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 8,
  },
  moduleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  moduleTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  moduleDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  arrowRow: {
    alignSelf: "flex-end",
    marginTop: "auto",
  },
});
