/**
 * AI yanıt motorları için hazırlık denetimi (ölçüm değil, erişim ve sinyal kontrolü).
 * robots.txt, llms.txt ve ana sayfa HTML'inden gerçekten okunabilen bilgilerle çalışır;
 * "ChatGPT'de görünüyorsunuz" gibi ölçülmemiş bir iddia üretmez.
 */

import { scanHtml } from "./html-signals";

export type BotPurpose = "search" | "user" | "training";
export type AccessStatus = "allowed" | "blocked" | "partial" | "unknown";

export interface AiBot {
  token: string;
  company: string;
  purpose: BotPurpose;
  /** Kullanıcı dilinde ne işe yaradığı */
  role: string;
}

/** Yaygın AI ve arama tarayıcıları. Amaçlar sağlayıcıların kendi belgelerine göredir. */
export const AI_BOTS: AiBot[] = [
  { token: "OAI-SearchBot", company: "OpenAI", purpose: "search", role: "ChatGPT arama sonuçlarında sitenizin gösterilmesi" },
  { token: "ChatGPT-User", company: "OpenAI", purpose: "user", role: "Kullanıcı ChatGPT'de sayfanızı açtığında" },
  { token: "GPTBot", company: "OpenAI", purpose: "training", role: "OpenAI modellerinin eğitimi" },
  { token: "PerplexityBot", company: "Perplexity", purpose: "search", role: "Perplexity yanıtlarında kaynak olarak gösterilme" },
  { token: "Claude-SearchBot", company: "Anthropic", purpose: "search", role: "Claude web aramasında kaynak olarak gösterilme" },
  { token: "ClaudeBot", company: "Anthropic", purpose: "training", role: "Anthropic modellerinin eğitimi" },
  { token: "Googlebot", company: "Google", purpose: "search", role: "Google Arama ve AI Overviews (AI Genel Bakış)" },
  { token: "Google-Extended", company: "Google", purpose: "training", role: "Gemini modellerinin eğitimi; Google Arama sıralamasını etkilemez" },
  { token: "Bingbot", company: "Microsoft", purpose: "search", role: "Bing ve Copilot yanıtları" },
  { token: "Applebot-Extended", company: "Apple", purpose: "training", role: "Apple Intelligence modellerinin eğitimi" },
  { token: "CCBot", company: "Common Crawl", purpose: "training", role: "Birçok modelin kullandığı açık eğitim verisi" },
];

interface RobotsGroup {
  agents: string[];
  rules: Array<{ allow: boolean; path: string }>;
}

export interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: string[];
}

/** RFC 9309'a göre robots.txt ayrıştırır: ardışık user-agent satırları tek grup oluşturur. */
export function parseRobots(text: string): ParsedRobots {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if (key === "allow" || key === "disallow") {
      lastWasAgent = false;
      if (!current) continue;
      if (key === "disallow" && value === "") continue; // boş Disallow = her şeye izin
      current.rules.push({ allow: key === "allow", path: value });
    } else if (key === "sitemap") {
      sitemaps.push(value);
    } else {
      lastWasAgent = false;
    }
  }
  return { groups, sitemaps };
}

function pathMatches(pattern: string, path: string): boolean {
  // * herhangi dizi, sondaki $ satır sonu
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern).replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp("^" + body + (anchored ? "$" : "")).test(path);
}

/** Belirli bir yol için izin: en uzun eşleşen kural kazanır, eşitlikte Allow kazanır. */
export function isPathAllowed(rules: RobotsGroup["rules"], path: string): { allowed: boolean; rule?: string } {
  let best: { allow: boolean; path: string } | null = null;
  for (const r of rules) {
    if (!pathMatches(r.path, path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow && !best.allow)) best = r;
  }
  if (!best) return { allowed: true };
  return { allowed: best.allow, rule: `${best.allow ? "Allow" : "Disallow"}: ${best.path}` };
}

export interface BotAccess extends AiBot {
  status: AccessStatus;
  /** Hangi grup uygulandı: bota özel, genel (*) ya da hiç kural yok */
  source: "specific" | "wildcard" | "none";
  rule?: string;
}

export function summarizeAnswerBotAccess(bots: BotAccess[]) {
  const answerBots = bots.filter((b) => b.purpose !== "training");
  const blocked = answerBots.filter((b) => b.status === "blocked").map((b) => b.token);
  const unknown = answerBots.filter((b) => b.status === "unknown").map((b) => b.token);
  const accessible = answerBots.filter((b) => b.status === "allowed" || b.status === "partial").length;
  const summary = answerBots.length === 0
    ? "AI tarayıcı erişimi denetlenemedi."
    : [blocked.length ? `${blocked.join(", ")} robots.txt ile engelli.` : "", unknown.length ? `${unknown.join(", ")} için erişim bilinmiyor.` : ""].filter(Boolean).join(" ") || "Arama ve yanıt tarayıcıları robots.txt kurallarına göre erişime açık.";
  return { blocked, unknown, accessible, total: answerBots.length, summary };
}

export function evaluateBot(robots: ParsedRobots | null, bot: AiBot): BotAccess {
  if (!robots) return { ...bot, status: "allowed", source: "none" };
  const token = bot.token.toLowerCase();
  // Ürün belirteci büyük/küçük harf duyarsız ve tam eşleşir (RFC 9309).
  const specific = robots.groups.filter((g) => g.agents.includes(token));
  const wildcard = robots.groups.filter((g) => g.agents.includes("*"));
  const applied = specific.length > 0 ? specific : wildcard;
  if (applied.length === 0) return { ...bot, status: "allowed", source: "none" };
  const rules = applied.flatMap((g) => g.rules);
  const root = isPathAllowed(rules, "/");
  const source = specific.length > 0 ? "specific" : "wildcard";
  if (!root.allowed) return { ...bot, status: "blocked", source, rule: root.rule };
  const restricted = rules.find((r) => !r.allow && r.path !== "/");
  return restricted ? { ...bot, status: "partial", source, rule: `Disallow: ${restricted.path}` } : { ...bot, status: "allowed", source };
}

export type CheckStatus = "pass" | "warn" | "fail" | "info";

export interface ReadinessCheck {
  id: string;
  label: string;
  status: CheckStatus;
  finding: string;
  why: string;
  action?: string;
  snippet?: string;
}

export interface HtmlSignals {
  title: string | null;
  metaDescription: string | null;
  robotsDirectives: string;
  jsonLdTypes: string[];
  wordCount: number;
}

export function extractHtmlSignals(html: string, xRobotsTag = ""): HtmlSignals {
  const scanned = scanHtml(html);
  const title = scanned.tags.find((t) => t.name === "title")?.body?.trim().replace(/\s+/g, " ") || null;
  const metas = scanned.tags.filter((t) => t.name === "meta");
  const meta = metas.find((t) => t.attrs.name?.toLowerCase() === "description")?.attrs.content;
  const robotsMeta = metas.filter((t) => ["robots", "googlebot"].includes(t.attrs.name?.toLowerCase())).map((t) => t.attrs.content || "");
  const jsonLdTypes = new Set<string>();
  for (const tag of scanned.tags) {
    if (tag.name !== "script" || tag.attrs.type?.toLowerCase() !== "application/ld+json" || !tag.body) continue;
    let nodes: unknown[];
    try { nodes = [JSON.parse(tag.body)]; } catch { continue; }
    while (nodes.length) {
      const node = nodes.pop();
      if (!node || typeof node !== "object") continue;
      const obj = node as Record<string, unknown>;
      const types = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
      for (const type of types) if (typeof type === "string" && type.trim()) jsonLdTypes.add(type.trim());
      // Reverse preserves document order with an iterative stack (no recursion limit).
      const values = Object.values(obj);
      for (let i = values.length - 1; i >= 0; i--) if (values[i] && typeof values[i] === "object") nodes.push(values[i]);
    }
  }
  const text = scanned.text
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    title,
    metaDescription: meta?.trim() || null,
    robotsDirectives: [...robotsMeta, xRobotsTag].join(",").toLowerCase(),
    jsonLdTypes: Array.from(jsonLdTypes),
    wordCount: text ? text.split(" ").length : 0,
  };
}

export function buildChecks(input: {
  robotsStatus: number | null;
  bots: BotAccess[];
  llmsTxt: boolean;
  sitemapFound: boolean;
  html: HtmlSignals | null;
  homepageStatus: number | null;
}): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [];
  const searchBlocked = input.bots.filter((b) => (b.purpose === "search" || b.purpose === "user") && b.status === "blocked");
  const access = summarizeAnswerBotAccess(input.bots);

  if (input.robotsStatus !== null && input.robotsStatus >= 500) {
    checks.push({
      id: "robots-unreachable",
      label: "robots.txt okunamıyor",
      status: "fail",
      finding: `robots.txt sunucu hatası döndürüyor (HTTP ${input.robotsStatus}).`,
      why: "Tarayıcılar robots.txt sunucu hatası verdiğinde siteyi geçici olarak tamamen taramayı durdurabilir.",
      action: "robots.txt dosyasının 200 veya 404 döndürdüğünden emin olun.",
    });
  }

  checks.push(
    searchBlocked.length > 0
      ? {
          id: "search-bots",
          label: "Yanıt motorlarının erişimi",
          status: "fail",
          finding: `${searchBlocked.map((b) => b.token).join(", ")} robots.txt ile engellenmiş.`,
          why: "Bu tarayıcılar yanıtlarda kaynak göstermek için siteyi okur. Engelliyse içeriğiniz o motorun yanıtlarında kaynak olarak kullanılamaz.",
          action: "Görünmek istediğiniz motorların tarayıcılarına izin verin. Eğitim tarayıcılarını (GPTBot, Google-Extended, CCBot) ayrı olarak engellemeye devam edebilirsiniz.",
          snippet: searchBlocked.map((b) => `User-agent: ${b.token}\nAllow: /`).join("\n\n"),
        }
      : access.unknown.length > 0 || access.total === 0
        ? {
            id: "search-bots",
            label: "Yanıt motorlarının erişimi",
            status: "warn",
            finding: access.summary,
            why: "robots.txt okunamadığında tarayıcıların erişime açık olduğu doğrulanamaz.",
            action: "robots.txt erişimini kontrol edip denetimi yeniden çalıştırın.",
          }
        : {
          id: "search-bots",
          label: "Yanıt motorlarının erişimi",
          status: "pass",
          finding: "Arama ve yanıt tarayıcılarının hiçbiri robots.txt ile tamamen engellenmemiş.",
          why: "ChatGPT arama, Perplexity, Claude, Copilot ve Google AI Overviews sitenizi okuyabilir.",
        }
  );

  const html = input.html;
  if (!html) {
    checks.push({
      id: "homepage",
      label: "Ana sayfa okunamadı",
      status: "fail",
      finding: input.homepageStatus ? `Ana sayfa HTTP ${input.homepageStatus} döndürdü.` : "Ana sayfaya ulaşılamadı.",
      why: "Tarayıcılar ana sayfanıza ulaşamıyorsa site hakkında bilgi toplayamaz.",
      action: "Sayfanın herkese açık olduğunu ve 200 döndürdüğünü kontrol edin.",
    });
    return checks;
  }

  const snippetBlocked = /nosnippet|max-snippet\s*:\s*0\b/.test(html.robotsDirectives);
  const noindex = /noindex/.test(html.robotsDirectives);
  if (noindex || snippetBlocked) {
    checks.push({
      id: "snippet-directives",
      label: "Alıntı kısıtı",
      status: "fail",
      finding: noindex ? "Ana sayfa noindex yönergesi taşıyor." : "Ana sayfada nosnippet veya max-snippet:0 yönergesi var.",
      why: noindex
        ? "Noindex sayfa arama sonuçlarında ve AI Overviews'da hiç gösterilmez."
        : "Bu yönerge Google'ın sayfadan metin alıntılamasını engeller; sayfa AI Overviews'da kaynak metni olarak kullanılamaz.",
      action: noindex ? "Sayfanın dizine girmesini istiyorsanız noindex'i kaldırın." : "Tüm sayfa yerine yalnızca gizli kalması gereken bölümlere data-nosnippet ekleyin.",
    });
  } else {
    checks.push({
      id: "snippet-directives",
      label: "Alıntı kısıtı",
      status: "pass",
      finding: "Ana sayfada alıntıyı engelleyen noindex veya nosnippet yönergesi yok.",
      why: "Arama motorları sayfadan metin alıntılayabilir.",
    });
  }

  const wanted = ["Organization", "LocalBusiness", "WebSite", "Product", "Article", "FAQPage", "BlogPosting", "Service"];
  const found = html.jsonLdTypes;
  checks.push(
    found.length === 0
      ? {
          id: "structured-data",
          label: "Yapılandırılmış veri",
          status: "warn",
          finding: "Ana sayfada JSON-LD yapılandırılmış veri bulunamadı.",
          why: "Schema.org işaretlemesi markanızı, ürünlerinizi ve sık sorulan soruları makinelerin okuyabileceği biçimde tanımlar; yanıt motorlarının sayfayı doğru yorumlamasına yardım eder.",
          action: "En azından Organization ve WebSite şeması ekleyin; ürün ve hizmet sayfalarında Product veya Service kullanın.",
          snippet:
            '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": "Şirket adı",\n  "url": "https://siteniz.com",\n  "logo": "https://siteniz.com/logo.png"\n}\n</script>',
        }
      : {
          id: "structured-data",
          label: "Yapılandırılmış veri",
          status: found.some((t) => wanted.includes(t)) ? "pass" : "info",
          finding: `Ana sayfada şu şema türleri var: ${found.join(", ")}.`,
          why: "Yapılandırılmış veri yanıt motorlarının marka ve içerik bilgisini doğru eşlemesine yardım eder.",
        }
  );

  checks.push(
    html.wordCount < 150
      ? {
          id: "server-text",
          label: "Sunucudan gelen metin",
          status: "warn",
          finding: `Ana sayfanın ham HTML'inde yalnızca ${html.wordCount} kelime metin var.`,
          why: "AI tarayıcılarının çoğu JavaScript çalıştırmaz. İçerik tarayıcıda JavaScript ile oluşturuluyorsa bu tarayıcılar sayfayı boş görebilir.",
          action: "Önemli içeriği sunucu tarafında (SSR veya statik) oluşturun.",
        }
      : {
          id: "server-text",
          label: "Sunucudan gelen metin",
          status: "pass",
          finding: `Ana sayfanın ham HTML'inde ${html.wordCount} kelime metin var.`,
          why: "JavaScript çalıştırmayan tarayıcılar da içeriği okuyabilir.",
        }
  );

  checks.push(
    html.title && html.metaDescription
      ? { id: "title-meta", label: "Başlık ve açıklama", status: "pass", finding: "Ana sayfada başlık ve meta açıklama var.", why: "Yanıt motorları kaynağı tanıtırken bu metinleri kullanabilir." }
      : {
          id: "title-meta",
          label: "Başlık ve açıklama",
          status: "warn",
          finding: !html.title ? "Ana sayfada başlık etiketi yok." : "Ana sayfada meta açıklama yok.",
          why: "Başlık ve açıklama sitenin ne hakkında olduğunu tek cümlede söyler; arama sonuçlarında ve kaynak kartlarında gösterilir.",
          action: "Markanızı ve ne sunduğunuzu açıkça anlatan bir başlık ve 120-155 karakterlik açıklama yazın.",
        }
  );

  checks.push({
    id: "sitemap",
    label: "Site haritası",
    status: input.sitemapFound ? "pass" : "warn",
    finding: input.sitemapFound ? "Site haritası bulundu." : "robots.txt'te veya /sitemap.xml adresinde site haritası bulunamadı.",
    why: "Site haritası tarayıcılara hangi sayfaların önemli olduğunu ve ne zaman güncellendiğini söyler.",
    action: input.sitemapFound ? undefined : "XML site haritası oluşturup robots.txt'e Sitemap: satırı olarak ekleyin.",
  });

  checks.push({
    id: "llms-txt",
    label: "llms.txt",
    status: "info",
    finding: input.llmsTxt ? "/llms.txt dosyası var." : "/llms.txt dosyası yok.",
    why: "llms.txt, dil modellerine sitenin özetini sunmak için önerilmiş bir biçimdir. Büyük yanıt motorlarının kullandığı doğrulanmış bir standart değildir; eksikliği tek başına görünürlüğü düşürmez.",
    action: input.llmsTxt ? undefined : "İsteğe bağlı: sitenizin kısa açıklamasını ve en önemli sayfalarını listeleyen bir /llms.txt ekleyebilirsiniz.",
  });

  return checks;
}
