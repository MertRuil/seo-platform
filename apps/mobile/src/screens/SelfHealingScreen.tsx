import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";
import { fetchChangeSets, executeSelfHeal, rollbackChangeSet } from "../services/api";
import { ChangeSetItem, SelfHealRequest } from "../types";

export const SelfHealingScreen: React.FC = () => {
  const { selectedSite } = useApp();
  const [activeSegment, setActiveSegment] = useState<"ISSUES" | "CHANGES" | "SECURITY">("ISSUES");

  const [changeSets, setChangeSets] = useState<ChangeSetItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [healingId, setHealingId] = useState<string | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Fixable Issues List
  const FIXABLE_ISSUES = [
    {
      id: "fix-can-1",
      title: "Parametreli Filtre Sayfalarında Canonical Eksikliği",
      category: "CANONICAL",
      risk_level: "LOW" as const,
      impact: "+14 Puan Sağlık",
      target_url: "/kategori/elektronik?sort=price",
      operation: "UPDATE_CANONICAL",
      state_before: '<link rel="canonical" href="/kategori/elektronik?sort=price" />',
      state_after: '<link rel="canonical" href="https://acmestore.io/kategori/elektronik" />',
      hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      id: "fix-schema-1",
      title: "Hakkımızda Sayfasında Organization Schema Yokluğu",
      category: "SCHEMA",
      risk_level: "LOW" as const,
      impact: "+22 Puan GEO Otoritesi",
      target_url: "/hakkimizda",
      operation: "INJECT_JSON_LD",
      state_before: "<!-- No Organization Schema -->",
      state_after: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme","url":"https://acmestore.io"}</script>',
      hash: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
    },
    {
      id: "fix-faq-1",
      title: "Ürün Sayfasında Sıkça Sorulan Sorular (FAQ) Eksikliği",
      category: "AEO_CONTENT",
      risk_level: "LOW" as const,
      impact: "+18 Puan AI Atıf",
      target_url: "/urun/akilli-saat",
      operation: "INJECT_JSON_LD",
      state_before: "<!-- Missing FAQ Schema -->",
      state_after: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Garanti süresi nedir?","acceptedAnswer":{"@type":"Answer","text":"2 yıl resmi distribütör garantilidir."}}]}</script>',
      hash: "7d8f9a0c1b2e3d4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f"
    },
    {
      id: "fix-redirect-1",
      title: "Eski Kampanya Sayfasında 404 Kırık Bağlantı",
      category: "REDIRECT",
      risk_level: "MEDIUM" as const,
      impact: "+8 Puan İndekslenebilirlik",
      target_url: "/kampanya-2025",
      operation: "ADD_301_REDIRECT",
      state_before: "Status: 404 Not Found",
      state_after: "Status: 301 Moved Permanently -> /kampanyalar",
      hash: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b"
    }
  ];

  useEffect(() => {
    loadChangeSets();
  }, [selectedSite?.id]);

  const loadChangeSets = async () => {
    setLoading(true);
    try {
      const data = await fetchChangeSets(selectedSite?.id || "site-1");
      setChangeSets(data);
    } finally {
      setLoading(false);
    }
  };

  const handleSelfHeal = async (issue: typeof FIXABLE_ISSUES[0]) => {
    setHealingId(issue.id);
    setStatusMsg(null);
    try {
      const req: SelfHealRequest = {
        issue_id: issue.id,
        issue_title: issue.title,
        target_url: issue.target_url,
        category: issue.category,
        operation: issue.operation,
        state_before: issue.state_before,
        state_after: issue.state_after,
        expected_hash_before: issue.hash,
        risk_level: issue.risk_level,
        auto_execute: true
      };

      const res = await executeSelfHeal(selectedSite?.id || "site-1", req);
      if (res && res.success) {
        setStatusMsg({
          text: `⚡ "${issue.title}" otonom olarak düzeltildi ve canlıya uygulandı.`,
          type: "success"
        });
        await loadChangeSets();
      }
    } catch (err: any) {
      setStatusMsg({
        text: err?.message || "Otonom düzeltme uygulanırken bir hata oluştu.",
        type: "error"
      });
    } finally {
      setHealingId(null);
    }
  };

  const handleRollback = async (csId: string) => {
    setRollingBackId(csId);
    setStatusMsg(null);
    try {
      const res = await rollbackChangeSet(selectedSite?.id || "site-1", csId);
      if (res && res.success) {
        setStatusMsg({
          text: `⏪ ChangeSet #${csId} atomik olarak geri alındı (Rollback tamamlandı).`,
          type: "success"
        });
        await loadChangeSets();
      }
    } catch (err: any) {
      setStatusMsg({
        text: err?.message || "Geri alma işlemi sırasında bir hata oluştu.",
        type: "error"
      });
    } finally {
      setRollingBackId(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconRing}>
            <Ionicons name="shield-checkmark" size={18} color="#6366F1" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Otonom Düzeltme & Rollback</Text>
            <Text style={styles.headerSub}>Self-Healing Engine & Atomik Kalkan</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={loadChangeSets}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Segment Selector */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "ISSUES" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("ISSUES")}
        >
          <Text style={[styles.segmentText, activeSegment === "ISSUES" && styles.segmentTextActive]}>
            Onarılabilir Sorunlar ({FIXABLE_ISSUES.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "CHANGES" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("CHANGES")}
        >
          <Text style={[styles.segmentText, activeSegment === "CHANGES" && styles.segmentTextActive]}>
            Değişiklik Setleri ({changeSets.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, activeSegment === "SECURITY" && styles.segmentBtnActive]}
          onPress={() => setActiveSegment("SECURITY")}
        >
          <Text style={[styles.segmentText, activeSegment === "SECURITY" && styles.segmentTextActive]}>
            Sandbox Kalkanı
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Status Toast */}
        {statusMsg && (
          <View
            style={[
              styles.toastBanner,
              {
                backgroundColor:
                  statusMsg.type === "success"
                    ? "rgba(16, 185, 129, 0.15)"
                    : "rgba(239, 68, 68, 0.15)",
                borderColor:
                  statusMsg.type === "success"
                    ? "rgba(16, 185, 129, 0.35)"
                    : "rgba(239, 68, 68, 0.35)"
              }
            ]}
          >
            <Ionicons
              name={statusMsg.type === "success" ? "checkmark-circle" : "alert-circle"}
              size={18}
              color={statusMsg.type === "success" ? "#10B981" : "#EF4444"}
            />
            <Text
              style={[
                styles.toastText,
                { color: statusMsg.type === "success" ? "#34D399" : "#F87171" }
              ]}
            >
              {statusMsg.text}
            </Text>
          </View>
        )}

        {/* SEGMENT 1: FIXABLE ISSUES */}
        {activeSegment === "ISSUES" && (
          <>
            {/* Top Overview Card */}
            <LinearGradient colors={["#312E81", "#0F172A"]} style={styles.bannerCard}>
              <View style={styles.bannerTop}>
                <View>
                  <Text style={styles.bannerBadge}>SIFIR MÜDAHALE OTONOM DÜZELTME</Text>
                  <Text style={styles.bannerTitle}>Yapay Zeka Destekli Anında Onarım</Text>
                  <Text style={styles.bannerDesc}>
                    Tespit edilen teknik ve şema hatalarını kod tabanına veya CMS'e dokunmadan güvenli Sandbox ortamında simüle edip canlıya uygulayın.
                  </Text>
                </View>
              </View>

              <View style={styles.bannerFeatures}>
                <View style={styles.bFeatItem}>
                  <Ionicons name="finger-print" size={14} color="#A5B4FC" />
                  <Text style={styles.bFeatText}>SHA-256 Hash Doğrulama</Text>
                </View>
                <View style={styles.bFeatItem}>
                  <Ionicons name="return-up-back" size={14} color="#A5B4FC" />
                  <Text style={styles.bFeatText}>1-Tıkla Rollback Koruması</Text>
                </View>
                <View style={styles.bFeatItem}>
                  <Ionicons name="git-branch" size={14} color="#A5B4FC" />
                  <Text style={styles.bFeatText}>İyimser Eşzamanlılık (OCC)</Text>
                </View>
              </View>
            </LinearGradient>

            <Text style={styles.sectionHeader}>Onarıma Hazır SEO & AEO Sorunları</Text>

            {FIXABLE_ISSUES.map((issue) => {
              const isHealing = healingId === issue.id;

              return (
                <GlassCard key={issue.id} style={styles.issueCard}>
                  <View style={styles.issueHeader}>
                    <View style={styles.issueCategoryPill}>
                      <Text style={styles.issueCategoryText}>{issue.category}</Text>
                    </View>

                    <View
                      style={[
                        styles.riskBadge,
                        {
                          backgroundColor:
                            issue.risk_level === "LOW"
                              ? "rgba(16, 185, 129, 0.15)"
                              : "rgba(245, 158, 11, 0.15)",
                          borderColor:
                            issue.risk_level === "LOW"
                              ? "rgba(16, 185, 129, 0.3)"
                              : "rgba(245, 158, 11, 0.3)"
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.riskBadgeText,
                          {
                            color:
                              issue.risk_level === "LOW" ? "#10B981" : "#F59E0B"
                          }
                        ]}
                      >
                        {issue.risk_level === "LOW" ? "DÜŞÜK RİSK (OTONOM)" : "ORTA RİSK"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.issueTitle}>{issue.title}</Text>
                  <Text style={styles.issueUrl}>Hedef: {issue.target_url}</Text>

                  <View style={styles.impactRow}>
                    <Ionicons name="trending-up" size={14} color="#10B981" />
                    <Text style={styles.impactText}>Tahmini Etki: {issue.impact}</Text>
                  </View>

                  {/* Diff Snippet Preview */}
                  <View style={styles.diffPreview}>
                    <View style={styles.diffLineBefore}>
                      <Text style={styles.diffPrefix}>-</Text>
                      <Text style={styles.diffTextBefore} numberOfLines={1}>
                        {issue.state_before}
                      </Text>
                    </View>
                    <View style={styles.diffLineAfter}>
                      <Text style={styles.diffPrefix}>+</Text>
                      <Text style={styles.diffTextAfter} numberOfLines={1}>
                        {issue.state_after}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.healBtn}
                    onPress={() => handleSelfHeal(issue)}
                    disabled={isHealing}
                    activeOpacity={0.8}
                  >
                    {isHealing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="flash" size={15} color="#FFFFFF" />
                        <Text style={styles.healBtnText}>⚡ Otonom Düzelt (Self-Heal)</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </GlassCard>
              );
            })}
          </>
        )}

        {/* SEGMENT 2: CHANGESETS & DIFF */}
        {activeSegment === "CHANGES" && (
          <>
            <View style={styles.changesHeaderRow}>
              <Text style={styles.sectionHeader}>Geçmiş Değişiklik Kümeleri</Text>
              <Text style={styles.changesSub}>Rollback yapılabilir aktif kayıtlar</Text>
            </View>

            {loading ? (
              <ActivityIndicator size="small" color="#6366F1" style={{ marginVertical: 20 }} />
            ) : changeSets.length === 0 ? (
              <GlassCard style={styles.emptyCard}>
                <Ionicons name="document-text-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>Henüz Değişiklik Seti Bulunmuyor</Text>
                <Text style={styles.emptyDesc}>
                  Onarılabilir sorunlar sekmesinden bir düzeltme başlatın.
                </Text>
              </GlassCard>
            ) : (
              changeSets.map((cs) => {
                const isExecuted = cs.status === "EXECUTED";
                const isRolledBack = cs.status === "ROLLED_BACK";
                const isRollingBack = rollingBackId === cs.id;

                return (
                  <GlassCard key={cs.id} style={styles.changeSetCard}>
                    <View style={styles.csTop}>
                      <View>
                        <Text style={styles.csIdText}>ChangeSet #{cs.id}</Text>
                        <Text style={styles.csDate}>
                          {new Date(cs.created_at).toLocaleString("tr-TR")}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: isExecuted
                              ? "rgba(16, 185, 129, 0.15)"
                              : isRolledBack
                              ? "rgba(239, 68, 68, 0.15)"
                              : "rgba(245, 158, 11, 0.15)",
                            borderColor: isExecuted
                              ? "rgba(16, 185, 129, 0.3)"
                              : isRolledBack
                              ? "rgba(239, 68, 68, 0.3)"
                              : "rgba(245, 158, 11, 0.3)"
                          }
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            {
                              color: isExecuted
                                ? "#10B981"
                                : isRolledBack
                                ? "#EF4444"
                                : "#F59E0B"
                            }
                          ]}
                        >
                          {isExecuted
                            ? "CANLIYA UYGULANDI"
                            : isRolledBack
                            ? "GERİ ALINDI (ROLLEDBACK)"
                            : "BEKLEMEDE"}
                        </Text>
                      </View>
                    </View>

                    {/* Change Items */}
                    {cs.items.map((item, idx) => (
                      <View key={idx} style={styles.itemBox}>
                        <View style={styles.itemHeader}>
                          <Text style={styles.itemOp}>{item.operation}</Text>
                          <Text style={styles.itemUrl} numberOfLines={1}>
                            {item.target_url}
                          </Text>
                        </View>

                        <View style={styles.diffBox}>
                          <View style={styles.diffLineBefore}>
                            <Text style={styles.diffPrefix}>-</Text>
                            <Text style={styles.diffTextBefore}>{item.state_before}</Text>
                          </View>
                          <View style={styles.diffLineAfter}>
                            <Text style={styles.diffPrefix}>+</Text>
                            <Text style={styles.diffTextAfter}>{item.state_after}</Text>
                          </View>
                        </View>

                        {item.expected_hash_before && (
                          <Text style={styles.hashText} numberOfLines={1}>
                            State Hash: {item.expected_hash_before}
                          </Text>
                        )}
                      </View>
                    ))}

                    {/* Rollback Action Button */}
                    {isExecuted && (
                      <TouchableOpacity
                        style={styles.rollbackBtn}
                        onPress={() => handleRollback(cs.id)}
                        disabled={isRollingBack}
                        activeOpacity={0.8}
                      >
                        {isRollingBack ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <Ionicons name="return-up-back" size={15} color="#FFFFFF" />
                            <Text style={styles.rollbackBtnText}>
                              ⏪ Atomik Olarak Geri Al (Rollback)
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </GlassCard>
                );
              })
            )}
          </>
        )}

        {/* SEGMENT 3: SANDBOX & SECURITY */}
        {activeSegment === "SECURITY" && (
          <>
            <GlassCard style={styles.securityCard}>
              <View style={styles.secIconRing}>
                <Ionicons name="lock-closed" size={24} color="#6366F1" />
              </View>
              <Text style={styles.secTitle}>SafeSiteExecutor Güvenlik Kalkanı</Text>
              <Text style={styles.secDesc}>
                Platform üzerinden yapılan her değişiklik, arama motorlarının sitenizi yanlış indekslemesini ve veri kaybını engellemek için 4 kademeli güvenlik mekanizmasıyla korunur:
              </Text>
            </GlassCard>

            {[
              {
                title: "1. İyimser Eşzamanlılık Koruması (OCC)",
                desc: "Her sayfa durumu SHA-256 kriptografik özetiyle mühürlenir. Sayfa içeriği dışarıdan değişmişse sistem çakışmayı tespit eder ve yazmayı engeller.",
                icon: "finger-print-outline"
              },
              {
                title: "2. Atomik Geri Alma (Atomic Rollback)",
                desc: "Her ChangeSet uygulandığı anda orijinal HTML/durum yedeği saklanır. İstenildiği anda tek tıkla eski haline dönülebilir.",
                icon: "arrow-undo-outline"
              },
              {
                title: "3. Sandbox Simülasyon Bağlayıcısı",
                desc: "Canlı CMS veya Cloudflare bağlantısı kurulmamış olsa dahi değişiklikler sanal test alanında çalıştırılarak doğrulanır.",
                icon: "cube-outline"
              },
              {
                title: "4. Anlık IndexNow Bildirimi",
                desc: "Düzeltilen sayfalar anında Bing ve Yandex arama motorlarına bildirilerek Googlebot ve diğer botların güncel DOM'u taraması sağlanır.",
                icon: "paper-plane-outline"
              }
            ].map((rule, idx) => (
              <GlassCard key={idx} style={styles.ruleCard}>
                <View style={styles.ruleIconBox}>
                  <Ionicons name={rule.icon as any} size={20} color="#6366F1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ruleTitle}>{rule.title}</Text>
                  <Text style={styles.ruleDesc}>{rule.desc}</Text>
                </View>
              </GlassCard>
            ))}
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconRing: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  segmentRow: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    backgroundColor: Colors.surface,
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  segmentBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
  },
  segmentText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textMuted,
    textAlign: "center",
  },
  segmentTextActive: {
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
  toastBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  toastText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  bannerCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.35)",
  },
  bannerTop: {
    marginBottom: 14,
  },
  bannerBadge: {
    fontSize: 9,
    fontWeight: "800",
    color: "#A5B4FC",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  bannerDesc: {
    fontSize: 11,
    color: "#C7D2FE",
    lineHeight: 16,
  },
  bannerFeatures: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.12)",
  },
  bFeatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  bFeatText: {
    fontSize: 10,
    color: "#E0E7FF",
    fontWeight: "600",
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  issueCard: {
    padding: 16,
    borderRadius: 16,
    gap: 10,
  },
  issueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  issueCategoryPill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  issueCategoryText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: "700",
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  riskBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  issueTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  issueUrl: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  impactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  impactText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "600",
  },
  diffPreview: {
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  diffLineBefore: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    padding: 6,
    borderRadius: 6,
  },
  diffLineAfter: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
    padding: 6,
    borderRadius: 6,
  },
  diffPrefix: {
    fontSize: 11,
    fontWeight: "800",
    color: Colors.textMuted,
  },
  diffTextBefore: {
    flex: 1,
    fontSize: 10,
    color: "#F87171",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  diffTextAfter: {
    flex: 1,
    fontSize: 10,
    color: "#34D399",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  healBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 4,
  },
  healBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  changesHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  changesSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  emptyCard: {
    padding: 30,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center",
  },
  changeSetCard: {
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  csTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  csIdText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  csDate: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  itemBox: {
    backgroundColor: Colors.surface,
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemOp: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
  itemUrl: {
    fontSize: 10,
    color: Colors.textMuted,
    maxWidth: 200,
  },
  diffBox: {
    gap: 4,
  },
  hashText: {
    fontSize: 9,
    color: Colors.textMuted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  rollbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#DC2626",
    paddingVertical: 10,
    borderRadius: 10,
  },
  rollbackBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  securityCard: {
    padding: 20,
    alignItems: "center",
    borderRadius: 16,
    gap: 8,
  },
  secIconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  secTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    textAlign: "center",
  },
  secDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },
  ruleCard: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
  },
  ruleIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  ruleDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});
