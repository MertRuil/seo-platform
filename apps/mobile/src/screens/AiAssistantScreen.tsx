import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../theme/colors";
import { GlassCard } from "../components/GlassCard";
import { useApp } from "../context/AppContext";
import { sendAiAssistantMessage, createTask, executeRecommendation } from "../services/api";
import { AiChatMessage } from "../types";

export const AiAssistantScreen: React.FC = () => {
  const { selectedSite, startCrawl, setActiveTab } = useApp();
  const scrollViewRef = useRef<ScrollView>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "assistant",
      text: `Merhaba! Ben ${selectedSite?.name || "siteniz"} için özel eğitilmiş AI SEO & GEO Asistanınızım.\n\nSitenizin tarama verilerini, dizinlenme problemlerini, arama konsolu metriklerini ve yapay zeka (ChatGPT, Perplexity) alıntı durumunu biliyorum. Size nasıl yardımcı olabilirim?`,
      timestamp: new Date().toISOString(),
      sources: ["Canlı Site Denetim Verisi", "Google Search Central Rehberleri"],
      suggested_actions: [
        { label: "En Önemli Problemleri Listele", action_type: "CREATE_TASK" },
        { label: "Hızlı Tarama Başlat", action_type: "CRAWL" }
      ]
    }
  ]);

  const QUICK_PROMPTS = [
    "Neden trafiğim düştü?",
    "En önemli 3 SEO problemim ne?",
    "Bu hafta ne yapmalıyım?",
    "🇬🇧 UK / ASA & CMA Kuralları",
    "🇦🇪 BAE & Körfez / MENA Mevzuatı",
    "🌏 Asya / PMDA & SAMR Uyum Kuralları",
    "Hangi içerikleri yazmalıyım?",
    "Rakibim neden benden yukarıda?"
  ];

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg: AiChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: query.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      const reply = await sendAiAssistantMessage(
        [...messages, userMsg],
        selectedSite?.id,
        selectedSite?.domain
      );
      setMessages(prev => [...prev, reply]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          sender: "assistant",
          text: "Üzgünüm, şu anda yanıt oluşturulurken bir bağlantı hatası yaşandı. Lütfen tekrar deneyin.",
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleAction = async (action: { label: string; action_type: string; payload?: any }) => {
    if (action.action_type === "CRAWL") {
      if (selectedSite) {
        startCrawl(selectedSite.total_pages || 50, selectedSite);
        setActiveTab("quick_audit");
      }
    } else if (action.action_type === "CREATE_TASK") {
      if (selectedSite) {
        await createTask(selectedSite.id, {
          title: action.label,
          description: "AI Asistan önerisinden otonom oluşturuldu.",
          priority: "HIGH",
          status: "TODO"
        });
        Alert.alert("Başarılı", `"${action.label}" görev listenize eklendi!`);
      }
    } else if (action.action_type === "APPLY_FIX") {
      const res = await executeRecommendation("rec-quick");
      Alert.alert("AI Aksiyonu Uygulandı", res.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.botAvatar}>
            <Ionicons name="sparkles" size={18} color="#FFFFFF" />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI SEO & GEO Asistanı</Text>
            <Text style={styles.headerSub}>
              {selectedSite?.domain ? `${selectedSite.domain} • Bağlı ve Aktif` : "Otonom Analitik Motoru"}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.clearBtn} 
          onPress={() => setMessages([messages[0]])}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Messages Scroll Area */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatScroll}
        contentContainerStyle={styles.chatContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <View
              key={msg.id}
              style={[styles.msgWrapper, isUser ? styles.msgWrapperUser : styles.msgWrapperAssistant]}
            >
              {!isUser && (
                <View style={styles.assistantAvatarSmall}>
                  <Ionicons name="sparkles" size={13} color={Colors.primary} />
                </View>
              )}

              <View style={{ maxWidth: "84%" }}>
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
                  <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant]}>
                    {msg.text}
                  </Text>
                </View>

                {/* Source Citations */}
                {msg.sources && msg.sources.length > 0 && (
                  <View style={styles.sourcesBox}>
                    <Ionicons name="book-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.sourcesText}>
                      Kaynak: {msg.sources.join(" • ")}
                    </Text>
                  </View>
                )}

                {/* 1-Click Action Buttons */}
                {msg.suggested_actions && msg.suggested_actions.length > 0 && (
                  <View style={styles.actionsRow}>
                    {msg.suggested_actions.map((act, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.actionPill}
                        onPress={() => handleAction(act)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="flash" size={11} color="#FFFFFF" />
                        <Text style={styles.actionPillText}>{act.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {loading && (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.typingText}>AI analiz ediyor ve öneri hazırlıyor...</Text>
          </View>
        )}
      </ScrollView>

      {/* Quick Prompt Chips */}
      <View style={styles.promptChipsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptChipsScroll}>
          {QUICK_PROMPTS.map((p, i) => (
            <TouchableOpacity
              key={i}
              style={styles.promptChip}
              onPress={() => handleSend(p)}
              activeOpacity={0.7}
            >
              <Text style={styles.promptChipText}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Input Bar */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="SEO veya GEO hakkında sorun..."
          placeholderTextColor={Colors.textMuted}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => handleSend()}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && { opacity: 0.5 }]}
          disabled={!input.trim() || loading}
          onPress={() => handleSend()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    backgroundColor: Colors.surface,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  botAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primary,
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
  clearBtn: {
    padding: 6,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 20,
    gap: 16,
  },
  msgWrapper: {
    flexDirection: "row",
    gap: 8,
  },
  msgWrapperUser: {
    justifyContent: "flex-end",
  },
  msgWrapperAssistant: {
    justifyContent: "flex-start",
  },
  assistantAvatarSmall: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  bubble: {
    padding: 14,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: Colors.surfaceElevated,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 19,
  },
  bubbleTextUser: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  bubbleTextAssistant: {
    color: Colors.textPrimary,
  },
  sourcesBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    paddingLeft: 4,
  },
  sourcesText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: "italic",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(99, 102, 241, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  actionPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
  },
  typingText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  promptChipsWrapper: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    backgroundColor: Colors.surface,
    paddingVertical: 8,
  },
  promptChipsScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  promptChip: {
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  promptChipText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 11 : 8,
    color: Colors.textPrimary,
    fontSize: 14,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
