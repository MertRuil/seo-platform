"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Bot,
  Send,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Code2,
  RefreshCw,
} from "lucide-react";
import { type AiCopilotMessage } from "@/lib/demo";
import { api } from "@/lib/api";
import { useSite } from "@/context/SiteContext";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const PRESET_PROMPTS = [
  {
    title: "Trafik Fırsatlarını Bul",
    prompt: "Search Console verisine göre gösterimi yüksek ama tıklaması düşük sorgular hangileri, ne yapmalıyım?",
  },
  {
    title: "Kritik Hataları Çöz",
    prompt: "Son taramaya göre en kritik teknik SEO sorunları neler ve hangi sırayla çözmeliyim?",
  },
  {
    title: "Açık Önerileri Önceliklendir",
    prompt: "Açık önerileri etki ve efora göre önceliklendir; bu hafta hangilerini yapmalıyım?",
  },
  {
    title: "Schema.org JSON-LD Üret",
    prompt: "Sitemizin türüne uygun Organization ve FAQ için geçerli JSON-LD örneği hazırla.",
  },
];

const WELCOME: AiCopilotMessage = {
  id: "ai-welcome",
  sender: "assistant",
  text: "Seçili sitenin son taramasını, Search Console sorgularını ve açık önerilerini okuyup soru yanıtlarım. Veride olmayan bir şeyi tahmin etmem; veri eksikse söylerim.",
  timestamp: "",
};

const SOURCE_LABELS: Record<string, string> = {
  crawl: "Son tarama",
  gsc: "Search Console",
  recommendations: "Açık öneriler",
};

export default function AiCopilotPage() {
  const { site, org } = useSite();
  const [messages, setMessages] = useState<AiCopilotMessage[]>([WELCOME]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isTyping) return;
    if (!org?.id || !site?.id) {
      setChatError("AI Copilot için arka uçta kayıtlı bir site seçili olmalı.");
      return;
    }

    const history = messages
      .filter((m) => m.id !== WELCOME.id)
      .slice(-6)
      .map((m) => ({ role: m.sender, text: m.text }));
    setMessages((prev) => [...prev, { id: `usr-${Date.now()}`, sender: "user", text, timestamp: "Şimdi" }]);
    if (!textToSend) setInputText("");
    setChatError(null);
    setIsTyping(true);

    try {
      const res = await api.copilotChat(org.id, site.id, { message: text, history });
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          text: res.reply,
          timestamp: "Şimdi",
          sources: res.context_sources.map((s) => SOURCE_LABELS[s] ?? s),
        },
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "AI Copilot yanıt vermedi.");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-14">
      {/* Header */}
      <PageHeader
        icon={<Bot className="w-5 h-5 text-accent" />}
        title="AI SEO Asistanı"
        description="Seçili sitenin tarama, Search Console ve öneri verisini bağlam olarak kullanan AI asistanı."
      />

      {chatError && (
        <div role="alert" className="p-3 bg-critical-soft text-critical rounded-sm border-l-2 border-critical flex items-center gap-2 text-xs font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{chatError}</span>
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
            <p className="text-xs text-muted truncate">{p.prompt}</p>
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
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
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
                <span>Site verisi modele gönderildi, yanıt bekleniyor...</span>
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
                aria-label="AI asistana soru"
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
