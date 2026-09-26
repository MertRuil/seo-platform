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
    title: "🇹🇷 TR Mevzuat & Reklam Denetimi",
    prompt: "Sitemizi Türkiye Reklam Kurulu, TİTCK ve TBB mevzuatına göre tara; yasaklı sağlık beyanı veya haksız ticari iddiaları tespit et.",
  },
  {
    title: "🇪🇺 EU Mevzuat & Greenwashing",
    prompt: "Sitemizi Avrupa Birliği Direktiflerine göre tara: Directive 2024/825 (EmpCo greenwashing), EFSA Regulation 1924/2006 ve MiCA kurallarına uyumu incele.",
  },
  {
    title: "🇺🇸 US Mevzuat & FTC/FDA Denetimi",
    prompt: "Sitemizi ABD Federal Mevzuatına göre denetle: FTC Act Section 5, FDA (FD&C Act / DSHEA), SEC Rule 10b-5 ve FTC Green Guides uyumunu analiz et.",
  },
  {
    title: "🇬🇧 UK Mevzuat & ASA/CMA Denetimi",
    prompt: "Sitemizi Birleşik Krallık (UK) mevzuatına göre tara: ASA CAP Code Rule 12 (POMs & Botox), CMA Green Claims & DMCC Act 2024 ve FCA PS23/6 Kripto kurallarına uyumu incele.",
  },
  {
    title: "🌏 Asya / APAC Mevzuat & PMDA/SAMR",
    prompt: "Sitemizi Asya ve Pasifik (APAC) mevzuatına göre tara: Japonya Yakki-ho / Keihyo-ho (Stealth Marketing), Çin SAMR Reklam Kanunu (Art. 9) ve Singapur MAS kripto kurallarına uyumu incele.",
  },
  {
    title: "🇦🇪 BAE & Körfez / MENA Mevzuat Denetimi",
    prompt: "Sitemizi Orta Doğu / Körfez (BAE & Suudi Arabistan) mevzuatına göre denetle: BAE Medya Konseyi (55/2023), Suudi SFDA sağlık kuralları, GAMR Mawthooq (#إعلان) ve VARA/SAMA düzenlemelerini tara.",
  },
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

      if (lower.includes("mena") || lower.includes("bae") || lower.includes("uae") || lower.includes("dubai") || lower.includes("saudi") || lower.includes("suudi") || lower.includes("sfda") || lower.includes("mohap") || lower.includes("mawthooq") || lower.includes("vara")) {
        reply = {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          text: `🇦🇪 **Orta Doğu & Körfez (MENA / GCC) Bölgesi Mevzuat ve Reklam Denetimi:**\n\n1. **Kamu Ahlakı, İslami Değerler & Kumar/Alkol Yasağı (BAE 55/2023 & KSA M/17):** Online kumar, spor bahisleri ve izinsiz alkol teslimatı reklamları kesinlikle yasaktır (1.000.000 AED / SAR ceza ve TDRA/CITC erişim engeli).\n2. **MOHAP & Suudi SFDA Sağlık Beyanları:** "100% kesin kanser tedavisi", "diyabete son", "haftada 10 kilo garantili zayıflama" gibi tıbbi ve sağlık vaatleri resmi reklam lisans numarası olmaksızın suçtur.\n3. **Gizli Reklam & Mawthooq (موثوق) Lisansı:** Ücretli veya ticari menfaat sağlanan tüm tanıtımlarda açıkça Arapça/İngilizce #إعلان veya #Ad ibaresi zorunludur. Ruhsatsız tanıtımlara 500.000 SAR/AED para cezası uygulanır.\n4. **Kripto & Sanal Varlıklar (Dubai VARA & SAMA):** "Sıfır riskli yatırım", "günlük garantili getiri" vaatleri katı şekilde yasaklanmıştır (VARA tarafından 10.000.000 AED ceza).\n5. **Emlak Pazarlaması (Suudi Fal / Dubai RERA Trakheesi):** Emlak ilanlarında Suudi Fal Yetki Numarası veya Dubai Trakheesi İzin Numarası belirtilmeyen tanıtımlar portallardan ve arama motorlarından derhal kaldırılır.\n\nÖnerim: İçerik sekmesindeki **BAE & Körfez (MENA) Uyum Kalkanı** simülatörünü kullanarak Arapça ve İngilizce metinlerinizi güvenle denetleyin.`,
          timestamp: "Şimdi",
          sources: ["UAE Media Council (Federal Decree-Law 55/2023)", "Saudi SFDA Advertising Guidelines", "Dubai VARA Marketing Regulations", "Saudi GAMR Mawthooq License", "Dubai RERA Trakheesi"],
          actions: [
            { label: "MENA Mevzuat Kalkanını Aç", actionType: "GENERATE_CONTENT", href: "/content" },
            { label: "MENA Kelimeleri Denetle", actionType: "APPLY_FIX", href: "/keywords" },
          ],
        };
      } else if (lower.includes("uk") || lower.includes("ingiltere") || lower.includes("asa") || lower.includes("cma") || lower.includes("fca") || lower.includes("botox") || lower.includes("dmcc")) {
        reply = {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          text: `🇬🇧 **Birleşik Krallık (UK) Brexit Sonrası Reklam ve Mevzuat Denetimi:**\n\n1. **ASA CAP Code Rule 12 & Human Medicines Regulations 2012 (Reg 284):** Reçeteli ilaçların (POM) ve Botox gibi enjeksiyonların halka açık doğrudan veya dolaylı reklamı kesinlikle yasaktır.\n2. **CMA Green Claims Code & DMCC Act 2024:** Kanıtlanamayan çevreci iddialar için CMA, doğrudan mahkemesiz **küresel yıllık cironun %10'una kadar** idari para cezası kesme yetkisine sahiptir.\n3. **FCA PS23/6 Kripto Promosyonları:** Kripto para ve finansal reklamlarda zorunlu yasal risk uyarısı (*"Don't invest unless you're prepared to lose all the money you invest..."*) ve ilk alıcılar için 24 saatlik cayma süresi zorunludur.\n4. **DMCC Act & Sahte Kıtlık (Dark Patterns):** "Son 1 ürün kaldı acele edin" gibi yapay geri sayım sayaçları ve gizli damla fiyatlandırma (drip pricing) yasaktır.\n\nÖnerim: İçerik sekmesindeki **Birleşik Krallık (UK) Uyum Kalkanı** simülatörünü kullanarak İngiltere pazarına yönelik sayfalarınızı denetleyin.`,
          timestamp: "Şimdi",
          sources: ["UK Advertising Standards Authority (CAP Code Rule 12)", "CMA Digital Markets, Competition and Consumers Act 2024", "Financial Conduct Authority (FCA PS23/6)"],
          actions: [
            { label: "UK Mevzuat Kalkanını Aç", actionType: "GENERATE_CONTENT", href: "/content" },
            { label: "UK Kelimeleri Denetle", actionType: "APPLY_FIX", href: "/keywords" },
          ],
        };
      } else if (lower.includes("asia") || lower.includes("asya") || lower.includes("apac") || lower.includes("jcaa") || lower.includes("yakki") || lower.includes("pmda") || lower.includes("samr") || lower.includes("mas") || lower.includes("kftc")) {
        reply = {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          text: `🌏 **Asya & Pasifik (APAC) Bölgesi Mevzuat ve Reklam Denetimi:**\n\n1. **Japonya PMD Act (薬機法 - Yakki-ho Art. 66/68):** Kozmetik, gıda ve takviyelerde tıbbi tedavi/hastalık önleme iddiaları ("ガンが治る", "シミが消える", "若返り効果100%") yasaktır. İhlal halinde 2 yıla kadar hapis veya toplam cironun %4.5'ine varan idari para cezası verilir.\n2. **Japonya JCAA Stealth Marketing Yasağı (ステマ規制, Ekim 2023):** Sponsorlu veya teşvikli içeriklerde belirgin biçimde "#PR" veya "広告" etiketi yer almalıdır; gizli reklam ve sahte yorumlar şirketin cirosundan %3 kesinti cezası doğurur.\n3. **Çin SAMR Reklam Kanunu (中华人民共和国广告法 Madde 9):** "Ulusal Düzey" (国家级), "En Yüksek" (最高级), "En İyi" (最佳), "1 Numara" (第一) gibi kanıtlanamayan mutlak süperlatif ifadelerin kullanımı 100.000 - 1.000.000 RMB ceza gerektirir.\n4. **Güney Kore KFTC Backdoor Advertising (뒷광고):** Tüketiciyi aldatıcı gizli fenomen reklamları ve sahte incelemeler 500 milyon KRW veya cironun %2'si kadar ceza ile yaptırımlandırılır.\n5. **Singapur MAS Kripto Yönergeleri (DPT):** Kamuya açık mecralarda kripto para reklamı ve "guaranteed crypto yield" / "risk-free" vaatleri katı şekilde yasaklanmıştır.\n6. **Tütün & Vaping / Kumar Yasakları:** Singapur ve Güneydoğu Asya'da elektronik sigara (vape) satışı 10.000 SGD ceza ve 6 ay hapis; yasadışı online kumar siteleri anında engellenir.\n\nÖnerim: İçerik sekmesindeki **Asya / APAC Uyum Kalkanı** simülatörünü kullanarak Asya pazarına açılan içeriklerinizi güvenle denetleyin.`,
          timestamp: "Şimdi",
          sources: ["Japan PMD Act (Yakki-ho)", "JCAA Keihyo-ho (Stealth Marketing)", "China Advertising Law (SAMR Art. 9)", "Singapore MAS Digital Payment Token Guidelines", "Korea Fair Trade Commission (KFTC)"],
          actions: [
            { label: "Asya Mevzuat Kalkanını Aç", actionType: "GENERATE_CONTENT", href: "/content" },
            { label: "Asya Kelimeleri Denetle", actionType: "APPLY_FIX", href: "/keywords" },
          ],
        };

      } else if (lower.includes("us") || lower.includes("abd") || lower.includes("ftc") || lower.includes("fda") || lower.includes("sec") || lower.includes("dshea") || lower.includes("ryan haight")) {
        reply = {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          text: `🇺🇸 **Amerika Birleşik Devletleri Federal Mevzuat ve Reklam Denetimi:**\n\n1. **FTC Act Section 5 & Sahte Yorumlar (16 CFR Part 464):** Tüketiciyi aldatıcı ticari uygulamalar ve teşvik edilmiş/sahte kullanıcı yorumları ihlal başına 51.744 $'a varan doğrudan hukuki para cezasına tabidir.\n2. **FTC Made in USA Kuralı (16 CFR Part 323):** Ürünün tamamı veya neredeyse tamamı ABD'de üretilmedikçe niteliksiz "Made in USA" demek yasaktır.\n3. **FDA & DSHEA (21 U.S.C. § 343(r)(6)):** Gıda takviyelerinde hastalık tedavi/önleme iddiaları yasaktır ve zorunlu FDA feragatnamesi (*"These statements have not been evaluated by the FDA..."*) gereklidir.\n4. **Reçeteli İlaçlar & Ryan Haight Act (21 U.S.C. § 829):** Reçetesiz Ozempic, Xanax gibi ilaçların internetten satışı/reklamı federal suçtur (20 yıla kadar hapis).\n5. **SEC Rule 10b-5 & Kripto:** Kripto ve sermaye piyasalarında "guaranteed returns" ve risksiz kazanç vaatleri menkul kıymet dolandırıcılığı kapsamında kovuşturulur.\n6. **FTC Green Guides:** Karbon ofsetine dayalı asılsız "carbon neutral" iddiaları aldatıcı pazarlama sayılır.\n\nÖnerim: İçerik sekmesindeki **ABD Mevzuat Kalkanı** simülatörünü kullanarak metinlerinizi FTC ve FDA kurallarına uygun hale getirin.`,
          timestamp: "Şimdi",
          sources: ["Federal Trade Commission (16 CFR Part 464)", "FDA FD&C Act / DSHEA", "SEC Rule 10b-5", "CFPB Regulation Z"],
          actions: [
            { label: "US Mevzuat Kalkanını Aç", actionType: "GENERATE_CONTENT", href: "/content" },
            { label: "US Kelimeleri Denetle", actionType: "APPLY_FIX", href: "/keywords" },
          ],
        };
      } else if (lower.includes("eu") || lower.includes("avrupa") || lower.includes("greenwashing") || lower.includes("empco") || lower.includes("efsa") || lower.includes("mica")) {
        reply = {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          text: `Avrupa Birliği direktifleri ve tüzüklerine göre (EU Compliance Shield) siteniz taranmış ve 5 kritik uyumsuzluk alanı belirlenmiştir:\n\n1. **Greenwashing & Çevre İddiaları (Directive (EU) 2024/825 EmpCo):** Karbon kredisi/ofsetlemeye dayalı "carbon neutral", "climate positive", "CO2 neutral" iddiaları yasaklanmıştır. "100% eco-friendly" ifadesi resmi EU Ecolabel sertifikası olmaksızın kullanılamaz (Yıllık cironun %4'üne varan ceza).\n2. **Gıda & Takviyeler (EFSA Reg 1924/2006):** Kilo verme hızı veya miktarı vaat eden ("lose 10 kg in 2 weeks") veya hastalık önleme/tedavi iddiaları yasaktır.\n3. **Finans & Kripto (MiCA 2023/1114 & MiFID II):** Kripto ve yatırımlarda "guaranteed returns", "risk-free investment" vaatleri yasaktır.\n4. **Tüketici Fiyatlandırması (Omnibus 2019/2161):** "Cheapest in Europe" veya kanıtlanamayan fiyat süperlatifleri haksız ticari uygulama kapsamındadır.\n5. **İlaç & Sağlık (Directive 2001/83/EC):** Reçeteli ilaçların (POM) halka açık satışı ve "guaranteed cure" iddiaları yasaktır.\n\nÖnerim: İçerik sekmesindeki **Avrupa Birliği Uyum Kalkanı** simülatörünü çalıştırarak metinlerinizi AB standartlarına getirin.`,
          timestamp: "Şimdi",
          sources: ["Directive (EU) 2024/825 (EmpCo)", "Regulation (EC) No 1924/2006 (EFSA)", "Regulation (EU) 2023/1114 (MiCA)", "Directive 2001/83/EC"],
          actions: [
            { label: "EU Mevzuat Kalkanını Aç", actionType: "GENERATE_CONTENT", href: "/content" },
            { label: "Kelimeleri İncele", actionType: "APPLY_FIX", href: "/keywords" },
          ],
        };
      } else if (lower.includes("mevzuat") || lower.includes("titck") || lower.includes("reklam") || lower.includes("yasak")) {
        reply = {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          text: `Türkiye Cumhuriyeti Ticaret Bakanlığı Reklam Kurulu, TİTCK ve TBB mevzuatlarına göre siteniz taranmış ve sektörel uyum analizi tamamlanmıştır:\n\n1. **Sağlık & Tıbbi İddialar (TİTCK):** "Tedavi eder", "kesin şifa", "garantili sonuç" ve hekimler için "en iyi cerrah" ifadeleri kesinlikle yasaktır (12 Kasım 2025 tarihli Yönetmelik & 1219 sayılı Kanun).\n2. **Gıda Takviyeleri:** Takviyelerde "zayıflatır", "yağ yakar" veya "Sağlık Bakanlığı onaylı" denmesi en yüksek sınırdan idari para cezası ve ürün toplatma sebebidir.\n3. **Hukuk & Avukatlık (TBB):** "En iyi avukat", "dava kazanma garantisi" ve "ücretsiz danışmanlık" reklam yasağı kapsamındadır (1136 sayılı Kanun md. 55).\n4. **Kanıtlanamayan Üstünlükler:** "En ucuz", "rakipsiz fiyat" ifadeleri akredite pazar raporu olmadan kullanılamaz (2026 ceza tavanı: 8.635.800 TL).\n\nÖnerim: İçerik Optimizasyonu sekmesindeki **Mevzuat Uyum Kalkanı** ile metinlerinizi anında tarayın ve tek tıkla düzeltin.`,
          timestamp: "Şimdi",
          sources: ["T.C. Ticaret Bakanlığı Reklam Kurulu Kararları", "TİTCK Tanıtım ve Bilgilendirme Yönetmeliği", "TBB Reklam Yasağı Yönetmeliği"],
          actions: [
            { label: "Mevzuat Kalkanını Aç", actionType: "GENERATE_CONTENT", href: "/content" },
            { label: "Kelimeleri Denetle", actionType: "APPLY_FIX", href: "/keywords" },
          ],
        };
      } else if (lower.includes("trafik") || lower.includes("düşüş")) {
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
