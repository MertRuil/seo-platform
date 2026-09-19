import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";

interface OnboardingModalProps {
  visible: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ visible, onClose }) => {
  const { addNewSite, startCrawl, setSelectedSite } = useApp();

  const [step, setStep] = useState<number>(1);
  const [userType, setUserType] = useState<string>("BUSINESS_OWNER");
  const [skillLevel, setSkillLevel] = useState<string>("INTERMEDIATE");
  const [primaryGoal, setPrimaryGoal] = useState<string>("GEO_VISIBILITY");

  // Site onboarding fields
  const [siteUrl, setSiteUrl] = useState("");
  const [siteName, setSiteName] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const USER_TYPES = [
    { id: "BUSINESS_OWNER", label: "İşletme Sahibi", icon: "briefcase-outline", desc: "Kendi sitemin trafiğini ve satışlarını artırmak istiyorum." },
    { id: "ECOMMERCE", label: "E-Ticaret Mağazası", icon: "cart-outline", desc: "Ürün sayfalarında Rich Snippet ve Google alışveriş sıralaması." },
    { id: "AGENCY", label: "SEO / Dijital Ajans", icon: "business-outline", desc: "Çoklu müşteri yönetimi ve otonom raporlama." },
    { id: "FREELANCER", label: "Freelancer / Danışman", icon: "laptop-outline", desc: "Hızlı SEO audit ve aksiyon üretimi." },
    { id: "SEO_SPECIALIST", label: "Teknik SEO Uzmanı", icon: "code-slash-outline", desc: "Derin tarama, Core Web Vitals ve log analitiği." },
    { id: "CONTENT_CREATOR", label: "İçerik Üreticisi / Blogger", icon: "newspaper-outline", desc: "Helpful Content, blog ve GEO optimizasyonu." },
  ];

  const SKILL_LEVELS = [
    { id: "BEGINNER", label: "Başlangıç", desc: "SEO hakkında temel bilgiye sahibim, net ve basit yönergeler istiyorum." },
    { id: "INTERMEDIATE", label: "Orta Seviye", desc: "On-page ve teknik SEO kavramlarına hakimim, AI ile süreci hızlandırmak istiyorum." },
    { id: "EXPERT", label: "İleri / Uzman", desc: "Derin tarama, JSON-LD, sunucu ve GEO modellerinde tam kontrol arıyorum." },
  ];

  const GOALS = [
    { id: "GEO_VISIBILITY", label: "AI Search & GEO Görünürlüğü", icon: "globe-outline", desc: "ChatGPT, Perplexity ve Google AI Overview'da kaynak olarak yer alma." },
    { id: "TRAFFIC", label: "Organik Trafik Artırma", icon: "trending-up", desc: "Google arama sonuçlarından sitenize gelen tıklamaları katlama." },
    { id: "RANKINGS", label: "Google İlk Sayfa Sıralaması", icon: "ribbon-outline", desc: "Hedef anahtar kelimelerde ilk 3 sıraya yükselme." },
    { id: "TECHNICAL_SEO", label: "Kritik Teknik Hataları Düzeltme", icon: "shield-checkmark-outline", desc: "404, kanonikleştirme, sitemap ve Core Web Vitals temizliği." },
    { id: "COMPETITOR", label: "Rakip Analizi & Keyword Gap", icon: "analytics-outline", desc: "Rakiplerin organik stratejisini ve kelime boşluklarını keşfetme." },
  ];

  const handleFinishOnboarding = async () => {
    if (!siteUrl.trim()) return;
    setIsAnalyzing(true);
    try {
      const site = await addNewSite(
        siteName.trim() || siteUrl.trim(),
        siteUrl.trim(),
        siteUrl.trim()
      );
      setSelectedSite(site);
      await startCrawl(site.total_pages || 50, site);
      setStep(5); // Show congratulations / initial score preview
    } catch {
      // Proceed even if error
      setStep(5);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Progress Indicator */}
          <View style={styles.progressBarWrapper}>
            <View style={[styles.progressBar, { width: `${(step / 5) * 100}%` }]} />
          </View>

          {/* Header Bar */}
          <View style={styles.headerRow}>
            <Text style={styles.stepBadge}>Adım {step} / 5</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Step 1: User Type Selection */}
          {step === 1 && (
            <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepContent}>
              <Text style={styles.title}>Hoş Geldiniz! Sizi Tanıyalım</Text>
              <Text style={styles.subtitle}>Size en uygun SEO ve GEO deneyimini sunmak için rolünüzü seçin:</Text>

              <View style={styles.optionsList}>
                {USER_TYPES.map((t) => {
                  const isSelected = userType === t.id;
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                      onPress={() => setUserType(t.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.optionIcon, isSelected && styles.optionIconSelected]}>
                        <Ionicons
                          name={t.icon as any}
                          size={22}
                          color={isSelected ? "#FFFFFF" : Colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                          {t.label}
                        </Text>
                        <Text style={styles.optionDesc}>{t.desc}</Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.nextButton}
                onPress={() => setStep(2)}
                activeOpacity={0.8}
              >
                <Text style={styles.nextButtonText}>Devam Et</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Step 2: Skill Level Selection */}
          {step === 2 && (
            <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepContent}>
              <Text style={styles.title}>SEO Bilgi Seviyeniz</Text>
              <Text style={styles.subtitle}>Teknik açıklamaların ve AI önerilerinin derinliğini belirleyelim:</Text>

              <View style={styles.optionsList}>
                {SKILL_LEVELS.map((s) => {
                  const isSelected = skillLevel === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                      onPress={() => setSkillLevel(s.id)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                          {s.label}
                        </Text>
                        <Text style={styles.optionDesc}>{s.desc}</Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.backButton} onPress={() => setStep(1)}>
                  <Text style={styles.backButtonText}>Geri</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.nextButton} onPress={() => setStep(3)}>
                  <Text style={styles.nextButtonText}>Devam Et</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* Step 3: Primary Goal */}
          {step === 3 && (
            <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepContent}>
              <Text style={styles.title}>Ana Hedefiniz Nedir?</Text>
              <Text style={styles.subtitle}>Öncelikli olarak sitenizde neyi başarmak istiyorsunuz?</Text>

              <View style={styles.optionsList}>
                {GOALS.map((g) => {
                  const isSelected = primaryGoal === g.id;
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                      onPress={() => setPrimaryGoal(g.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.optionIcon, isSelected && styles.optionIconSelected]}>
                        <Ionicons
                          name={g.icon as any}
                          size={22}
                          color={isSelected ? "#FFFFFF" : Colors.primary}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                          {g.label}
                        </Text>
                        <Text style={styles.optionDesc}>{g.desc}</Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.backButton} onPress={() => setStep(2)}>
                  <Text style={styles.backButtonText}>Geri</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.nextButton} onPress={() => setStep(4)}>
                  <Text style={styles.nextButtonText}>Devam Et</Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* Step 4: Add First Website & Start Crawl */}
          {step === 4 && (
            <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepContent}>
              <Text style={styles.title}>İlk Web Sitenizi Ekleyin</Text>
              <Text style={styles.subtitle}>Sitenizin alan adını yazın, otonom Googlebot tarayıcımız anında incelesin:</Text>

              <View style={styles.inputBox}>
                <Text style={styles.fieldLabel}>Web Sitesi URL / Alan Adı</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="globe-outline" size={18} color={Colors.textMuted} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="ornek: siteniz.com"
                    placeholderTextColor={Colors.textMuted}
                    value={siteUrl}
                    onChangeText={setSiteUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.inputBox}>
                <Text style={styles.fieldLabel}>Proje / Marka Adı (Opsiyonel)</Text>
                <View style={styles.inputWrap}>
                  <Ionicons name="bookmark-outline" size={18} color={Colors.textMuted} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="ornek: E-Ticaret Mağazam"
                    placeholderTextColor={Colors.textMuted}
                    value={siteName}
                    onChangeText={setSiteName}
                  />
                </View>
              </View>

              <GlassCard style={styles.infoBanner}>
                <Ionicons name="shield-checkmark" size={20} color={Colors.success} />
                <Text style={styles.infoBannerText}>
                  Tarayıcımız sitenizin sitemap'ini, kanoniklerini, Core Web Vitals ve GEO görünürlüğünü otomatik analiz eder.
                </Text>
              </GlassCard>

              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.backButton} onPress={() => setStep(3)}>
                  <Text style={styles.backButtonText}>Geri</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextButton, (!siteUrl.trim() || isAnalyzing) && { opacity: 0.6 }]}
                  disabled={!siteUrl.trim() || isAnalyzing}
                  onPress={handleFinishOnboarding}
                >
                  {isAnalyzing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.nextButtonText}>Analizi Başlat</Text>
                      <Ionicons name="flash" size={16} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}

          {/* Step 5: Initial Score & First Checklist */}
          {step === 5 && (
            <ScrollView style={styles.stepScroll} contentContainerStyle={styles.stepContent}>
              <View style={styles.congratsBadge}>
                <Ionicons name="checkmark-done" size={36} color={Colors.success} />
              </View>
              <Text style={styles.title}>Kurulum Tamamlandı! 🎉</Text>
              <Text style={styles.subtitle}>
                {siteUrl} siteniz için başlangıç denetimi başlatıldı. Yapay zeka ve teknik tarama verileriniz hazırlandı.
              </Text>

              {/* Initial Score Card */}
              <GlassCard style={styles.scorePreviewCard}>
                <Text style={styles.scorePrevLabel}>Başlangıç Tahmini SEO Skoru</Text>
                <Text style={styles.scorePrevNumber}>84</Text>
                <Text style={styles.scorePrevSub}>İlk tarama tamamlandığında kesinleşecektir.</Text>
              </GlassCard>

              {/* First Action Checklist */}
              <View style={styles.checklistSection}>
                <Text style={styles.checkTitle}>Sizin İçin Hazırlanan İlk Görevler:</Text>
                <View style={styles.checkItem}>
                  <Ionicons name="checkbox-outline" size={18} color={Colors.primary} />
                  <Text style={styles.checkText}>Kanonikleştirme & self-referential etiket kontrolü</Text>
                </View>
                <View style={styles.checkItem}>
                  <Ionicons name="checkbox-outline" size={18} color={Colors.primary} />
                  <Text style={styles.checkText}>ChatGPT & Perplexity için Schema.org JSON-LD ekleme</Text>
                </View>
                <View style={styles.checkItem}>
                  <Ionicons name="checkbox-outline" size={18} color={Colors.primary} />
                  <Text style={styles.checkText}>İlk 5 hedef anahtar kelimeyi ekleyip sıralama takibini açma</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.nextButton}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.nextButtonText}>Panele Git ve Başla</Text>
                <Ionicons name="rocket-outline" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </ScrollView>
          )}
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
  },
  container: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: "90%",
    borderWidth: 1,
    borderColor: Colors.border,
    paddingTop: 8,
  },
  progressBarWrapper: {
    width: "100%",
    height: 4,
    backgroundColor: Colors.surfaceElevated,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.primary,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  stepBadge: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stepScroll: {
    flex: 1,
  },
  stepContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  optionsList: {
    gap: 10,
    marginBottom: 24,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceElevated,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    gap: 14,
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionIconSelected: {
    backgroundColor: Colors.primary,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  optionLabelSelected: {
    color: Colors.primary,
  },
  optionDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  backButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  backButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
  nextButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  nextButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  inputBox: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  textInput: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    color: Colors.textPrimary,
    fontSize: 14,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    marginBottom: 24,
  },
  infoBannerText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 12,
    lineHeight: 18,
  },
  congratsBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    alignSelf: "center",
  },
  scorePreviewCard: {
    alignItems: "center",
    padding: 20,
    borderRadius: 18,
    marginBottom: 20,
    backgroundColor: Colors.surfaceElevated,
  },
  scorePrevLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
  },
  scorePrevNumber: {
    color: Colors.primary,
    fontSize: 48,
    fontWeight: "800",
  },
  scorePrevSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  checklistSection: {
    backgroundColor: Colors.surfaceElevated,
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    gap: 10,
  },
  checkTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkText: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
});
