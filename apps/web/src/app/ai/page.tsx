"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Bot,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Layers,
  ShieldAlert,
  Code2,
  FileText,
  RefreshCw,
  Lightbulb,
} from "lucide-react";
import { DEMO_AI_CHAT, type AiCopilotMessage } from "@/lib/demo";
import { useSite } from "@/context/SiteContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const PRESET_PROMPTS = [
  {
    title: "Trafik Düşüşünü Analiz Et",
    prompt: "Son 14 gündeki organik trafik değişimini analiz et ve nedenlerini açıkla.",
  },
  {
    title: "Kritik Hataları Çöz",
    prompt: "Sitemizde son günlerde tespit edilen en kritik teknik SEO açıkları neler?",
  },
  {
    title: "Schema.org JSON-LD Üret",
    prompt: "E-ticaret ürün sayfalarımız ve FAQ için geçerli JSON-LD schema kodu hazırla.",
  },
  {
    title: "GEO & AI Arama Görünürlüğü",
    prompt: "ChatGPT, Perplexity ve Gemini'de marka alıntılarımızı nasıl artırabiliriz?",
  },
];

export default function AiCopilotPage() {
  const { site } = useSite();
  const [messages, setMessages] = useState<AiCopilotMessage[]>(DEMO_AI_CHAT);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isTyping) return;

    const userMsg: AiCopilotMessage = {
      id: `usr-${Date.now()}`,
      sender: "user",
      text: text.trim(),
      timestamp: "Şimdi",
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText("");
    setIsTyping(true);

    setTimeout(() => {
      const lower = text.toLowerCase();
      let reply: AiCopilotMessage;

      if (lower.includes("trafik") || lower.includes("düşüş")) {
        reply = {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          text: `${site?.domain || "flagship-store.com"} üzerindeki organik trafik değişimlerini inceledim:\n\n1. **Kategori Kanonikleşme Hatası:** Parametreli URL'ler ana dizin otoritesini bölerek 4.2 pozisyon kaybına yol açmış.\n2. **Kırık Yönlendirmeler:** Silinen 8 eski kampanya sayfası 301 yerine 404 dönüyor.\n3. **Helpful Content İncelemesi:** Kısa açıklamalı 24 alt sayfa konsolide edilmeli.`,
          timestamp: "Şimdi",
          sources: ["Google Search Console API", "Calpeo Tarama Motoru", "Algoritma Güncelleme Veritabanı"],
          actions: [
            { label: "Kırık URL'leri 301 Yap", actionType: "APPLY_FIX", href: "/changes" },
            { label: "Öncelikli Fırsatları Aç", actionType: "CREATE_TASK", href: "/opportunities" },
          ],
        };
      } else if (lower.includes("schema") || lower.includes("json")) {
        reply = {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          text: `E-ticaret siteniz için Google Search Central standartlarına tam uyumlu **Product + Offer + FAQPage** JSON-LD yapısını oluşturdum:\n\n\`\`\`json\n{\n  "@context": "https://schema.org",\n  "@type": "Product",\n  "name": "Calpeo SEO Paketi",\n  "offers": {\n    "@type": "Offer",\n    "price": "99.00",\n    "priceCurrency": "USD",\n    "availability": "https://schema.org/InStock"\n  }\n}\n\`\`\`\nBu kod arama motorlarında yıldızlı zengin snippet ve fiyat etiketini etkinleştirir.`,
          timestamp: "Şimdi",
          sources: ["Schema.org Standardı v24", "Google Zengin Sonuçlar Kılavuzu"],
          actions: [
            { label: "Doğrudan Sayfaya Ekle", actionType: "APPLY_FIX", href: "/schema" },
          ],
        };
      } else if (lower.includes("geo") || lower.includes("chatgpt") || lower.includes("perplexity")) {
        reply = {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          text: `Generative Engine Optimization (GEO) analizine göre yapay zeka modelleri sitenizi şu an %82 oranında alıntılıyor. Bu oranı %95 üzerine çıkarmak için:\n\n• **Direct Answer Formatı:** Tanımlayıcı paragrafların başına 40 kelimelik net özet ekleyin.\n• **Tablolar:** LLM'ler düz metinden ziyade HTML tablolarını %40 daha fazla alıntılamaktadır.\n• **Otorite Referansları:** Teknik iddiaları kaynak linklerle destekleyin.`,
          timestamp: "Şimdi",
          sources: ["Perplexity Search Engine", "ChatGPT Browsing Logs", "Calpeo GEO Index"],
          actions: [
            { label: "GEO Panelini İncele", actionType: "CREATE_TASK", href: "/geo" },
            { label: "İçerik Editörüne Git", actionType: "GENERATE_CONTENT", href: "/content" },
          ],
        };
      } else {
        reply = {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          text: `Sorunuzu ve ${site?.domain || "flagship-store.com"} sitenizin tüm teknik parametrelerini analiz ettim.\n\nSitenizin indeksleme hiyerarşisi, canonical döngüleri, yapılandırılmış verisi ve yapay zeka arama motorları görünürlüğü için gereken optimizasyon adımlarını hemen uygulayabiliriz.`,
          timestamp: "Şimdi",
          sources: ["Calpeo Deep Crawl", "Google Search Central 2026 Kılavuzu"],
          actions: [
            { label: "Teknik Sorunları İncele", actionType: "APPLY_FIX", href: "/issues" },
            { label: "Yeni Tarama Başlat", actionType: "CRAWL", href: "/crawls" },
          ],
        };
      }

      setMessages((prev) => [...prev, reply]);
      setIsTyping(false);
    }, 700);
  };

  const handleActionClick = (action: { label: string; actionType: string; href?: string }) => {
    setActionNotice(`İşlem başlatıldı: "${action.label}" — İlgili modül tetiklendi.`);
    setTimeout(() => setActionNotice(null), 3500);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14">
      {/* Header */}
      <PageHeader
        icon={<Bot className="w-5 h-5 text-accent" />}
        title="Otonom AI SEO Asistanı & Karar Motoru"
        description="Sitenizin tüm tarama verilerini, teknik eksikliklerini ve GSC analitiğini gerçek zamanlı inceleyen yapay zeka SEO uzmanı."
        actions={
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-evidence animate-pulse" />
            <span className="text-xs font-semibold text-evidence">Model Aktif: Calpeo Copilot 2.0</span>
          </div>
        }
      />

      {/* Action Notification Banner */}
      {actionNotice && (
        <div className="p-3 bg-evidence-soft text-evidence rounded-sm border border-evidence flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        </div>
      )}

      {/* Preset Prompts Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PRESET_PROMPTS.map((p, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(p.prompt)}
            className="p-3 bg-surface hover:bg-surface-2 rounded-sm border border-line text-left transition-colors cursor-pointer group space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink group-hover:text-accent-ink">{p.title}</span>
              <Sparkles className="w-3.5 h-3.5 text-accent opacity-70 group-hover:opacity-100" />
            </div>
            <p className="text-2xs text-muted truncate">{p.prompt}</p>
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <Panel flush>
        <div className="flex flex-col h-[520px]">
          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-surface">
            {messages.map((m) => {
              const isAssistant = m.sender === "assistant";
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 max-w-3xl ${isAssistant ? "mr-auto" : "ml-auto flex-row-reverse"}`}
                >
                  {isAssistant && (
                    <div className="w-8 h-8 rounded-sm bg-accent-soft text-accent-ink flex items-center justify-center shrink-0 border border-accent">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className="space-y-2 max-w-2xl">
                    <div
                      className={`p-4 rounded-sm text-sm ${
                        isAssistant
                          ? "bg-surface-2 text-ink border border-line"
                          : "bg-accent-fill text-white font-medium"
                      }`}
                    >
                      <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                    </div>

                    {/* Sources & Action Buttons */}
                    {isAssistant && (
                      <div className="space-y-2 pl-1">
                        {m.sources && m.sources.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-2xs text-muted">
                            <span className="font-semibold text-faint">Kaynaklar:</span>
                            {m.sources.map((s, idx) => (
                              <span key={idx} className="bg-surface-2 px-1.5 py-0.5 rounded-xs border border-line">
                                {s}
                              </span>
                            ))}
                          </div>
                        )}

                        {m.actions && m.actions.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {m.actions.map((act, idx) => (
                              <Link
                                key={idx}
                                href={act.href || "#"}
                                onClick={() => handleActionClick(act)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-sm text-xs font-semibold bg-accent-soft text-accent-ink hover:bg-accent-fill hover:text-white transition-colors border border-accent"
                              >
                                <Sparkles className="w-3 h-3" />
                                {act.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-2 text-xs text-muted font-mono p-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" />
                <span>Calpeo AI site denetim verilerini inceliyor...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 border-t border-line bg-surface-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <Input
                placeholder="SEO, indeksleme veya yapay zeka arama motorları hakkında soru sorun..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-surface"
              />
              <Button
                type="submit"
                variant="primary"
                icon={<Send className="w-4 h-4" />}
                disabled={!inputText.trim() || isTyping}
              >
                Gönder
              </Button>
            </form>
          </div>
        </div>
      </Panel>
    </div>
  );
}
