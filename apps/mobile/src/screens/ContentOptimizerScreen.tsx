import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Platform,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";
import { analyzeContentUrl, generateAiSeoContent, scanTurkishCompliance, scanEuCompliance, scanUsCompliance, scanAsiaCompliance, checkUkCompliance, scanMenaCompliance } from "../services/api";
import { 
  ContentOptimizationResult, 
  GeneratedContentResult, 
  ComplianceSector, 
  ComplianceViolation,
  EuComplianceSector,
  EuComplianceViolation,
  UsComplianceSector,
  UsComplianceViolation,
  AsiaComplianceSector,
  AsiaComplianceViolation,
  UkComplianceSector,
  UkComplianceViolation,
  MenaComplianceSector,
  MenaComplianceViolation,
  ComplianceJurisdiction
} from "../types";

export const ContentOptimizerScreen: React.FC = () => {
  const { selectedSite, setActiveTab } = useApp();
  const [activeTabSub, setActiveTabSub] = useState<"OPTIMIZER" | "GENERATOR" | "COMPLIANCE">("COMPLIANCE");

  // Optimizer state
  const [urlInput, setUrlInput] = useState(selectedSite?.primary_url || "https://acmestore.io");
  const [targetKw, setTargetKw] = useState("organik seo uzmanı");
  const [analyzing, setAnalyzing] = useState(false);
  const [optResult, setOptResult] = useState<ContentOptimizationResult | null>(null);

  // Generator state
  const [genType, setGenType] = useState<GeneratedContentResult["type"]>("META_TITLE");
  const [topicInput, setTopicInput] = useState("E-Ticaret Dönüşüm Oranı Artırma");
  const [genTargetKw, setGenTargetKw] = useState("e-ticaret seo ipuçları");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<GeneratedContentResult | null>(null);

  // Compliance state (TR, EU, US & ASIA)
  const [complianceJurisdiction, setComplianceJurisdiction] = useState<ComplianceJurisdiction>("TR");
  const [complianceDraft, setComplianceDraft] = useState(
    "Kliniğimizde en iyi doktor kadromuzla kesin tedavi garantisi sunuyoruz. Öncesi sonrası fotoğraflarımızı inceleyin, sıfır risk ile şifa bulun."
  );
  const [complianceSector, setComplianceSector] = useState<ComplianceSector | "ALL">("ALL");
  const [euComplianceSector, setEuComplianceSector] = useState<EuComplianceSector | "ALL">("ALL");
  const [usComplianceSector, setUsComplianceSector] = useState<UsComplianceSector | "ALL">("ALL");
  const [ukComplianceSector, setUkComplianceSector] = useState<UkComplianceSector | "ALL">("ALL");
  const [asiaComplianceSector, setAsiaComplianceSector] = useState<AsiaComplianceSector | "ALL">("ALL");
  const [menaComplianceSector, setMenaComplianceSector] = useState<MenaComplianceSector | "ALL">("ALL");

  const complianceViolations = useMemo(() => {
    if (complianceJurisdiction === "TR") {
      return scanTurkishCompliance(
        complianceDraft,
        complianceSector === "ALL" ? undefined : complianceSector
      );
    } else if (complianceJurisdiction === "EU") {
      return scanEuCompliance(
        complianceDraft,
        euComplianceSector === "ALL" ? undefined : euComplianceSector
      );
    } else if (complianceJurisdiction === "US") {
      return scanUsCompliance(
        complianceDraft,
        usComplianceSector === "ALL" ? undefined : usComplianceSector
      );
    } else if (complianceJurisdiction === "UK") {
      return checkUkCompliance(
        complianceDraft,
        ukComplianceSector === "ALL" ? undefined : ukComplianceSector
      );
    } else if (complianceJurisdiction === "ASIA") {
      return scanAsiaCompliance(
        complianceDraft,
        asiaComplianceSector === "ALL" ? undefined : asiaComplianceSector
      );
    } else {
      return scanMenaCompliance(
        complianceDraft,
        menaComplianceSector === "ALL" ? undefined : menaComplianceSector
      );
    }
  }, [complianceJurisdiction, complianceDraft, complianceSector, euComplianceSector, usComplianceSector, ukComplianceSector, asiaComplianceSector, menaComplianceSector]);

  const handleSelectJurisdiction = (j: ComplianceJurisdiction) => {
    setComplianceJurisdiction(j);
    if (j === "EU") {
      setComplianceDraft(
        "Our revolutionary sneaker is 100% eco-friendly and climate neutral through carbon offset investments. Lose 10 kg in 2 weeks with our guaranteed rapid fat burn formula, cheapest in Europe!"
      );
    } else if (j === "US") {
      setComplianceDraft(
        "Guaranteed cure for diabetes and chronic arthritis with our all-natural supplement! Earn 100% guaranteed return on crypto, buy prescription Adderall online no rx required. Lose 30 lbs in 2 weeks without diet or exercise!"
      );
    } else if (j === "UK") {
      setComplianceDraft(
        "Visit our London aesthetics clinic for cheap botox injections and botulinum toxin treatments! 100% guaranteed cure for arthritis, zero risk crypto yield, and 100% eco-friendly jackets with only 1 left in stock hurry!"
      );
    } else if (j === "ASIA") {
      setComplianceDraft(
        "Tokyo's No. 1 cosmetic cream that cures cancer and permanently removes all wrinkles! Buy Ozempic online without doctor prescription. Guaranteed 100% crypto yield and instant loans in Singapore. ステマ代行 service."
      );
    } else if (j === "MENA") {
      setComplianceDraft(
        "احصل على عوائد مضمونة 100% في الكريبتو بدون أي مخاطر! علاج نهائي لمرض السكري بالأعشاب الطبيعية، اطلب أوزيمبيك وفاليوم الآن توصيل فوري في دبي والرياض بدون وصفة طبية. عقارات فاخرة للبيع بدون ترخيص فال. #إعلان"
      );
    } else {
      setComplianceDraft(
        "Kliniğimizde en iyi doktor kadromuzla kesin tedavi garantisi sunuyoruz. Öncesi sonrası fotoğraflarımızı inceleyin, sıfır risk ile şifa bulun."
      );
    }
  };

  const formatSectorBadge = (sector: string): string => {
    const clean = sector.replace(/^UK_/, "");
    switch (clean) {
      case "HEALTH_ASA_CAP":
        return "🏥 ASA Sağlık / POM";
      case "FINANCIAL_FCA":
        return "🪙 FCA Kripto & Finans";
      case "GREEN_CLAIMS_CMA":
        return "🌿 CMA Yeşil İddialar";
      case "CONSUMER_CMA_ASA":
        return "⏱️ DMCC Sahte Kıtlık";
      case "VAPING_TOBACCO_ASA":
        return "🚭 ASA Vaping Yasağı";
      case "SUPERLATIVE_COMMERCIAL":
        return "🛒 E-Ticaret & Kıtlık";
      case "HEALTH_MEDICAL":
        return "🏥 Sağlık & Klinik";
      case "FOOD_SUPPLEMENT":
        return "💊 Gıda & Zayıflama";
      case "LEGAL_SERVICES":
        return "⚖️ Hukuk & Avukatlık";
      case "FINANCIAL_SERVICES":
        return "💳 Finans & Kredi";
      case "ILLEGAL_BETTING_TOBACCO":
        return "🚭 Bahis & Tütün";
      default:
        return clean;
    }
  };

  const handleFixViolation = (v: ComplianceViolation | EuComplianceViolation | UsComplianceViolation | AsiaComplianceViolation | UkComplianceViolation | MenaComplianceViolation) => {
    const term = v.matched_term || v.matched_pattern;
    const fix = v.suggested_replacement || v.suggested_fix;
    if (!term || !fix) return;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "gi");
    const updated = complianceDraft.replace(regex, fix);
    setComplianceDraft(updated);
    Alert.alert("Düzeltildi", `"${term}" yerine "${fix}" uygulandı.`);
  };

  const handleAnalyze = async () => {
    if (!urlInput.trim()) return;
    setAnalyzing(true);
    try {
      const res = await analyzeContentUrl(urlInput.trim(), targetKw.trim());
      setOptResult(res);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerate = async () => {
    if (!topicInput.trim()) return;
    setGenerating(true);
    try {
      const res = await generateAiSeoContent(genType, topicInput.trim(), genTargetKw.trim());
      setGenResult(res);
    } finally {
      setGenerating(false);
    }
  };

  const handleShareResult = async (content: string) => {
    try {
      await Share.share({ message: content });
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setActiveTab("hub")} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>İçerik Optimizasyonu</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTabSub === "COMPLIANCE" && styles.tabBtnActive]}
          onPress={() => setActiveTabSub("COMPLIANCE")}
          activeOpacity={0.7}
        >
          <Ionicons name="shield-checkmark" size={15} color={activeTabSub === "COMPLIANCE" ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTabSub === "COMPLIANCE" && styles.tabTextActive]}>
            Mevzuat Kalkanı
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTabSub === "OPTIMIZER" && styles.tabBtnActive]}
          onPress={() => setActiveTabSub("OPTIMIZER")}
          activeOpacity={0.7}
        >
          <Ionicons name="scan-outline" size={15} color={activeTabSub === "OPTIMIZER" ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTabSub === "OPTIMIZER" && styles.tabTextActive]}>
            Sayfa Analizi
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTabSub === "GENERATOR" && styles.tabBtnActive]}
          onPress={() => setActiveTabSub("GENERATOR")}
          activeOpacity={0.7}
        >
          <Ionicons name="sparkles" size={15} color={activeTabSub === "GENERATOR" ? Colors.primary : Colors.textMuted} />
          <Text style={[styles.tabText, activeTabSub === "GENERATOR" && styles.tabTextActive]}>
            AI Üretici
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* TAB 3: TR, EU, US & ASIA COMPLIANCE SHIELD */}
        {activeTabSub === "COMPLIANCE" && (
          <>
            {/* Jurisdiction Switcher */}
            <View style={styles.jurisdictionToggleRow}>
              <TouchableOpacity
                style={[
                  styles.jurisdictionBtn,
                  complianceJurisdiction === "TR" && styles.jurisdictionBtnActive,
                ]}
                onPress={() => handleSelectJurisdiction("TR")}
                activeOpacity={0.8}
              >
                <Text style={styles.jurisdictionFlag}>🇹🇷</Text>
                <Text
                  style={[
                    styles.jurisdictionBtnText,
                    complianceJurisdiction === "TR" && styles.jurisdictionBtnTextActive,
                  ]}
                >
                  TR
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.jurisdictionBtn,
                  complianceJurisdiction === "EU" && styles.jurisdictionBtnActive,
                ]}
                onPress={() => handleSelectJurisdiction("EU")}
                activeOpacity={0.8}
              >
                <Text style={styles.jurisdictionFlag}>🇪🇺</Text>
                <Text
                  style={[
                    styles.jurisdictionBtnText,
                    complianceJurisdiction === "EU" && styles.jurisdictionBtnTextActive,
                  ]}
                >
                  EU
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.jurisdictionBtn,
                  complianceJurisdiction === "US" && styles.jurisdictionBtnActive,
                ]}
                onPress={() => handleSelectJurisdiction("US")}
                activeOpacity={0.8}
              >
                <Text style={styles.jurisdictionFlag}>🇺🇸</Text>
                <Text
                  style={[
                    styles.jurisdictionBtnText,
                    complianceJurisdiction === "US" && styles.jurisdictionBtnTextActive,
                  ]}
                >
                  US
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.jurisdictionBtn,
                  complianceJurisdiction === "UK" && styles.jurisdictionBtnActive,
                ]}
                onPress={() => handleSelectJurisdiction("UK")}
                activeOpacity={0.8}
              >
                <Text style={styles.jurisdictionFlag}>🇬🇧</Text>
                <Text
                  style={[
                    styles.jurisdictionBtnText,
                    complianceJurisdiction === "UK" && styles.jurisdictionBtnTextActive,
                  ]}
                >
                  UK
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.jurisdictionBtn,
                  complianceJurisdiction === "ASIA" && styles.jurisdictionBtnActive,
                ]}
                onPress={() => handleSelectJurisdiction("ASIA")}
                activeOpacity={0.8}
              >
                <Text style={styles.jurisdictionFlag}>🌏</Text>
                <Text
                  style={[
                    styles.jurisdictionBtnText,
                    complianceJurisdiction === "ASIA" && styles.jurisdictionBtnTextActive,
                  ]}
                >
                  Asya
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.jurisdictionBtn,
                  complianceJurisdiction === "MENA" && styles.jurisdictionBtnActive,
                ]}
                onPress={() => handleSelectJurisdiction("MENA")}
                activeOpacity={0.8}
              >
                <Text style={styles.jurisdictionFlag}>🇦🇪</Text>
                <Text
                  style={[
                    styles.jurisdictionBtnText,
                    complianceJurisdiction === "MENA" && styles.jurisdictionBtnTextActive,
                  ]}
                >
                  MENA
                </Text>
              </TouchableOpacity>
            </View>

            {/* Header info */}
            <GlassCard style={styles.complianceIntroCard}>
              <View style={styles.secHeader}>
                <Ionicons name="shield-checkmark" size={18} color={Colors.primary} />
                <Text style={styles.complianceIntroTitle}>
                  {complianceJurisdiction === "TR"
                    ? "Türkiye Mevzuat Denetim Kalkanı"
                    : complianceJurisdiction === "EU"
                    ? "Avrupa Birliği (AB) Mevzuat & Greenwashing Kalkanı"
                    : complianceJurisdiction === "US"
                    ? "ABD Federal Mevzuat Kalkanı (FTC / FDA / SEC)"
                    : complianceJurisdiction === "UK"
                    ? "Birleşik Krallık (UK) Reklam Kalkanı (ASA / CMA / FCA)"
                    : complianceJurisdiction === "ASIA"
                    ? "Asya & Pasifik (APAC) Mevzuat Kalkanı (PMDA / SAMR / MAS)"
                    : "Orta Doğu & Körfez (MENA) Mevzuat Kalkanı (BAE NMC / Suudi SFDA / VARA)"}
                </Text>
              </View>
              <Text style={styles.complianceIntroText}>
                {complianceJurisdiction === "TR"
                  ? "Ticaret Bakanlığı Reklam Kurulu, TİTCK (Sağlık Bakanlığı), TBB ve SPK/BDDK mevzuatına göre kullanımı yasak olan veya idari para cezası ve erişim engeline yol açabilecek kelimeleri anlık tarar."
                  : complianceJurisdiction === "EU"
                  ? "Directive (EU) 2024/825 (EmpCo / Greenwashing), Directive 2001/83/EC, EFSA Reg 1924/2006, MiCA (EU) 2023/1114 ve Omnibus direktiflerine göre yasaklı iddia ve yanıltıcı beyanları anlık tarar."
                  : complianceJurisdiction === "US"
                  ? "FTC Act Section 5, 16 CFR Part 464 (Fake Reviews Rule), FDA FD&C Act, DSHEA Act 1994, SEC Rule 10b-5, EPA Green Guides ve PACT Act uyarınca ihlal başına 51.744 $'a varan federal cezaları önler."
                  : complianceJurisdiction === "UK"
                  ? "ASA CAP Code Rule 12 (Reçeteli İlaç & Botox yasağı), CMA Green Claims Code & DMCC Act 2024 (%10 ciro cezası) ve FCA PS23/6 Kripto Promosyon kurallarına göre ihlalleri anlık tarar."
                  : complianceJurisdiction === "ASIA"
                  ? "Japonya Yakki-ho (PMD Act) & JCAA (Stealth Marketing / Keihyo-ho), Çin Reklam Kanunu Md. 9 (SAMR Süperlatif Yasağı), Singapur MAS DPT Kripto Yönergeleri & HSA, ve Kore KFTC (뒷광고) uyarınca ceza ve kısıtlamaları önler."
                  : "BAE Ulusal Medya Konseyi (NMC), Suudi Arabistan SFDA & GCAM (Mawthooq Lisansı), Dubai VARA (10M AED ceza) ve Fal Gayrimenkul reklam kurallarına göre ihlalleri anlık tarar."}
              </Text>
            </GlassCard>

            {/* Quick Presets */}
            <Text style={styles.fieldLabel}>
              {complianceJurisdiction === "TR"
                ? "Hazır Test Senaryoları"
                : complianceJurisdiction === "EU"
                ? "AB Mevzuat Test Senaryoları"
                : complianceJurisdiction === "US"
                ? "ABD Federal Mevzuat Test Senaryoları"
                : complianceJurisdiction === "UK"
                ? "UK Mevzuat Test Senaryoları"
                : complianceJurisdiction === "ASIA"
                ? "Asya/APAC Mevzuat Test Senaryoları"
                : "MENA / Körfez Mevzuat Test Senaryoları"}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScroll}>
              {complianceJurisdiction === "TR" ? (
                <>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Kliniğimizde en iyi doktor kadromuzla kesin tedavi garantisi sunuyoruz. Öncesi sonrası fotoğraflarımızı inceleyin, sıfır risk ile şifa bulun."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🏥 Sağlık İhlali</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "İstanbul'un en iyi avukatı olarak ceza davalarında kesin beraat ve dava kazanma garantisi veriyoruz. İlk danışmanlık tamamen ücretsizdir."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>⚖️ Avukatlık İhlali</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Borsada garantili getiri ve kesin kazanç vaat eden algoritmamızla tanışın. Sicili bozuklara kredi ve senetle borç imkanı."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>💳 Finans / Kredi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Türkiye'nin en ucuz cep telefonu burada! Rakipsiz fiyat ve koşulsuz şartsız iade garantisi."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🛒 E-Ticaret / Fiyat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Uzman hekim kadromuz modern teşhis ve tetkik yöntemleriyle hizmetinizdedir. Randevu ve detaylı bilgi için bize ulaşabilirsiniz."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>✅ Temiz Metin</Text>
                  </TouchableOpacity>
                </>
              ) : complianceJurisdiction === "EU" ? (
                <>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Our revolutionary sneakers are 100% eco-friendly and climate neutral through carbon offset investments. Net-zero product guarantee for green consumers."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🌿 Greenwashing İhlali</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Buy Ozempic and Wegovy online without prescription. Guaranteed cure for chronic obesity with zero risk surgery options."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>💊 Reçeteli İlaç / POM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Lose 10 kg in 2 weeks with our rapid fat burning supplement! Proven botanical formula prevents diabetes and cures chronic fatigue."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🥗 EFSA Zayıflama</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Guaranteed crypto yield and 100% safe investment algorithm! Instant bad credit loans with no credit check."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>📈 MiCA Kripto & Kredi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Lowest price guaranteed and cheapest in Europe! Unconditional money-back guarantee with no questions asked refund."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🏷️ Omnibus & Fiyat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Best lawyer in Europe with 100% success rate. Guaranteed court win in cross-border tax dispute litigation."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>⚖️ CCBE Hukuk İhlali</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Packaging is manufactured from 80% recycled FSC-certified paper. Supports weight management as part of an energy-restricted diet under physician guidance."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>✅ AB Uyumlu Metin</Text>
                  </TouchableOpacity>
                </>
              ) : complianceJurisdiction === "US" ? (
                <>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Guaranteed cure for diabetes and chronic cancer with our clinically proven herbal supplement. Buy Adderall online no prescription required."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🏥 FDA Hastalık & Rx</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Lose 30 lbs in 2 weeks without diet or exercise! Fast fat burner guaranteed results for belly fat."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🥗 FTC/FDA Kilo Verme</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Buy 500 real 5-star Google and Yelp reviews for your business to rank number one guaranteed. Claim your free trial with automatic monthly renewal billing."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>⭐ FTC Sahte Yorum</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Guaranteed crypto yield and 100% risk-free return on automated Bitcoin algorithmic bot trading! Guaranteed approval payday loans with no credit check."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>💳 SEC Kripto & Kredi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Our apparel is 100% eco-friendly, completely green, and certified carbon neutral through offset credits."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🌿 FTC Green Guides</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Best trial lawyer in California with 100% success rate. Guaranteed court win in federal criminal defense litigation."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>⚖️ ABA Avukatlık Garantisi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Buy cheap vapes and puff bars online with free USPS shipping anywhere in the USA."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🚬 PACT Act Tütün</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease. Consult your physician before starting any diet program."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>✅ FTC/FDA Uyumlu Metin</Text>
                  </TouchableOpacity>
                </>
              ) : complianceJurisdiction === "UK" ? (
                <>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Cheap botox injections and botulinum toxin treatments at our London clinic! Best botox prices in the UK."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>💉 ASA Botox & POM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Our herbal tincture cures cancer and provides a 100% guaranteed cure for arthritis. Guaranteed slimming formula."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🏥 ASA Tedavi İddiası</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Guaranteed crypto returns with zero risk cryptocurrency investment! Refer a friend get £50 crypto bonus."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🪙 FCA Kripto Promosyon</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Our apparel is 100% eco-friendly and zero carbon product, completely green choice across the UK."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🌿 CMA Green Claims</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Only 1 left in stock! Offer expires in 5 minutes hurry countdown timer running out. Best price guaranteed in the UK."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>⏱️ DMCC Sahte Kıtlık</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Cheap disposable vapes and elf bar sale with nicotine vapes online for fast home delivery."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🚭 ASA Vaping Yasağı</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Consult our GMC-registered doctors for facial aesthetic consultations. Certified organic skincare supporting hydration. Capital at risk for investments."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>✅ UK Uyumlu Metin</Text>
                  </TouchableOpacity>
                </>
              ) : complianceJurisdiction === "ASIA" ? (
                <>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "ガンが治る! Miracle anti-aging cream that cures cancer and permanently removes wrinkles. 若返り効果100%!"
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🏥 PMDA Tıbbi İddia</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Buy Ozempic and Wegovy online without doctor prescription. 処方箋なしで買えるオゼンピック, free courier shipping across Tokyo and Singapore."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>💊 PMDA/HSA Reçeteli İlaç</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "ステマ代行 service: buy 500 fake 5-star reviews on Douyin and Xiaohongshu without disclosing #PR or 뒷광고."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>⭐ JCAA/KFTC Gizli Reklam</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "China's absolute best national level product (国家级 / 最高级 / 第一品牌) with guaranteed number one quality!"
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🏆 SAMR Süperlatif</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Lose 15 kg in 2 weeks without diet or exercise! 飲むだけで激痩せ miracle slimming tea, effortless fat burning."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🥗 MHLW Zayıflama</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Guaranteed crypto yield and 100% risk-free algorithmic trading return in Singapore! 審査なし即日融資 with no credit check."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>💳 MAS Kripto & Kredi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "100% eco-friendly and guaranteed carbon neutral product. 環境負荷ゼロ certified sustainable."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🌿 CCCS Yeşil İddia</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "Buy cheap disposable vapes and puff bars online with fast delivery to Singapore. Trusted online casino slot baccarat."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🚭 Vape & Kumar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "This moisturizing lotion hydrates dry skin. #PR Sponsored review conducted under JCAA guidelines. All medical queries should be directed to licensed clinics."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>✅ Asya Uyumlu</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "اشترِ أفضل نبيذ ومشروبات كحولية أونلاين في الرياض! كازينو أونلاين وقمار مباشر في دبي بأرباح فورية ومضمونة."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🍷 Alkol & Kumar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "علاج نهائي لمرض السرطان والسكري بنسبة 100% بدون جراحة! اشترِ أوزيمبيك وفاليوم بدون وصفة طبية دبي."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🏥 SFDA Sağlık & İlaç</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "جرّب هذا المنتج السحري المفضل لدي شخصياً، اطلبه الآن قبل نفاد الكمية! #تجارب #جمال (بدون ترخيص موثوق وبدون وسم إعلان)."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>📱 Mawthooq / Fenomen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "استثمر في الكريبتو واحصل على أرباح مضمونة 100% خالية من المخاطر! تداول العملات الرقمية بدون ترخيص في دبي."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🪙 VARA/SAMA Finans</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "شقق وفلل فاخرة للبيع بالتقسيط في الرياض بدون وسيط وبدون ترخيص فال العقاري. فرصة استثمارية حصرية."
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>🏘️ Fal / RERA Emlak</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.presetChip}
                    onPress={() =>
                      setComplianceDraft(
                        "عيادة تجميل مرخصة من وزارة الصحة، استشارات طبية معتمدة من استشاريين مرخصين. مرخص من هيئة الصحة بدبي. #إعلان #ترخيص_موثوق"
                      )
                    }
                  >
                    <Text style={styles.presetChipText}>✅ MENA Uyumlu</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>

            {/* Sector Filters */}
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Sektör Filtresi</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetScroll}>
              {complianceJurisdiction === "TR"
                ? [
                    { id: "ALL", label: "Tüm Sektörler" },
                    { id: "HEALTH_MEDICAL", label: "Sağlık & Klinik" },
                    { id: "FOOD_SUPPLEMENT", label: "Gıda & Zayıflama" },
                    { id: "LEGAL_SERVICES", label: "Hukuk & Avukat" },
                    { id: "FINANCIAL_SERVICES", label: "Finans & Kredi" },
                    { id: "SUPERLATIVE_COMMERCIAL", label: "E-Ticaret & Fiyat" },
                    { id: "ILLEGAL_BETTING_TOBACCO", label: "Bahis & Tütün" },
                  ].map((s) => {
                    const isAct = complianceSector === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.typeChip, isAct && styles.typeChipActive]}
                        onPress={() => setComplianceSector(s.id as any)}
                      >
                        <Text style={[styles.typeChipText, isAct && styles.typeChipTextActive]}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                : complianceJurisdiction === "EU"
                ? [
                    { id: "ALL", label: "Tüm AB Sektörleri" },
                    { id: "GREEN_CLAIMS", label: "🌿 Green Claims & EmpCo" },
                    { id: "HEALTH_PHARMA", label: "🏥 Sağlık & POM" },
                    { id: "FOOD_SUPPLEMENT", label: "🥗 EFSA Gıda & Diyet" },
                    { id: "FINANCIAL_SERVICES", label: "💳 MiCA Finans & Kripto" },
                    { id: "CONSUMER_ECOMMERCE", label: "🛒 Omnibus & E-Ticaret" },
                    { id: "LEGAL_SERVICES", label: "⚖️ CCBE Hukuk" },
                    { id: "TOBACCO_NICOTINE", label: "🚬 TPD Tütün & Vape" },
                  ].map((s) => {
                    const isAct = euComplianceSector === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.typeChip, isAct && styles.typeChipActive]}
                        onPress={() => setEuComplianceSector(s.id as any)}
                      >
                        <Text style={[styles.typeChipText, isAct && styles.typeChipTextActive]}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                : complianceJurisdiction === "US"
                ? [
                    { id: "ALL", label: "Tüm ABD Sektörleri" },
                    { id: "HEALTH_FDA", label: "🏥 FDA Sağlık & İlaç" },
                    { id: "SUPPLEMENTS_WEIGHTLOSS", label: "🥗 DSHEA & Kilo Verme" },
                    { id: "FTC_COMMERCIAL_DECEPTIVE", label: "⭐ FTC Sahte Yorum" },
                    { id: "FINANCIAL_SEC_CFPB", label: "💳 SEC Finans & Kredi" },
                    { id: "GREEN_GUIDES_FTC", label: "🌿 EPA Green Guides" },
                    { id: "LEGAL_ABA", label: "⚖️ ABA Hukuk" },
                    { id: "TOBACCO_PACT", label: "🚬 PACT Act Tütün" },
                  ].map((s) => {
                    const isAct = usComplianceSector === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.typeChip, isAct && styles.typeChipActive]}
                        onPress={() => setUsComplianceSector(s.id as any)}
                      >
                        <Text style={[styles.typeChipText, isAct && styles.typeChipTextActive]}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                : complianceJurisdiction === "UK"
                ? [
                    { id: "ALL", label: "Tüm UK Sektörleri" },
                    { id: "HEALTH_ASA_CAP", label: "💉 ASA Botox & POM" },
                    { id: "FINANCIAL_FCA", label: "🪙 FCA Kripto & Finans" },
                    { id: "GREEN_CLAIMS_CMA", label: "🌿 CMA Yeşil İddia" },
                    { id: "CONSUMER_CMA_ASA", label: "⏱️ DMCC Sahte Kıtlık" },
                    { id: "VAPING_TOBACCO_ASA", label: "🚭 ASA Vaping Yasağı" },
                  ].map((s) => {
                    const isAct = ukComplianceSector === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.typeChip, isAct && styles.typeChipActive]}
                        onPress={() => setUkComplianceSector(s.id as any)}
                      >
                        <Text style={[styles.typeChipText, isAct && styles.typeChipTextActive]}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                : complianceJurisdiction === "ASIA"
                ? [
                    { id: "ALL", label: "Tüm Asya Sektörleri" },
                    { id: "COSMETICS_HEALTH_PMDA", label: "🏥 PMDA Sağlık & Kozmetik" },
                    { id: "STEALTH_MARKETING_JCAA_KFTC", label: "⭐ JCAA/KFTC Gizli Reklam" },
                    { id: "ABSOLUTE_SUPERLATIVES_SAMR", label: "🏆 SAMR Süperlatif Yasağı" },
                    { id: "DIETARY_SUPPLEMENTS_WEIGHTLOSS", label: "🥗 MHLW Zayıflama & Gıda" },
                    { id: "FINANCIAL_CRYPTO_MAS", label: "💳 MAS Kripto & Kredi" },
                    { id: "GREEN_CLAIMS_APAC", label: "🌿 CCCS Yeşil İddialar" },
                    { id: "VAPING_GAMBLING_BAN_APAC", label: "🚭 Vape & Kumar Yasağı" },
                  ].map((s) => {
                    const isAct = asiaComplianceSector === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.typeChip, isAct && styles.typeChipActive]}
                        onPress={() => setAsiaComplianceSector(s.id as any)}
                      >
                        <Text style={[styles.typeChipText, isAct && styles.typeChipTextActive]}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                : [
                    { id: "ALL", label: "Tüm Körfez Sektörleri" },
                    { id: "ISLAMIC_VALUES_PUBLIC_MORALS", label: "🕌 Kamu Ahlakı & Değerler" },
                    { id: "HEALTH_MEDICAL_MOHAP_SFDA", label: "🏥 SFDA/MOHAP Sağlık" },
                    { id: "INFLUENCER_MAWTHOOQ_NMC", label: "📱 Mawthooq / NMC Reklam" },
                    { id: "FINANCIAL_CRYPTO_VARA_SAMA", label: "🪙 VARA / SAMA Finans" },
                    { id: "ECOMMERCE_REAL_ESTATE_FAL", label: "🏘️ Fal / RERA Emlak & Ticaret" },
                    { id: "VAPING_TOBACCO_BAN_MENA", label: "🚭 Tütün & Vaping Yasağı" },
                  ].map((s) => {
                    const isAct = menaComplianceSector === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.typeChip, isAct && styles.typeChipActive]}
                        onPress={() => setMenaComplianceSector(s.id as any)}
                      >
                        <Text style={[styles.typeChipText, isAct && styles.typeChipTextActive]}>
                          {s.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
            </ScrollView>

            {/* Editor Input Card */}
            <GlassCard style={[styles.inputCard, { marginTop: 12 }]}>
              <View style={styles.secHeader}>
                <Text style={styles.cardTitle}>Denetlenecek Metin Taslağı</Text>
                {complianceDraft.length > 0 && (
                  <TouchableOpacity onPress={() => setComplianceDraft("")}>
                    <Text style={styles.clearText}>Temizle</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={[styles.textInput, styles.draftInput]}
                placeholder="Web sitenizde veya reklamlarınızda yayınlanacak metni buraya yapıştırın..."
                placeholderTextColor={Colors.textMuted}
                value={complianceDraft}
                onChangeText={setComplianceDraft}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              <View style={styles.draftStatsRow}>
                <Text style={styles.draftStatsText}>
                  {complianceDraft.trim() ? complianceDraft.trim().split(/\s+/).length : 0} kelime • {complianceDraft.length} karakter
                </Text>
              </View>
            </GlassCard>

            {/* Scan Status Summary */}
            {complianceViolations.length === 0 ? (
              <GlassCard style={styles.cleanStatusCard}>
                <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.cleanStatusTitle}>Mevzuata Tam Uyumlu</Text>
                  <Text style={styles.cleanStatusDesc}>
                    {complianceJurisdiction === "TR"
                      ? "Metninizde Türkiye Reklam Kurulu, TİTCK veya TBB mevzuatınca yasaklanmış herhangi bir kural ihlali bulunamadı."
                      : complianceJurisdiction === "EU"
                      ? "Metninizde Avrupa Birliği Direktifleri (EmpCo, EFSA, MiCA, Omnibus) tarafından yasaklanmış herhangi bir kural ihlali bulunamadı."
                      : complianceJurisdiction === "US"
                      ? "Metninizde ABD federal mevzuatı (FTC, FDA, SEC, CFPB, EPA) tarafından yasaklanmış herhangi bir kural ihlali bulunamadı."
                      : complianceJurisdiction === "UK"
                      ? "Metninizde Birleşik Krallık mevzuatı (ASA CAP Code, CMA Green Claims, DMCC Act, FCA) tarafından yasaklanmış herhangi bir kural ihlali bulunamadı."
                      : complianceJurisdiction === "ASIA"
                      ? "Metninizde Asya & Pasifik mevzuatı (PMDA, JCAA, SAMR, MAS, KFTC) tarafından yasaklanmış herhangi bir kural ihlali bulunamadı."
                      : "Metninizde BAE Ulusal Medya Konseyi (NMC), Suudi SFDA/GCAM veya VARA tarafından yasaklanmış herhangi bir kural ihlali bulunamadı."}
                  </Text>
                </View>
              </GlassCard>
            ) : (
              <GlassCard style={styles.violationSummaryCard}>
                <Ionicons name="alert-circle" size={24} color={Colors.danger} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.violationSummaryTitle}>
                    {complianceViolations.length} Adet Mevzuat İhlali Tespit Edildi!
                  </Text>
                  <Text style={styles.violationSummaryDesc}>
                    {complianceJurisdiction === "TR"
                      ? "Aşağıdaki ifadeler reklam ve içerik mevzuatına aykırıdır; idari para cezası ve içerik engeli riski taşır."
                      : complianceJurisdiction === "EU"
                      ? "Aşağıdaki ifadeler Avrupa Birliği tüketici, sağlık ve yeşil dönüşüm direktiflerine aykırıdır; yüksek idari para cezaları riski taşır."
                      : complianceJurisdiction === "US"
                      ? "Aşağıdaki ifadeler ABD federal mevzuatına (FTC Act, FD&C Act, SEC Rule 10b-5) aykırıdır; ihlal başına 51.744 $'a varan federal cezalar riski taşır."
                      : complianceJurisdiction === "UK"
                      ? "Aşağıdaki ifadeler Birleşik Krallık mevzuatına (ASA CAP Code, DMCC Act %10 ciro cezası, FCA Kripto) aykırıdır; ağır cezai yaptırımlar riski taşır."
                      : complianceJurisdiction === "ASIA"
                      ? "Aşağıdaki ifadeler Asya mevzuatına (Japonya PMD Act/Keihyo-ho, Çin SAMR Reklam Kanunu, Singapur MAS/HSA) aykırıdır; ağır ciro kesintileri ve cezai yaptırımlar riski taşır."
                      : "Aşağıdaki ifadeler Körfez/MENA mevzuatına (BAE NMC, Suudi SFDA/GCAM, Dubai VARA) aykırıdır; 1.000.000 AED/SAR ve 10.000.000 AED'ye varan ağır para cezaları ve lisans iptali riski taşır."}
                  </Text>
                </View>
              </GlassCard>
            )}

            {/* Violation List Cards */}
            {complianceViolations.map((v, i) => (
              <GlassCard key={i} style={styles.violationItemCard}>
                <View style={styles.violationCardHeader}>
                  <View style={styles.sectorBadge}>
                    <Text style={styles.sectorBadgeText}>{formatSectorBadge(v.sector)}</Text>
                  </View>
                  <View
                    style={[
                      styles.riskBadge,
                      v.severity === "CRITICAL"
                        ? styles.riskBadgeCritical
                        : v.severity === "HIGH"
                        ? styles.riskBadgeHigh
                        : styles.riskBadgeMedium,
                    ]}
                  >
                    <Text style={styles.riskBadgeText}>
                      {v.severity === "CRITICAL" ? "AĞIR RİSK" : v.severity === "HIGH" ? "YÜKSEK RİSK" : "ORTA RİSK"}
                    </Text>
                  </View>
                </View>

                {/* Prohibited Term */}
                <View style={styles.termBox}>
                  <Text style={styles.termLabel}>Yasaklı İfade:</Text>
                  <Text style={styles.termValue}>"{v.matched_term || v.matched_pattern}"</Text>
                </View>

                {/* Explanation */}
                <Text style={styles.violExplanation}>{v.explanation || v.title}</Text>

                {/* Law Reference & Fine Risk */}
                <View style={styles.legalInfoBox}>
                  <View style={styles.legalInfoRow}>
                    <Ionicons name="book-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.legalInfoText}>Mevzuat: {v.legal_reference || v.legal_basis}</Text>
                  </View>
                  <View style={styles.legalInfoRow}>
                    <Ionicons name="warning-outline" size={13} color={Colors.danger} />
                    <Text style={[styles.legalInfoText, { color: Colors.danger }]}>
                      Yaptırım: {v.fine_risk || v.penalty_risk}
                    </Text>
                  </View>
                </View>

                {/* Suggested Replacement */}
                {(v.suggested_replacement || v.suggested_fix) && (
                  <View style={styles.replacementRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.replLabel}>Önerilen Güvenli Alternatif:</Text>
                      <Text style={styles.replValue}>"{v.suggested_replacement || v.suggested_fix}"</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.fixBtn}
                      onPress={() => handleFixViolation(v)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="sparkles" size={13} color="#FFFFFF" />
                      <Text style={styles.fixBtnText}>Metinde Düzelt</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </GlassCard>
            ))}
          </>
        )}
        {/* TAB 1: OPTIMIZER */}
        {activeTabSub === "OPTIMIZER" && (
          <>
            {/* Input Card */}
            <GlassCard style={styles.inputCard}>
              <Text style={styles.cardTitle}>URL & Hedef Kelime Denetimi</Text>
              
              <Text style={styles.fieldLabel}>Sayfa URL Adresi</Text>
              <TextInput
                style={styles.textInput}
                placeholder="https://siteniz.com/sayfa"
                placeholderTextColor={Colors.textMuted}
                value={urlInput}
                onChangeText={setUrlInput}
                autoCapitalize="none"
              />

              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Hedef Anahtar Kelime</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: organik seo uzmanı"
                placeholderTextColor={Colors.textMuted}
                value={targetKw}
                onChangeText={setTargetKw}
              />

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleAnalyze}
                disabled={analyzing || !urlInput.trim()}
                activeOpacity={0.8}
              >
                {analyzing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="flash" size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>İçeriği Analiz Et</Text>
                  </>
                )}
              </TouchableOpacity>
            </GlassCard>

            {/* Analysis Results */}
            {optResult && (
              <>
                {/* Score Grid */}
                <View style={styles.scoresGrid}>
                  <GlassCard style={styles.scoreBox}>
                    <Text style={styles.scoreNum}>{optResult.content_score}</Text>
                    <Text style={styles.scoreLbl}>İçerik Skoru</Text>
                  </GlassCard>
                  <GlassCard style={styles.scoreBox}>
                    <Text style={[styles.scoreNum, { color: Colors.accent }]}>{optResult.geo_score}</Text>
                    <Text style={styles.scoreLbl}>GEO Skoru</Text>
                  </GlassCard>
                  <GlassCard style={styles.scoreBox}>
                    <Text style={[styles.scoreNum, { color: Colors.success }]}>{optResult.readability_score}</Text>
                    <Text style={styles.scoreLbl}>Okunabilirlik</Text>
                  </GlassCard>
                  <GlassCard style={styles.scoreBox}>
                    <Text style={styles.scoreNum}>{optResult.word_count}</Text>
                    <Text style={styles.scoreLbl}>Kelime Sayısı</Text>
                  </GlassCard>
                </View>

                {/* Missing Entities */}
                <GlassCard style={styles.sectionCard}>
                  <View style={styles.secHeader}>
                    <Ionicons name="cube-outline" size={16} color={Colors.warning} />
                    <Text style={styles.secTitle}>Eksik Entity & Konu Kapsamı</Text>
                  </View>
                  <View style={styles.tagsWrap}>
                    {optResult.missing_entities.map((ent, i) => (
                      <View key={i} style={styles.tagItem}>
                        <Text style={styles.tagText}>{ent}</Text>
                      </View>
                    ))}
                  </View>
                </GlassCard>

                {/* Missing Headings */}
                <GlassCard style={styles.sectionCard}>
                  <View style={styles.secHeader}>
                    <Ionicons name="list-outline" size={16} color={Colors.info} />
                    <Text style={styles.secTitle}>Önerilen Başlık Hiyerarşisi</Text>
                  </View>
                  {optResult.missing_headings.map((h, i) => (
                    <View key={i} style={styles.headingItem}>
                      <Ionicons name="add-circle-outline" size={14} color={Colors.info} />
                      <Text style={styles.headingText}>{h}</Text>
                    </View>
                  ))}
                </GlassCard>

                {/* AI Suggestions */}
                <GlassCard style={styles.sectionCard}>
                  <View style={styles.secHeader}>
                    <Ionicons name="sparkles" size={16} color={Colors.primary} />
                    <Text style={styles.secTitle}>AI İyileştirme Önerileri</Text>
                  </View>
                  {optResult.ai_suggestions.map((sug, i) => (
                    <View key={i} style={styles.sugItem}>
                      <Text style={styles.sugBullet}>•</Text>
                      <Text style={styles.sugText}>{sug}</Text>
                    </View>
                  ))}
                </GlassCard>
              </>
            )}
          </>
        )}

        {/* TAB 2: AI GENERATOR */}
        {activeTabSub === "GENERATOR" && (
          <>
            {/* Format Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeScroll}>
              {[
                { id: "META_TITLE", label: "Meta Başlık" },
                { id: "META_DESCRIPTION", label: "Meta Açıklaması" },
                { id: "FAQ", label: "FAQ Schema" },
                { id: "BLOG_OUTLINE", label: "Blog Taslağı" }
              ].map((t) => {
                const isActive = genType === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.typeChip, isActive && styles.typeChipActive]}
                    onPress={() => setGenType(t.id as any)}
                  >
                    <Text style={[styles.typeChipText, isActive && styles.typeChipTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Generator Form */}
            <GlassCard style={styles.inputCard}>
              <Text style={styles.fieldLabel}>Konu / Başlık</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: E-Ticaret Dönüşüm Oranı Artırma"
                placeholderTextColor={Colors.textMuted}
                value={topicInput}
                onChangeText={setTopicInput}
              />

              <Text style={[styles.fieldLabel, { marginTop: 10 }]}>Hedef Anahtar Kelime</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Örn: e-ticaret seo ipuçları"
                placeholderTextColor={Colors.textMuted}
                value={genTargetKw}
                onChangeText={setGenTargetKw}
              />

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleGenerate}
                disabled={generating || !topicInput.trim()}
                activeOpacity={0.8}
              >
                {generating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>AI ile İçerik Üret</Text>
                  </>
                )}
              </TouchableOpacity>
            </GlassCard>

            {/* Generated Output */}
            {genResult && (
              <GlassCard style={styles.outputCard}>
                <View style={styles.outputHeader}>
                  <View>
                    <Text style={styles.outputTitle}>{genResult.title}</Text>
                    <Text style={styles.outputTokens}>{genResult.tokens_used} AI Token Kullanıldı</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={() => handleShareResult(genResult.content)}
                  >
                    <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.contentBox}>
                  <Text style={styles.contentText}>{genResult.content}</Text>
                </View>

                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => {
                    handleShareResult(genResult.content);
                    Alert.alert("Hazır", "İçerik panoya kopyalanmaya hazır.");
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="copy-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.copyBtnText}>İçeriği Kopyala / Paylaş</Text>
                </TouchableOpacity>
              </GlassCard>
            )}
          </>
        )}
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
  tabRow: {
    flexDirection: "row",
    padding: 12,
    gap: 10,
    backgroundColor: Colors.surface,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  tabBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  inputCard: {
    padding: 16,
    borderRadius: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 11 : 8,
    color: Colors.textPrimary,
    fontSize: 13,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  scoresGrid: {
    flexDirection: "row",
    gap: 8,
  },
  scoreBox: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  scoreNum: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.primary,
  },
  scoreLbl: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: "center",
  },
  sectionCard: {
    padding: 16,
    borderRadius: 16,
    gap: 10,
  },
  secHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  secTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagItem: {
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.25)",
  },
  tagText: {
    fontSize: 11,
    color: Colors.warning,
    fontWeight: "600",
  },
  headingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headingText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sugItem: {
    flexDirection: "row",
    gap: 8,
  },
  sugBullet: {
    color: Colors.primary,
    fontSize: 14,
    lineHeight: 18,
  },
  sugText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  typeScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  typeChip: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  typeChipActive: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderColor: Colors.primary,
  },
  typeChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  typeChipTextActive: {
    color: Colors.primary,
  },
  outputCard: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  outputHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  outputTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  outputTokens: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  shareBtn: {
    padding: 6,
  },
  contentBox: {
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  contentText: {
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 20,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  copyBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  jurisdictionToggleRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  jurisdictionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  jurisdictionBtnActive: {
    backgroundColor: Colors.primary,
  },
  jurisdictionFlag: {
    fontSize: 14,
  },
  jurisdictionBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  jurisdictionBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  complianceIntroCard: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  complianceIntroTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  complianceIntroText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: 6,
  },
  presetScroll: {
    gap: 8,
    paddingBottom: 4,
    marginTop: 6,
  },
  presetChip: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  presetChipText: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: "500",
  },
  clearText: {
    fontSize: 12,
    color: Colors.textMuted,
    textDecorationLine: "underline",
  },
  draftInput: {
    minHeight: 100,
    fontSize: 13,
    lineHeight: 20,
    textAlignVertical: "top",
  },
  draftStatsRow: {
    alignItems: "flex-end",
    marginTop: 6,
  },
  draftStatsText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  cleanStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 6,
  },
  cleanStatusTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.success,
  },
  cleanStatusDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  violationSummaryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 6,
  },
  violationSummaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.danger,
  },
  violationSummaryDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  violationItemCard: {
    padding: 14,
    borderRadius: 14,
    marginTop: 10,
    gap: 10,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  violationCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectorBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  sectorBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  riskBadgeCritical: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  riskBadgeHigh: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
  },
  riskBadgeMedium: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  riskBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: Colors.danger,
  },
  termBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  termLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  termValue: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.danger,
  },
  violExplanation: {
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  legalInfoBox: {
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  legalInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legalInfoText: {
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
  },
  replacementRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    padding: 10,
    borderRadius: 10,
    gap: 8,
    marginTop: 4,
  },
  replLabel: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  replValue: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.success,
  },
  fixBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  fixBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
