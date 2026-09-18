import React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator,
  RefreshControl,
  Share 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { LiveCrawlCard } from "../components/LiveCrawlCard";
import { IssueDetailModal } from "../components/IssueDetailModal";
import { useApp } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { fetchSiteIssues } from "../services/api";
import { SiteIssueItem, IssueSeverity } from "../types";

export const DashboardScreen: React.FC = () => {
  const { user } = useAuth();
  const { selectedSite, sites, addNewSite, startCrawl, setActiveTab, activeCrawl, refreshSites } = useApp();
  const [issues, setIssues] = React.useState<SiteIssueItem[]>([]);
  const [selectedIssue, setSelectedIssue] = React.useState<SiteIssueItem | null>(null);
  const [issueFilter, setIssueFilter] = React.useState<"ALL" | IssueSeverity>("ALL");
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshSites();
      if (selectedSite && (selectedSite.has_completed_crawl || selectedSite.id === "site-1")) {
        const fresh = await fetchSiteIssues(selectedSite.id, selectedSite.domain);
        setIssues(fresh);
      }
    } finally {
      setRefreshing(false);
    }
  }, [refreshSites, selectedSite?.id, selectedSite?.domain, selectedSite?.has_completed_crawl]);

  const handleShareHealth = async () => {
    if (!selectedSite) return;
    try {
      const siteUrl = selectedSite.primary_url || `https://${selectedSite.domain}`;
      const score = selectedSite.health_score || 0;
      const msg = `📈 SEO Platform - Canlı Sağlık Raporu
🌐 Web Sitesi: ${selectedSite.name} (${siteUrl})
🎯 SEO Sağlık Skoru: ${score > 0 ? `${score}/100` : "Ölçülüyor"}
🔍 Tespit Edilen Açık Fırsatlar: ${issues.length} adet
⚡ Otonom Ajan Durumu: Aktif (Auto Low Risk)

Detaylı teknik analiz ve AI onarım adımları için SEO Platform paneline göz atın.`;

      await Share.share({
        title: `SEO Sağlık Raporu - ${selectedSite.name}`,
        message: msg,
      });
    } catch {
      // ignore
    }
  };

  // First-time user onboarding state
  const [newUrl, setNewUrl] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [isSubmittingSite, setIsSubmittingSite] = React.useState(false);
  const [siteError, setSiteError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (selectedSite && (selectedSite.has_completed_crawl || selectedSite.id === "site-1")) {
      fetchSiteIssues(selectedSite.id, selectedSite.domain).then(setIssues);
    } else {
      setIssues([]);
    }
  }, [selectedSite?.id, selectedSite?.has_completed_crawl, selectedSite?.domain]);

  const handleAddFirstSite = async () => {
    setSiteError(null);
    if (!newUrl.trim()) {
      setSiteError("Lütfen web sitenizin URL veya alan adını girin.");
      return;
    }
    setIsSubmittingSite(true);
    try {
      const site = await addNewSite(newName, newUrl, newUrl);
      await startCrawl(site.total_pages, site);
    } catch {
      setSiteError("Site tanımlanırken bir hata oluştu.");
    } finally {
      setIsSubmittingSite(false);
    }
  };

  // If new user with no sites yet, show onboarding first-site setup!
  if (!selectedSite || sites.length === 0) {
    return (
      <ScrollView key="onboarding-view-scroll" style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.onboardingContainer}>
          {/* Welcome Greeting Header */}
          <View style={styles.onboardingHeader}>
            <View style={styles.onboardingIconRing}>
              <Ionicons name="rocket-outline" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.onboardingGreeting}>
              {`Hoş Geldiniz, ${user?.name || "Kullanıcı"}! 👋`}
            </Text>
            <Text style={styles.onboardingSubtitle}>
              Otonom SEO optimizasyonunu ve Googlebot simülasyonunu başlatmak için ilk web sitenizi ekleyin.
            </Text>
          </View>

          {/* Onboarding Steps Visual Indicator */}
          <View style={styles.stepsCard}>
            <View style={styles.stepCol}>
              <View style={styles.stepBadgeActive}>
                <Text style={styles.stepBadgeTextActive}>1</Text>
              </View>
              <Text style={styles.stepTitleActive}>Siteyi Tanımla</Text>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.stepCol}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>2</Text>
              </View>
              <Text style={styles.stepTitle}>Bot Taraması</Text>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.stepCol}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>3</Text>
              </View>
              <Text style={styles.stepTitle}>AI Onarımı</Text>
            </View>
          </View>

          {/* First Site Setup Card */}
          <GlassCard variant="elevated" style={styles.onboardingFormCard}>
            <Text style={styles.formTitle}>İlk Web Sitenizi Ekleyin</Text>

            {siteError && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={Colors.danger} />
                <Text style={styles.errorText}>{siteError}</Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Web Sitesi URL Adresi *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="globe-outline" size={18} color={Colors.primary} style={styles.fieldIcon} />
              <TextInput
                style={styles.formInput}
                placeholder="https://benimsitem.com"
                placeholderTextColor={Colors.textMuted}
                value={newUrl}
                onChangeText={setNewUrl}
                autoCapitalize="none"
                keyboardType="url"
                autoCorrect={false}
              />
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Site / Marka Adı (İsteğe Bağlı)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="business-outline" size={18} color={Colors.textMuted} style={styles.fieldIcon} />
              <TextInput
                style={styles.formInput}
                placeholder="Örn: E-Ticaret Mağazam"
                placeholderTextColor={Colors.textMuted}
                value={newName}
                onChangeText={setNewName}
              />
            </View>

            {/* Quick Sector Presets */}
            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Hızlı Sektör Seçimi:</Text>
            <View style={styles.presetsGrid}>
              {[
                { label: "🛍️ E-Ticaret", domain: "magazam.com", name: "E-Ticaret Mağazam" },
                { label: "⚡ SaaS", domain: "app.saas.io", name: "SaaS Platformum" },
                { label: "📝 Blog", domain: "blogum.com", name: "Kişisel Blog" },
                { label: "🏢 Kurumsal", domain: "sirketim.com", name: "Kurumsal Web Sitesi" },
              ].map((p) => (
                <TouchableOpacity
                  key={p.label}
                  style={styles.presetChip}
                  onPress={() => {
                    setNewUrl(`https://${p.domain}`);
                    setNewName(p.name);
                    setSiteError(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetChipText}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.submitSiteBtn}
              onPress={handleAddFirstSite}
              disabled={isSubmittingSite}
              activeOpacity={0.8}
            >
              {isSubmittingSite ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="flash" size={16} color="#FFFFFF" />
                  <Text style={styles.submitSiteBtnText}>Siteyi Ekle ve Canlı Taramayı Başlat 🚀</Text>
                </View>
              )}
            </TouchableOpacity>
          </GlassCard>

          {/* Quick URL Audit Shortcut */}
          <TouchableOpacity 
            style={styles.quickAuditLink}
            onPress={() => setActiveTab("quick_audit")}
            activeOpacity={0.7}
          >
            <Ionicons name="flash-outline" size={16} color={Colors.primary} />
            <Text style={styles.quickAuditLinkText}>
              {"Site eklemeden tek bir sayfayı denetlemek için "}
              <Text style={{ fontWeight: "800", color: Colors.primary }}>Hızlı URL Denetimi</Text>
              {" sekmesine geçin."}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  const isCrawlRunning = Boolean(activeCrawl && (activeCrawl.status === "RUNNING" || activeCrawl.status === "QUEUED"));
  const hasCompleted = !isCrawlRunning && Boolean(
    selectedSite?.has_completed_crawl || 
    activeCrawl?.status === "COMPLETED" || 
    (selectedSite?.id === "site-1" && !activeCrawl)
  );
  const healthScore = selectedSite?.health_score || 0;
  const isGood = healthScore >= 80;
  const scoreColor = !hasCompleted || healthScore === 0
    ? Colors.primary 
    : isGood 
      ? Colors.success 
      : healthScore >= 50 
        ? Colors.warning 
        : Colors.danger;

  const filteredIssues = issues.filter(i => {
    if (issueFilter === "ALL") return true;
    return i.severity === issueFilter;
  });

  return (
    <ScrollView 
      key="dashboard-view-scroll" 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.primary}
          colors={[Colors.primary]}
        />
      }
    >
      {/* Site Banner */}
      <View style={styles.siteHeader}>
        <View style={styles.siteHeaderLeft}>
          <Text style={styles.siteTitle} numberOfLines={1}>{selectedSite?.name || "Web Siteniz"}</Text>
          <Text style={styles.siteUrl} numberOfLines={1}>{selectedSite?.primary_url || "https://acmestore.io"}</Text>
        </View>
        <View style={styles.modeBadge}>
          <Ionicons name="flash-sharp" size={11} color={Colors.primary} />
          <Text style={styles.modeText}>Otonom</Text>
        </View>
      </View>

      {/* Live Crawl Progress or Launch Pill */}
      <LiveCrawlCard />

      {/* Main Health Score Card */}
      <GlassCard variant="elevated" style={styles.healthCard}>
        <View style={styles.healthRow}>
          <View style={[styles.scoreRing, { borderColor: scoreColor }]}>
            {hasCompleted && healthScore > 0 ? (
              <>
                <Text style={[styles.scoreNumber, { color: scoreColor }]}>{healthScore}</Text>
                <Text style={styles.scoreScale}>/100</Text>
              </>
            ) : (
              <View style={{ alignItems: "center", justifyContent: "center" }}>
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginBottom: 4 }} />
                <Text style={[styles.scoreScale, { color: Colors.primary, fontWeight: "700" }]}>Ölçülüyor</Text>
              </View>
            )}
          </View>
          <View style={styles.healthInfo}>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: scoreColor }]} />
              <Text style={[styles.statusText, { color: scoreColor }]}>
                {hasCompleted && healthScore > 0 
                  ? (isGood ? "Kritik Sorun Yok" : "İyileştirme Gerekli") 
                  : "Canlı Analiz Sürüyor..."}
              </Text>
            </View>
            <Text style={styles.healthDesc}>
              {hasCompleted && healthScore > 0 
                ? `Siteniz teknik SEO standartlarına %${healthScore} oranında uyumlu. ${issues.length} adet incelenebilir fırsat var.`
                : "Googlebot sayfalarınızı tarıyor. SEO sağlık skoru, dizinlenme durumu ve teknik kriterler tarama bittiğinde otomatik hesaplanacaktır."}
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* Quick Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={styles.primaryActionButton}
          activeOpacity={0.8}
          onPress={() => setActiveTab("quick_audit")}
        >
          <Ionicons name="flash" size={18} color="#FFFFFF" />
          <Text style={styles.primaryActionText}>Hızlı URL Tara</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.secondaryActionButton}
          activeOpacity={0.8}
          onPress={() => setActiveTab("recommendations")}
        >
          <Ionicons name="sparkles" size={18} color={Colors.primary} />
          <Text style={styles.secondaryActionText}>AI Önerileri</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.shareActionButton}
          activeOpacity={0.8}
          onPress={handleShareHealth}
        >
          <Ionicons name="share-social-outline" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Core Web Vitals Section */}
      <Text style={styles.sectionHeader}>Core Web Vitals Performansı</Text>
      <View style={styles.cwvGrid}>
        <GlassCard style={styles.cwvCard}>
          <View style={styles.cwvTop}>
            <Text style={styles.cwvLabel}>LCP</Text>
            <Text style={hasCompleted ? styles.badgeGood : styles.badgePending}>
              {hasCompleted ? "İyi" : "Ölçülüyor"}
            </Text>
          </View>
          <Text style={styles.cwvValue}>{hasCompleted ? (selectedSite?.cwv?.lcp || "1.85s") : "--"}</Text>
          <Text style={styles.cwvSub}>Hedef: &lt; 2.5s</Text>
        </GlassCard>

        <GlassCard style={styles.cwvCard}>
          <View style={styles.cwvTop}>
            <Text style={styles.cwvLabel}>CLS</Text>
            <Text style={hasCompleted ? styles.badgeGood : styles.badgePending}>
              {hasCompleted ? "İyi" : "Ölçülüyor"}
            </Text>
          </View>
          <Text style={styles.cwvValue}>{hasCompleted ? (selectedSite?.cwv?.cls || "0.04") : "--"}</Text>
          <Text style={styles.cwvSub}>Hedef: &lt; 0.1</Text>
        </GlassCard>

        <GlassCard style={styles.cwvCard}>
          <View style={styles.cwvTop}>
            <Text style={styles.cwvLabel}>INP</Text>
            <Text style={hasCompleted ? styles.badgeGood : styles.badgePending}>
              {hasCompleted ? "İyi" : "Ölçülüyor"}
            </Text>
          </View>
          <Text style={styles.cwvValue}>{hasCompleted ? (selectedSite?.cwv?.inp || "95ms") : "--"}</Text>
          <Text style={styles.cwvSub}>Hedef: &lt; 200ms</Text>
        </GlassCard>
      </View>

      {/* Telemetry Summary */}
      <Text style={styles.sectionHeader}>Tarama & İndeks İstatistikleri</Text>
      <GlassCard style={styles.telemetryCard}>
        <View style={styles.telemetryRow}>
          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryNum}>
              {hasCompleted 
                ? (selectedSite?.total_pages || activeCrawl?.max_pages || 14) 
                : `${activeCrawl?.pages_crawled ?? 0}/${selectedSite?.total_pages || activeCrawl?.max_pages || 14}`}
            </Text>
            <Text style={styles.telemetryLabel}>Taranan Sayfa</Text>
          </View>
          <View style={styles.dividerVertical} />
          <View style={styles.telemetryItem}>
            <Text style={[styles.telemetryNum, { color: Colors.danger }]}>
              {hasCompleted ? issues.filter(i => i.severity === "CRITICAL").length : "--"}
            </Text>
            <Text style={styles.telemetryLabel}>Kritik Hata</Text>
          </View>
          <View style={styles.dividerVertical} />
          <View style={styles.telemetryItem}>
            <Text style={[styles.telemetryNum, { color: Colors.warning }]}>
              {hasCompleted ? issues.filter(i => i.severity === "WARNING").length : "--"}
            </Text>
            <Text style={styles.telemetryLabel}>Uyarı</Text>
          </View>
          <View style={styles.dividerVertical} />
          <View style={styles.telemetryItem}>
            <Text style={[styles.telemetryNum, { color: Colors.success }]}>
              {hasCompleted ? "98%" : "--"}
            </Text>
            <Text style={styles.telemetryLabel}>Dizinlenme</Text>
          </View>
        </View>
      </GlassCard>

      {/* Issues & Evidence Section */}
      <View style={styles.issuesHeaderRow}>
        <Text style={styles.sectionHeader}>
          {hasCompleted ? `Kritik SEO Sorunları (${filteredIssues.length})` : "Teknik SEO İhlal Taraması"}
        </Text>
      </View>

      {!hasCompleted ? (
        <GlassCard style={styles.scanningCard}>
          <View style={styles.scanningRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.scanningTitle}>Sayfalar Taranıyor ve İhlaller Analiz Ediliyor...</Text>
              <Text style={styles.scanningDesc}>
                {activeCrawl?.current_url
                  ? `Şu an taranan sayfa: ${activeCrawl.current_url}`
                  : "Googlebot simülatörü sayfaları dolaşarak kanonik URL, meta açıklaması, kırık bağlantı ve indekslenebilirlik kriterlerini denetliyor."}
              </Text>
            </View>
          </View>
        </GlassCard>
      ) : (
        <>
          {/* Issue Filter Chips */}
          <View style={styles.filterRow}>
            {(["ALL", "CRITICAL", "WARNING", "INFO"] as const).map((sev) => {
              const isActive = issueFilter === sev;
              return (
                <TouchableOpacity
                  key={sev}
                  style={[styles.issueChip, isActive && styles.issueChipActive]}
                  onPress={() => setIssueFilter(sev)}
                >
                  <Text style={[styles.issueChipText, isActive && styles.issueChipTextActive]}>
                    {sev === "ALL" ? "Tümü" : sev === "CRITICAL" ? "Kritik" : sev === "WARNING" ? "Uyarı" : "Bilgi"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Issues Cards or Clean State */}
          {filteredIssues.length === 0 ? (
            <GlassCard style={{ padding: 20, alignItems: "center", gap: 6, marginBottom: 12 }}>
              <Ionicons name="checkmark-circle" size={32} color={Colors.success} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: Colors.textPrimary }}>Kritik Sorun Tespit Edilmedi</Text>
              <Text style={{ fontSize: 11, color: Colors.textSecondary, textAlign: "center" }}>
                Sitenizin taranan tüm sayfaları temel teknik SEO ve indekslenebilirlik kriterlerine tam uyumludur.
              </Text>
            </GlassCard>
          ) : (
            filteredIssues.map((issue) => {
              const isCritical = issue.severity === "CRITICAL";
              const isWarning = issue.severity === "WARNING";
              const sevColor = isCritical ? Colors.danger : isWarning ? Colors.warning : Colors.info;

              return (
                <GlassCard 
                  key={issue.rule_id} 
                  style={styles.issueCard}
                  onPress={() => setSelectedIssue(issue)}
                >
                  <View style={styles.issueTop}>
                    <View style={[styles.issueSevBadge, { backgroundColor: `${sevColor}20`, borderColor: sevColor }]}>
                      <View style={[styles.issueSevDot, { backgroundColor: sevColor }]} />
                      <Text style={[styles.issueSevText, { color: sevColor }]}>{issue.severity}</Text>
                    </View>
                    <Text style={styles.issueAffectedCount}>
                      {issue.affected_url_count} Sayfa Etkilendi
                    </Text>
                  </View>

                  <Text style={styles.issueTitle}>{issue.title}</Text>
                  <Text style={styles.issueDesc} numberOfLines={2}>{issue.description}</Text>

                  <View style={styles.issueBottom}>
                    <Text style={styles.inspectText}>Kanıtları İncele</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                  </View>
                </GlassCard>
              );
            })
          )}
        </>
      )}

      {/* Issue Evidence Inspector Modal */}
      <IssueDetailModal
        issue={selectedIssue}
        visible={Boolean(selectedIssue)}
        onClose={() => setSelectedIssue(null)}
        onAction={() => {
          setActiveTab("recommendations");
        }}
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
  siteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  siteHeaderLeft: {
    flex: 1,
    marginRight: 10,
  },
  siteTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  siteUrl: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(99, 102, 241, 0.12)",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.25)",
    gap: 4,
    flexShrink: 0,
  },
  modeText: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primary,
  },
  healthCard: {
    marginBottom: 16,
    padding: 16,
  },
  healthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  scoreRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    flexShrink: 0,
  },
  scoreNumber: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -1,
  },
  scoreScale: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: -4,
  },
  healthInfo: {
    flex: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
  },
  healthDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  secondaryActionText: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  shareActionButton: {
    width: 48,
    backgroundColor: Colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  cwvGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  cwvCard: {
    flex: 1,
    padding: 10,
  },
  cwvTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cwvLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  badgeGood: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.success,
    backgroundColor: Colors.successSurface,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  badgePending: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.primary,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
  },
  scanningCard: {
    padding: 16,
    marginBottom: 16,
  },
  scanningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scanningTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  scanningDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  cwvValue: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  cwvSub: {
    fontSize: 9,
    color: Colors.textMuted,
    marginTop: 2,
  },
  telemetryCard: {
    padding: 12,
  },
  telemetryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  telemetryItem: {
    flex: 1,
    alignItems: "center",
  },
  telemetryNum: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  telemetryLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 3,
    textAlign: "center",
  },
  dividerVertical: {
    width: 1,
    height: 30,
    backgroundColor: Colors.borderSubtle,
  },
  issuesHeaderRow: {
    marginTop: 24,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  issueChip: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  issueChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  issueChipText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  issueChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  issueCard: {
    marginBottom: 10,
    padding: 16,
  },
  issueTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  issueSevBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    gap: 5,
  },
  issueSevDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  issueSevText: {
    fontSize: 9,
    fontWeight: "800",
  },
  issueAffectedCount: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: "500",
  },
  issueTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
    lineHeight: 18,
  },
  issueDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginBottom: 10,
  },
  issueBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  inspectText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
  // New User Onboarding Styles
  onboardingContainer: {
    paddingVertical: 10,
  },
  onboardingHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  onboardingIconRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  onboardingGreeting: {
    fontSize: 22,
    fontWeight: "800",
    color: Colors.textPrimary,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  onboardingSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 6,
    paddingHorizontal: 16,
  },
  stepsCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  stepCol: {
    alignItems: "center",
    gap: 4,
  },
  stepBadgeActive: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeTextActive: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  stepTitleActive: {
    fontSize: 10,
    fontWeight: "700",
    color: Colors.primary,
  },
  stepConnector: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
    marginTop: -14,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepBadgeText: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  stepTitle: {
    fontSize: 10,
    fontWeight: "500",
    color: Colors.textMuted,
  },
  onboardingFormCard: {
    padding: 18,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 14,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dangerSurface,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
  },
  errorText: {
    fontSize: 11,
    color: Colors.danger,
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
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
  fieldIcon: {
    marginRight: 8,
  },
  formInput: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    paddingVertical: 10,
  },
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 18,
  },
  presetChip: {
    backgroundColor: Colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetChipText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  submitSiteBtn: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitSiteBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  quickAuditLink: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.2)",
    gap: 8,
  },
  quickAuditLinkText: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
    flex: 1,
  },
});

