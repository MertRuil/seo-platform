import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator 
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { runQuickAudit } from "../services/api";
import { QuickAuditResult } from "../types";
import { useApp } from "../context/AppContext";

export const QuickAuditScreen: React.FC = () => {
  const { selectedSite } = useApp();
  const [url, setUrl] = useState(selectedSite ? selectedSite.primary_url : "https://apple.com");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuickAuditResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync url when selected site changes
  React.useEffect(() => {
    if (selectedSite?.primary_url) {
      setUrl(selectedSite.primary_url);
    }
  }, [selectedSite?.id, selectedSite?.primary_url]);

  const handleAudit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await runQuickAudit(trimmed);
      setResult(data);
    } catch (err: any) {
      setErrorMsg("URL denetimi sırasında bir hata oluştu. Lütfen geçerli bir web adresi girdiğinizden emin olun.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>Canlı Hızlı URL Denetimi</Text>
      <Text style={styles.pageSubtitle}>
        Herhangi bir web sayfasını Google bot gözüyle anında analiz edin.
      </Text>

      {/* Input Bar */}
      <View style={styles.inputCard}>
        <Ionicons name="link-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="https://example.com/page"
          placeholderTextColor={Colors.textMuted}
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          keyboardType="url"
          autoCorrect={false}
        />
        <TouchableOpacity 
          style={styles.auditBtn} 
          onPress={handleAudit}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.auditBtnText}>Tara</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Error Banner */}
      {errorMsg && (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle" size={18} color={Colors.danger} />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* Audit Result Display */}
      {result && (
        <View style={styles.resultContainer}>
          {/* Summary Card */}
          <GlassCard variant="elevated" style={styles.scoreCard}>
            <View style={styles.scoreHeader}>
              <View>
                <Text style={styles.scoreTitle} numberOfLines={1}>{result.url}</Text>
                <Text style={styles.scoreSub}>HTTP {result.status_code} • {result.load_time_ms}ms Yanıt</Text>
              </View>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreNum}>{result.health_score}</Text>
                <Text style={styles.scoreMax}>/100</Text>
              </View>
            </View>

            {/* Meta Tags Details */}
            <View style={styles.metaBox}>
              <Text style={styles.metaLabel}>Başlık (Title):</Text>
              <Text style={styles.metaValue}>{result.title}</Text>
              <Text style={[styles.metaLabel, { marginTop: 8 }]}>Açıklama (Description):</Text>
              <Text style={styles.metaValue}>{result.meta_description}</Text>
            </View>
          </GlassCard>

          {/* Checklist Items */}
          <Text style={styles.checkHeader}>Denetim Kontrol Listesi ({result.checks.length})</Text>
          {result.checks.map((c) => (
            <GlassCard key={c.id} style={styles.checkCard}>
              <View style={styles.checkRow}>
                <Ionicons
                  name={c.passed ? "checkmark-circle" : "close-circle"}
                  size={22}
                  color={c.passed ? Colors.success : Colors.danger}
                />
                <View style={styles.checkInfo}>
                  <Text style={styles.checkTitle}>{c.title}</Text>
                  <Text style={styles.checkDetail}>{c.detail}</Text>
                </View>
                <View style={[
                  styles.severityPill,
                  c.severity === "CRITICAL" && styles.sevCritical,
                  c.severity === "WARNING" && styles.sevWarning,
                  c.severity === "INFO" && styles.sevInfo,
                ]}>
                  <Text style={styles.sevText}>{c.severity}</Text>
                </View>
              </View>
            </GlassCard>
          ))}
        </View>
      )}
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
  inputCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 20,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    paddingVertical: 10,
  },
  auditBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  auditBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  resultContainer: {
    marginTop: 4,
  },
  scoreCard: {
    marginBottom: 16,
    padding: 18,
  },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  scoreTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
    maxWidth: 220,
  },
  scoreSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  scoreNum: {
    fontSize: 20,
    fontWeight: "800",
    color: Colors.success,
  },
  scoreMax: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  metaBox: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  metaValue: {
    fontSize: 12,
    color: Colors.textPrimary,
    marginTop: 2,
    lineHeight: 16,
  },
  checkHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  checkCard: {
    marginBottom: 10,
    padding: 14,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkInfo: {
    flex: 1,
  },
  checkTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  checkDetail: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  severityPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  sevCritical: {
    backgroundColor: Colors.dangerSurface,
  },
  sevWarning: {
    backgroundColor: Colors.warningSurface,
  },
  sevInfo: {
    backgroundColor: Colors.infoSurface,
  },
  sevText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(244, 63, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(244, 63, 94, 0.25)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
});
