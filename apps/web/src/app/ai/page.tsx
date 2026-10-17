"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, Send, ArrowRight, Info } from "lucide-react";
import { useSite } from "@/context/SiteContext";
import { api } from "@/lib/api";
import { gscToPerformance, healthToIssues } from "@/lib/mappers";
import { SEVERITY_LABEL } from "@/lib/demo";
import { detectIntent, REGULATION_GUIDES, type AssistantIntent } from "@/lib/assistant";
import { summarizeAnswerBotAccess, type BotAccess, type ReadinessCheck } from "@/lib/geo-readiness";
import { formatNumber, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SimpleMarkdown } from "@/components/SimpleMarkdown";
import { cn } from "@/lib/cn";

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  sources?: string[];
  links?: Array<{ label: string; href: string }>;
}

const PRESETS: Array<{ title: string; prompt: string }> = [
  { title: "En kritik sorunlarım neler?", prompt: "Sitemdeki en kritik teknik sorunlar neler?" },
  { title: "Google performansım nasıl?", prompt: "Search Console trafik ve sıralama durumum nasıl?" },
  { title: "AI motorları sitemi okuyabiliyor mu?", prompt: "ChatGPT ve Perplexity sitemi okuyabiliyor mu?" },
  { title: "Şema örneği", prompt: "Ürün sayfam için JSON-LD şema örneği" },
  { title: "Türkiye reklam mevzuatı", prompt: "Türkiye reklam mevzuatında nelere dikkat etmeliyim?" },
  { title: "AB reklam mevzuatı", prompt: "Avrupa greenwashing kuralları neler?" },
];

const WELCOME: Message = {
  id: "welcome",
  sender: "assistant",
  text:
    "Merhaba. Sitenizin tarama sonuçları, Search Console verisi ve AI erişim durumu hakkındaki sorularınızı yanıtlayabilirim. Reklam mevzuatı için de genel rehber bilgisi verebilirim.\n\nYanıtlar kural tabanlıdır; yapay zeka modeli kullanılmaz ve siteniz hakkında yalnızca ölçülmüş veriler gösterilir.",
};

const SCHEMA_ANSWER = `Aşağıdaki şablonu kendi ürün bilgilerinizle doldurun ve sayfanın <head> bölümüne ekleyin. Fiyat ve stok bilgisi sayfada görünen bilgiyle aynı olmalıdır.

\`\`\`
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Ürün adı",
  "image": "https://siteniz.com/urun.jpg",
  "description": "Kısa ürün açıklaması",
  "offers": {
    "@type": "Offer",
    "price": "0.00",
    "priceCurrency": "TRY",
    "availability": "https://schema.org/InStock"
  }
}
</script>
\`\`\`

Eklemeden sonra Google Zengin Sonuçlar Testi ile doğrulayın.`;

export default function AssistantPage() {
  const { org, site, crawl } = useSite();
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const answer = async (intent: AssistantIntent): Promise<Omit<Message, "id" | "sender">> => {
    if (intent.startsWith("REG_")) {
      const g = REGULATION_GUIDES[intent as keyof typeof REGULATION_GUIDES];
      return { text: `${g.text}\n\nBu bilgi geneldir, hukuki görüş yerine geçmez.`, sources: g.sources, links: [{ label: "Metni mevzuata göre tara", href: "/content" }] };
    }
    if (intent === "SCHEMA") return { text: SCHEMA_ANSWER, sources: ["schema.org/Product", "Google Search Central: Ürün yapılandırılmış verisi"], links: [{ label: "Yapılandırılmış veri ekranı", href: "/schema" }] };

    if (!org || !site) return { text: "Bu soruyu yanıtlamak için önce sitenizi eklemeniz gerekiyor.", links: [{ label: "Genel görünüme git", href: "/" }] };

    if (intent === "ISSUES") {
      if (!crawl) return { text: "Siteniz için henüz tamamlanmış tarama yok. Tarama bittiğinde sorunları buradan sorabilirsiniz.", links: [{ label: "Tarama durumu", href: "/crawls" }] };
      const issues = healthToIssues(await api.getCrawlHealth(org.id, site.id, crawl.id));
      if (issues.length === 0) return { text: "Son taramada sorun bulunmadı.", sources: ["Son tarama"] };
      const top = issues.slice(0, 5).map((i) => `- **${i.title}** (${SEVERITY_LABEL[i.severity]}, ${i.affected ?? 0} sayfa): ${i.fix}`);
      return {
        text: `Son taramada ${issues.length} sorun türü var. Önem ve etkilenen sayfa sayısına göre ilk ${top.length}:\n\n${top.join("\n")}`,
        sources: [`Son tarama · ${site.domain}`],
        links: [{ label: "Sorunları ve etkilenen sayfaları gör", href: "/issues" }],
      };
    }
    if (intent === "TRAFFIC") {
      const rows = await api.getGscMetrics(org.id, site.id).catch(() => []);
      if (rows.length === 0) return { text: "Search Console bağlı olmadığı için tıklama ve sıralama verisi yok. Bağladığınızda bu soruyu gerçek veriyle yanıtlayabilirim.", links: [{ label: "Search Console'u bağla", href: "/integrations" }] };
      const p = gscToPerformance(rows);
      const q = p.queries.slice(0, 3).map((x) => `- ${x.query}: ${formatNumber(x.clicks)} tıklama, sıra ${formatNumber(x.position, 1)}`);
      return {
        text: `Search Console'a göre **${formatNumber(p.clicks)} tıklama**, ${formatNumber(p.impressions)} gösterim, tıklama oranı ${formatPercent(p.ctr, 1)}, ortalama sıra ${formatNumber(p.position, 1)}.\n\nEn çok tıklanan sorgular:\n${q.join("\n")}\n\nDüşüşün nedenini tek başına bu veri göstermez; aynı dönemde yapılan değişiklikleri ve Sorunlar ekranını birlikte inceleyin.`,
        sources: ["Google Search Console"],
        links: [{ label: "Arama performansı", href: "/performance" }],
      };
    }
    if (intent === "AI_ACCESS") {
      const r = await fetch("/api/v1/geo/readiness", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: site.primary_url }) });
      if (!r.ok) return { text: "AI erişim denetimi şu anda yapılamadı.", links: [{ label: "AI görünürlüğü ekranı", href: "/geo" }] };
      const data = (await r.json()) as { bots: BotAccess[]; checks: ReadinessCheck[] };
      const access = summarizeAnswerBotAccess(data.bots);
      const problems = data.checks.filter((c) => c.status === "fail" || c.status === "warn").map((c) => `- ${c.finding}`);
      return {
        text: `${access.summary}${problems.length ? `\n\nİyileştirilebilecekler:\n${problems.join("\n")}` : ""}\n\nNot: Bu denetim erişimi gösterir; yanıtlarda ne sıklıkla alıntılandığınız ölçülmez.`,
        sources: [`${site.domain}/robots.txt`, "Ana sayfa HTML"],
        links: [{ label: "AI görünürlüğü ekranı", href: "/geo" }],
      };
    }
    return {
      text: "Bu soruyu yanıtlayamıyorum. Şu konularda yardımcı olabilirim: sitenizdeki sorunlar, Google performansı, AI tarayıcı erişimi, şema örnekleri ve reklam mevzuatı (TR, AB, ABD, BK, Asya, Körfez).",
    };
  };

  const send = async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, sender: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const a = await answer(detectIntent(q));
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, sender: "assistant", ...a }]);
    } catch (e) {
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, sender: "assistant", text: `Veri alınamadı: ${e instanceof Error ? e.message : "bilinmeyen hata"}.` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-14">
      <PageHeader
        icon={<Bot className="w-5 h-5" />}
        title="SEO asistanı"
        description="Sitenizin tarama, Search Console ve AI erişim verisine dayanarak soruları yanıtlar."
      />
      <p className="text-xs text-muted flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden />
        Yanıtlar kural tabanlıdır, yapay zeka modeli kullanılmaz. Soruyu anlayamazsa bunu söyler.
      </p>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Hazır sorular">
        {PRESETS.map((p) => (
          <button
            key={p.title}
            type="button"
            onClick={() => send(p.prompt)}
            disabled={busy}
            className="h-9 px-3 rounded-sm border border-line bg-surface text-xs font-medium text-ink hover:bg-surface-2 hover:border-line-strong cursor-pointer disabled:opacity-50"
          >
            {p.title}
          </button>
        ))}
      </div>

      <Panel flush>
        <div className="h-[55dvh] min-h-[320px] overflow-y-auto custom-scrollbar p-4 space-y-4" aria-live="polite" aria-busy={busy}>
          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.sender === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[92%] sm:max-w-[80%] rounded-md px-4 py-3 text-sm", m.sender === "user" ? "bg-accent-fill text-accent-on" : "bg-surface-2 text-ink border border-line")}>
                {m.sender === "user" ? <p className="whitespace-pre-wrap">{m.text}</p> : <SimpleMarkdown text={m.text} />}
                {m.sources && m.sources.length > 0 && <p className="mt-2 text-2xs text-muted">Kaynak: {m.sources.join(" · ")}</p>}
                {m.links && m.links.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {m.links.map((l) => (
                      <Link key={l.href + l.label} href={l.href} className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink hover:underline min-h-[28px]">
                        {l.label} <ArrowRight className="w-3 h-3" aria-hidden />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && <div className="text-xs text-muted">Yanıt hazırlanıyor…</div>}
          <div ref={endRef} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="border-t border-line p-3 flex gap-2"
        >
          <label htmlFor="assistant-input" className="sr-only">
            Sorunuz
          </label>
          <Input id="assistant-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Sorunuzu yazın" autoComplete="off" />
          <Button type="submit" loading={busy} icon={<Send className="w-4 h-4" aria-hidden />} className="shrink-0">
            Gönder
          </Button>
        </form>
      </Panel>
    </div>
  );
}
