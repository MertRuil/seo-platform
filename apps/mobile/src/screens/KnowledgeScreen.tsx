import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  Linking,
  Platform
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { searchKnowledge } from "../services/api";
import { KnowledgeChunk } from "../types";

export const KnowledgeScreen: React.FC = () => {
  const [query, setQuery] = useState("Kanonikleştirme");
  const [results, setResults] = useState<KnowledgeChunk[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    handleSearch();
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const data = await searchKnowledge(query.trim());
      setResults(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>SEO RAG Bilgi Bankası</Text>
      <Text style={styles.pageSubtitle}>
        Google Search Central, RFC ve Schema.org doğrulanmış standartlarında arama yapın.
      </Text>

      {/* Search Input Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          placeholder="Örn: canonical, robots.txt, schema, core web vitals"
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Ara</Text>
        </TouchableOpacity>
      </View>

      {/* Anti-Myth Verification Guarantee Banner */}
      <GlassCard variant="tinted" style={styles.guaranteeBanner}>
        <View style={styles.guaranteeRow}>
          <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
          <View style={styles.guaranteeTextContainer}>
            <Text style={styles.guaranteeTitle}>Sıfır Yanlış Bilgi (Zero False Info)</Text>
            <Text style={styles.guaranteeDesc}>
              Eski/çürütülmüş SEO mitleri (meta keywords, rel=next/prev) RAG katmanında filtrelenmiştir.
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* Search Results */}
      <Text style={styles.sectionHeader}>Doğrulanmış Sonuçlar ({results.length})</Text>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 30 }} />
      ) : results.length === 0 ? (
        <GlassCard style={styles.emptyCard}>
          <Ionicons name="search-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Eşleşen Standart Doküman Bulunamadı</Text>
          <Text style={styles.emptyDesc}>
            Lütfen 'canonical', 'robots.txt', 'schema' veya 'core web vitals' gibi terimlerle tekrar arama yapın.
          </Text>
        </GlassCard>
      ) : (
        results.map((chunk) => (
          <GlassCard key={chunk.chunk_id} style={styles.chunkCard}>
            <View style={styles.chunkTop}>
              <View style={styles.officialBadge}>
                <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                <Text style={styles.officialText}>RESMİ STANDART</Text>
              </View>
              <Text style={styles.scoreText}>%{Math.round(chunk.score * 100)} Eşleşme</Text>
            </View>

            <Text style={styles.docTitle}>{chunk.document_title}</Text>
            
            {chunk.heading_path.length > 0 && (
              <Text style={styles.headingPath}>
                {chunk.heading_path.join(" › ")}
              </Text>
            )}

            <Text style={styles.chunkContent}>{chunk.content}</Text>

            {chunk.canonical_url ? (
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => {
                  if (Platform.OS === "web" && typeof window !== "undefined") {
                    window.open(chunk.canonical_url, "_blank");
                  } else {
                    Linking.openURL(chunk.canonical_url);
                  }
                }}
              >
                <Text style={styles.linkText} numberOfLines={1}>Orijinal Dokümanı Aç</Text>
                <Ionicons name="open-outline" size={14} color={Colors.primary} />
              </TouchableOpacity>
            ) : null}
          </GlassCard>
        ))
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    paddingVertical: 10,
  },
  searchBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  searchBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  guaranteeBanner: {
    marginBottom: 20,
    padding: 14,
  },
  guaranteeRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  guaranteeTextContainer: {
    flex: 1,
  },
  guaranteeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.primary,
  },
  guaranteeDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  chunkCard: {
    marginBottom: 14,
    padding: 16,
  },
  chunkTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  officialBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.successSurface,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  officialText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.success,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.textMuted,
  },
  docTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  headingPath: {
    fontSize: 11,
    color: Colors.primary,
    marginTop: 2,
    marginBottom: 8,
  },
  chunkContent: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  linkText: {
    fontSize: 11,
    fontWeight: "600",
    color: Colors.primary,
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  emptyDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 16,
  },
});
