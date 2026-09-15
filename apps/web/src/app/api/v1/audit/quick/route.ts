import { NextRequest, NextResponse } from "next/server";
import { validateSafeAuditUrl, safeAuditFetch, SSRFSecurityError } from "@/lib/ssrf";

export const dynamic = "force-dynamic";

// IP tabanlı istek kotası: 60 saniyede maksimum 5 analiz
const IP_AUDIT_HISTORY = new Map<string, number[]>();
const MAX_AUDITS_PER_MINUTE = 5;

function checkRateLimit(clientIp: string): boolean {
  const now = Date.now();
  const history = IP_AUDIT_HISTORY.get(clientIp) || [];
  const recent = history.filter(t => now - t < 60000);
  if (recent.length >= MAX_AUDITS_PER_MINUTE) {
    IP_AUDIT_HISTORY.set(clientIp, recent);
    return false;
  }
  recent.push(now);
  IP_AUDIT_HISTORY.set(clientIp, recent);
  return true;
}

interface IssueDetail {
  rule_id: string;
  title: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  recommendation: string;
}

interface AiRecommendation {
  agent: string;
  title: string;
  priority_score: number;
  description: string;
  reason: string;
  expected_impact: string;
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    if (!checkRateLimit(clientIp)) {
      return NextResponse.json(
        { detail: "Hızlı denetim istek kotasına ulaştınız (dakikada maksimum 5 analiz). Lütfen biraz bekleyin." },
        { status: 429 }
      );
    }

    const body = await req.json();
    let targetUrl: string = body.url;

    if (!targetUrl) {
      return NextResponse.json(
        { detail: "URL adresi zorunludur." },
        { status: 400 }
      );
    }

    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      targetUrl = "https://" + targetUrl;
    }

    // SSRF Güvenlik Doğrulaması (Yerel ağ, loopback ve bulut metadata engelleme)
    try {
      const validatedUrlObj = await validateSafeAuditUrl(targetUrl);
      targetUrl = validatedUrlObj.href;
    } catch (ssrfErr: any) {
      return NextResponse.json(
        { detail: ssrfErr.message || "Geçersiz veya engellenen hedef URL (SSRF koruması)." },
        { status: 400 }
      );
    }

    // 1. Önce yerel Python FastAPI varsa ona iletmeyi dene
    const pythonBackend = process.env.BACKEND_API_URL;
    if (pythonBackend) {
      try {
        const pyRes = await fetch(`${pythonBackend}/audit/quick`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl, max_pages: body.max_pages || 5 }),
          signal: AbortSignal.timeout(6000)
        });
        if (pyRes.ok) {
          const pyData = await pyRes.json();
          return NextResponse.json(pyData);
        }
      } catch {
        // Python backend yoksa doğrudan yerleşik motorla devam et
      }
    }

    // 2. Vercel & Sunucusuz (Serverless) Yerleşik Canlı Analiz Motoru (SSRF ve DNS Rebinding Korumalı)
    const t0 = Date.now();
    let fetchResult;
    try {
      fetchResult = await safeAuditFetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        timeoutMs: 10000,
        maxRedirects: 5,
      });
    } catch (err: any) {
      const isSsrf =
        err instanceof SSRFSecurityError ||
        err.name === "SSRFSecurityError" ||
        (err.message && err.message.includes("SSRF"));
      return NextResponse.json(
        {
          detail: isSsrf
            ? `Yönlendirme güvenliği ihlali (SSRF): ${err.message}`
            : `Hedef web sitesine erişilemedi veya zaman aşımına uğradı: ${err.message}`,
        },
        { status: 400 }
      );
    }

    const finalUrl = fetchResult.finalUrl;
    const responseTimeMs = Date.now() - t0;
    const statusCode = fetchResult.statusCode;
    const html = fetchResult.text;

    // HTML Ayrıştırma (Tüm ECMAScript hedefleriyle tam uyumlu regex)
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : null;

    let metaDesc: string | null = null;
    const descMatch1 = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    const descMatch2 = html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    if (descMatch1) metaDesc = descMatch1[1].trim();
    else if (descMatch2) metaDesc = descMatch2[1].trim();

    let canonicalUrl: string | null = null;
    const canonMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
    if (canonMatch) canonicalUrl = canonMatch[1].trim();

    let viewport: string | null = null;
    const vpMatch1 = html.match(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']*)["']/i);
    const vpMatch2 = html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']viewport["']/i);
    if (vpMatch1) viewport = vpMatch1[1].trim();
    else if (vpMatch2) viewport = vpMatch2[1].trim();

    const isMobileFriendly = Boolean(
      viewport &&
      (viewport.includes("width=device-width") || viewport.includes("initial-scale")) &&
      !/width\s*=\s*\d+/i.test(viewport.replace(/width\s*=\s*device-width/gi, ""))
    );

    const hasNoindex =
      /<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html) ||
      (fetchResult.headers["x-robots-tag"] || "").toLowerCase().includes("noindex");

    const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
    const h1Count = h1Matches.length;

    // Görsel alt etiketi kontrolü
    const imgMatches = html.match(/<img[^>]+>/gi) || [];
    const missingAltCount = imgMatches.filter(img => !/alt=["'][^"']+["']/i.test(img)).length;

    // Metin kelime sayısı
    const cleanText = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    let wordCount = cleanText ? cleanText.split(" ").length : 0;

    // SPA / Client-side Rendered (Next.js & Nuxt) Hydration State Extract
    let spaTitle: string | null = null;
    let spaDesc: string | null = null;
    let spaH1: string | null = null;
    let spaExtraWords = 0;

    const nextDataMatch = html.match(/<script id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const parsed = JSON.parse(nextDataMatch[1]);
        const pProps = parsed?.props?.pageProps || {};
        if (pProps.title || pProps.metaTitle) spaTitle = String(pProps.title || pProps.metaTitle);
        if (pProps.description || pProps.metaDescription) spaDesc = String(pProps.description || pProps.metaDescription);
        if (pProps.h1 || pProps.heading || pProps.header) spaH1 = String(pProps.h1 || pProps.heading || pProps.header);
        const jsonStr = JSON.stringify(pProps);
        const matchedWords = jsonStr.match(/\b[A-Za-z0-9ğüşıöçĞÜŞİÖÇ]{3,}\b/g);
        if (matchedWords) spaExtraWords = matchedWords.length;
      } catch {}
    }

    const effectiveTitle = title || spaTitle;
    const effectiveMetaDesc = metaDesc || spaDesc;
    const effectiveH1Count = h1Count > 0 ? h1Count : (spaH1 ? 1 : 0);
    if (wordCount < 30 && spaExtraWords > 30) {
      wordCount = spaExtraWords;
    }

    // Schema / Structured Data Extraction (JSON-LD & Microdata)
    const schemaTypes: string[] = [];
    let hasStructuredData = false;
    let schemaSyntaxError = false;

    // JSON-LD scripts (handling case variants, CDATA, trailing commas, and @graph)
    const ldJsonMatches = html.match(/<script[^>]*type=["']application\/ld\+json[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const s of ldJsonMatches) {
      const contentMatch = s.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
      if (contentMatch && contentMatch[1].trim()) {
        const rawLd = contentMatch[1]
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\/\/.*/g, "")
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/,\s*([\]}])/g, "$1")
          .trim();
        try {
          const parsed = JSON.parse(rawLd);
          hasStructuredData = true;
          const items = Array.isArray(parsed) ? parsed : (parsed?.["@graph"] ? parsed["@graph"] : [parsed]);
          for (const item of items) {
            if (item && item["@type"]) {
              const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
              for (const t of types) {
                if (t && !schemaTypes.includes(String(t))) {
                  schemaTypes.push(String(t));
                }
              }
            }
          }
        } catch {
          schemaSyntaxError = true;
        }
      }
    }

    // HTML5 Microdata (itemscope & itemtype)
    const microdataMatches = html.match(/itemtype=["'](https?:\/\/[^"']+)["']/gi) || [];
    for (const m of microdataMatches) {
      const typeUrl = m.replace(/itemtype=["']/i, "").replace(/["']$/, "");
      const typeName = typeUrl.split("/").pop() || "";
      if (typeName && !schemaTypes.includes(typeName)) {
        schemaTypes.push(typeName);
        hasStructuredData = true;
      }
    }

    // HTML Dil Tanımlaması (<html lang="..."> veya xml:lang)
    const langMatch = html.match(/<html[^>]*\blang=["']([^"']+)["']/i) || html.match(/<html[^>]*\bxml:lang=["']([^"']+)["']/i);
    const htmlLang = langMatch ? langMatch[1].trim() : (fetchResult.headers["content-language"]?.split(",")[0]?.trim() || null);

    // Hreflang Alternatif Bağlantıları (<link rel="alternate" hreflang="..." href="...">)
    interface HreflangEntry {
      lang: string;
      href: string;
    }
    const hreflangs: HreflangEntry[] = [];
    const linkTags = html.match(/<link[^>]+>/gi) || [];
    for (const lt of linkTags) {
      const relM = lt.match(/rel=["']?([^"'>\s]+)["']?/i);
      const rel = relM ? relM[1].toLowerCase() : "";
      if (rel.includes("alternate")) {
        const langM = lt.match(/hreflang=["']?([^"'>\s]+)["']?/i);
        const hrefM = lt.match(/href=["']?([^"'>\s]+)["']?/i);
        if (langM && hrefM) {
          try {
            const fullHref = new URL(hrefM[1], finalUrl).href;
            hreflangs.push({ lang: langM[1].trim(), href: fullHref });
          } catch {
            hreflangs.push({ lang: langM[1].trim(), href: hrefM[1].trim() });
          }
        }
      }
    }

    // robots.txt ve sitemap.xml kontrolü (SSRF ve DNS Rebinding korumalı)
    let robotsOk = false;
    let sitemapOk = false;
    try {
      const robotsUrl = new URL("/robots.txt", finalUrl).href;
      const rResp = await safeAuditFetch(robotsUrl, { timeoutMs: 5000, maxRedirects: 2 });
      robotsOk = rResp.statusCode >= 200 && rResp.statusCode < 400;
    } catch {}

    try {
      const sitemapUrl = new URL("/sitemap.xml", finalUrl).href;
      const sResp = await safeAuditFetch(sitemapUrl, { timeoutMs: 5000, maxRedirects: 2 });
      sitemapOk = sResp.statusCode >= 200 && sResp.statusCode < 400;
      if (!sitemapOk) {
        const sitemapIndexUrl = new URL("/sitemap_index.xml", finalUrl).href;
        const siResp = await safeAuditFetch(sitemapIndexUrl, { timeoutMs: 5000, maxRedirects: 2 });
        sitemapOk = siResp.statusCode >= 200 && siResp.statusCode < 400;
      }
    } catch {}

    // Deterministik Kural Değerlendirmesi
    const issues: IssueDetail[] = [];
    let score = 100;

    // 1. HTTP Yanıt Kodu Kontrolleri (200, 301, 302, 404, 410, 5xx)
    if (statusCode >= 500) {
      score -= 50;
      issues.push({
        rule_id: "RULE_HTTP_5XX_ERROR",
        title: statusCode === 503 
          ? "Hizmet Kullanılamıyor (HTTP 503 Service Unavailable)" 
          : statusCode === 502 
          ? "Geçersiz Ağ Geçidi (HTTP 502 Bad Gateway)" 
          : `Sunucu Hatası (HTTP ${statusCode})`,
        severity: "CRITICAL",
        description: `Sunucu HTTP ${statusCode} durum kodu döndürdü. Arama motoru botlarının taramasını tamamen durdurur.`,
        recommendation: "Web sunucusu ve uygulama hata loglarını kontrol ederek arka uçtaki istisnayı giderin."
      });
    } else if (statusCode === 404) {
      score -= 40;
      issues.push({
        rule_id: "RULE_HTTP_4XX_CLIENT_ERROR",
        title: "Sayfa Bulunamadı (HTTP 404 Not Found)",
        severity: "HIGH",
        description: "İstenen URL sunucuda bulunamadı (404). Ziyaretçiler ve arama motorları kırık link ile karşılaşır.",
        recommendation: "Sayfa yanlışlıkla silindiyse geri yükleyin; yeri değiştiyse en alakalı canlı sayfaya 301 kalıcı yönlendirme yapın."
      });
    } else if (statusCode === 410) {
      score -= 40;
      issues.push({
        rule_id: "RULE_HTTP_4XX_CLIENT_ERROR",
        title: "Sayfa Kalıcı Olarak Kaldırıldı (HTTP 410 Gone)",
        severity: "HIGH",
        description: "İstenen kaynak kalıcı ve kasıtlı olarak kaldırılmış (410 Gone). Googlebot bu sayfayı dizinden 404'e kıyasla çok daha hızlı düşürür.",
        recommendation: "Kaldırma kasıtlı ise bu sayfaya verilen tüm iç bağlantıları siteden temizleyin. Yanlışlıkla ise sayfayı geri yükleyin."
      });
    } else if (statusCode >= 400) {
      score -= 35;
      issues.push({
        rule_id: "RULE_HTTP_4XX_CLIENT_ERROR",
        title: `İstemci Hatası (HTTP ${statusCode})`,
        severity: "HIGH",
        description: `Sunucu HTTP ${statusCode} istemci hatası yanıtı verdi.`,
        recommendation: "URL yapısını ve istemci izinlerini kontrol edin."
      });
    } else if (statusCode === 302 || statusCode === 307) {
      score -= 10;
      issues.push({
        rule_id: "RULE_TEMPORARY_REDIRECT_302",
        title: `Geçici Yönlendirme Tespit Edildi (HTTP ${statusCode})`,
        severity: "MEDIUM",
        description: `Sayfa HTTP ${statusCode} geçici yönlendirme döndürüyor. Arama motorları bağlantı otoritesini (PageRank) aktarmayabilir.`,
        recommendation: "Kalıcı taşımalar ve mimari URL yönlendirmeleri için 301 kalıcı yönlendirme kullanın."
      });
    }

    // 2. Yönlendirme Döngüsü (Loop) ve Yönlendirme Zinciri (Chain) Kontrolleri
    if (fetchResult.isRedirectLoop) {
      score -= 40;
      issues.push({
        rule_id: "RULE_REDIRECT_LOOP",
        title: "Yönlendirme Döngüsü Tespit Edildi (Redirect Loop)",
        severity: "CRITICAL",
        description: `Sayfa sonsuz bir yönlendirme döngüsüne giriyor (${fetchResult.redirectChain?.length || 0} yönlendirme adımı). Arama motorları ve kullanıcılar sayfaya erişemez.`,
        recommendation: "Yönlendirme kurallarını kontrol edin ve döngüyü kırarak son canlı sayfaya doğrudan 200 OK yanıtı verin."
      });
    } else if (fetchResult.redirectChain && fetchResult.redirectChain.length > 1) {
      score -= 20;
      issues.push({
        rule_id: "RULE_REDIRECT_CHAIN",
        title: `Yönlendirme Zinciri Tespit Edildi (${fetchResult.redirectChain.length} Adım)`,
        severity: "HIGH",
        description: `Sayfa hedefe ulaşmadan önce ${fetchResult.redirectChain.length} kez yönlendirildi (${fetchResult.redirectChain.map(h => `${h.fromUrl} -> ${h.toUrl}`).join(" -> ")}). Tarama bütçesini tüketir ve sayfa yükleme hızını düşürür.`,
        recommendation: "İlk sayfayı doğrudan nihai hedef URL'ye 301 yönlendirmesi yaparak aradaki ara yönlendirme adımlarını kaldırın."
      });
    }

    // 3. İçerik ve Başlık Denetimleri (Yalnızca 200 OK yanıt veren sayfalarda değerlendirilir)
    if (statusCode === 200) {
      if (!effectiveTitle) {
        score -= 20;
        issues.push({
          rule_id: "TITLE_MISSING",
          title: "Sayfa Başlığı (<title>) Bulunamadı",
          severity: "CRITICAL",
          description: "Sayfada <title> etiketi bulunmuyor. Arama motorları dizinleme yaparken sayfa kimliğini tespit edemez.",
          recommendation: "Sayfanın <head> bölümüne birincil anahtar kelimeyi ve marka adını içeren özgün bir <title> etiketi ekleyin."
        });
      } else if (effectiveTitle.length < 20 || effectiveTitle.length > 70) {
        score -= 10;
        issues.push({
          rule_id: "TITLE_LENGTH",
          title: "Sayfa Başlığı Uzunluğu Optimize Edilmemiş",
          severity: "MEDIUM",
          description: `Başlık şu an ${effectiveTitle.length} karakter. Arama motorlarında ideal başlık aralığı 40-60 karakterdir.`,
          recommendation: "Başlığınızı arama niyetine uygun olacak şekilde 40-60 karakter arasında düzenleyin."
        });
      }

      if (!effectiveMetaDesc) {
        score -= 15;
        issues.push({
          rule_id: "META_DESC_MISSING",
          title: "Meta Açıklaması (Description) Eksik",
          severity: "HIGH",
          description: "Sayfada <meta name=\"description\"> tanımlanmamış. Google arama sonuçlarında rastgele metin çekmektedir.",
          recommendation: "120-160 karakter uzunluğunda, harekete geçirici mesaj içeren zengin bir meta açıklaması ekleyin."
        });
      } else if (effectiveMetaDesc.length < 50 || effectiveMetaDesc.length > 170) {
        score -= 5;
        issues.push({
          rule_id: "META_DESC_LENGTH",
          title: "Meta Açıklaması Karakter Sınırı Uyumsuzluğu",
          severity: "LOW",
          description: `Meta açıklaması ${effectiveMetaDesc.length} karakter uzunluğundadır (Önerilen: 120-160 karakter).`,
          recommendation: "Meta açıklamasını arama motorlarında kesintiye uğramayacak şekilde 120-160 karaktere optimize edin."
        });
      }

      if (!canonicalUrl) {
        score -= 15;
        issues.push({
          rule_id: "CANONICAL_MISSING",
          title: "rel=canonical Etiketi Eksik",
          severity: "HIGH",
          description: "Sayfada orijinal URL referansını belirten canonical etiketi bulunmamaktadır. Yinelenen içerik riski mevcuttur.",
          recommendation: `<link rel="canonical" href="${finalUrl}" /> etiketini sayfanın <head> bölümüne ekleyin.`
        });
      }

      if (effectiveH1Count === 0) {
        score -= 10;
        issues.push({
          rule_id: "H1_MISSING",
          title: "H1 Başlık Etiketi Bulunamadı",
          severity: "HIGH",
          description: "Sayfada ana başlığı temsil eden bir <h1> etiketi bulunmuyor.",
          recommendation: "Sayfanın ana konusunu ve hedef anahtar kelimelerini içeren tek bir <h1> etiketi yerleştirin."
        });
      } else if (effectiveH1Count > 1) {
        score -= 5;
        issues.push({
          rule_id: "H1_MULTIPLE",
          title: "Birden Fazla H1 Başlık Etiketi Tespit Edildi",
          severity: "LOW",
          description: `Sayfada ${effectiveH1Count} adet <h1> etiketi bulundu. Sayfa başına tek bir hiyerarşik <h1> etiketi kullanılması önerilir.`,
          recommendation: "Ana başlık için tek bir <h1> bırakın, alt başlıkları <h2> ve <h3> olarak düzenleyin."
        });
      }

      if (missingAltCount > 0) {
        score -= 5;
        issues.push({
          rule_id: "IMG_ALT_MISSING",
          title: `${missingAltCount} Adet Görselde Alt Etiketi Eksik`,
          severity: "LOW",
          description: "Bazı görsellerde arama motorlarının görseli anlamasını sağlayan alt=\"...\" açıklaması bulunmuyor.",
          recommendation: "Görsellere içeriği betimleyen açıklayıcı alt etiketleri ekleyin."
        });
      }

      // Mobil Uyumluluk ve Viewport Kontrolleri (Google Mobile-First Indexing)
      if (!viewport) {
        score -= 15;
        issues.push({
          rule_id: "RULE_MOBILE_VIEWPORT_MISSING",
          title: "Mobil Viewport Meta Etiketi Eksik",
          severity: "HIGH",
          description: "Sayfada <meta name=\"viewport\"> etiketi bulunmuyor. Mobil cihazlarda sayfa masaüstü genişliğinde render edilir ve arama motorları mobil uyumsuzluk nedeniyle sıralama cezası uygular.",
          recommendation: '<meta name="viewport" content="width=device-width, initial-scale=1"> etiketini sayfanın <head> bölümüne ekleyin.'
        });
      } else {
        const vpLower = viewport.toLowerCase();
        if (!vpLower.includes("width=device-width") && /width\s*=\s*\d+/.test(vpLower)) {
          score -= 10;
          issues.push({
            rule_id: "RULE_MOBILE_VIEWPORT_INVALID",
            title: "Sabit veya Geçersiz Viewport Genişliği",
            severity: "MEDIUM",
            description: `Viewport etiketinde sabit piksel genişliği tanımlanmış (${viewport}). Sayfa farklı mobil ekran boyutlarına uyum sağlayamaz.`,
            recommendation: 'Sabit piksel genişliği yerine "width=device-width, initial-scale=1" duyarlı (responsive) ayarını kullanın.'
          });
        }
        if (vpLower.includes("user-scalable=no") || vpLower.includes("user-scalable=0") || vpLower.includes("maximum-scale=1")) {
          score -= 5;
          issues.push({
            rule_id: "RULE_MOBILE_VIEWPORT_ZOOM_RESTRICTED",
            title: "Mobil Yakınlaştırma (Zoom) Kısıtlanmış",
            severity: "LOW",
            description: "Viewport içeriğinde 'user-scalable=no' veya 'maximum-scale=1' tanımlanarak kullanıcının sayfayı yakınlaştırması engellenmiş. Bu durum WCAG erişilebilirlik standartlarına aykırıdır.",
            recommendation: "'user-scalable=no' direktifini kaldırarak kullanıcıların sayfayı yakınlaştırabilmesini sağlayın."
          });
        }
      }
      if (schemaSyntaxError) {
        score -= 10;
        issues.push({
          rule_id: "RULE_SCHEMA_SYNTAX_ERROR",
          title: "Yapılandırılmış Veri Sözdizimi Hatası (Schema Syntax Error)",
          severity: "HIGH",
          description: "Sayfadaki JSON-LD yapılandırılmış veri bloğunda JSON sözdizimi hatası tespit edildi. Arama motorları bu şemayı parse edemez.",
          recommendation: "JSON-LD kodundaki sözdizimi, eksik veya fazladan virgül/tırnak hatalarını Google Zengin Sonuçlar Testi ile kontrol ederek düzeltin."
        });
      }

      // Dil ve Hreflang Kontrolleri
      if (!htmlLang) {
        score -= 5;
        issues.push({
          rule_id: "RULE_HTML_LANG_MISSING",
          title: "HTML Dil Tanımlaması Eksik (<html lang='...'>)",
          severity: "MEDIUM",
          description: "Sayfanın <html> kök etiketinde 'lang' özniteliği tanımlanmamış. Arama motorları ve ekran okuyucu yardımcı teknolojiler sayfa dilini doğru tespit edemez.",
          recommendation: "Sayfanın kök etiketine <html lang=\"tr\"> veya uygun ISO 639-1 dil kodunu ekleyin."
        });
      }

      if (hreflangs.length > 0) {
        let hasSelfRef = false;
        const invalidCodes: string[] = [];
        const normFinal = finalUrl.replace(/\/$/, "");

        for (const h of hreflangs) {
          const code = h.lang.trim();
          const isXDefault = code.toLowerCase() === "x-default";
          const isValidFormat = isXDefault || /^[a-zA-Z]{2,3}(-[a-zA-Z]{4})?(-([a-zA-Z]{2}|\d{3}))?$/.test(code);
          if (!isValidFormat || code.includes("_")) {
            invalidCodes.push(code);
          }
          const hNorm = h.href.replace(/\/$/, "");
          if (hNorm === normFinal) {
            hasSelfRef = true;
          }
        }

        if (invalidCodes.length > 0) {
          score -= 10;
          issues.push({
            rule_id: "RULE_HREFLANG_INVALID_CODE",
            title: "Geçersiz Hreflang Dil/Bölge Kodu",
            severity: "MEDIUM",
            description: `Hreflang etiketlerinde geçersiz dil/bölge kodları bulundu (${invalidCodes.join(", ")}). ISO 639-1 dil kodu ve kısa çizgi (-) ile ISO 3166-1 ülke kodu kullanılmalıdır (örn. 'en-US', 'tr').`,
            recommendation: "Hreflang kodlarındaki alt çizgileri (_) kısa çizgiye (-) çevirin ve resmi ISO kodlarını kullanın."
          });
        }

        if (!hasSelfRef) {
          score -= 10;
          issues.push({
            rule_id: "RULE_HREFLANG_MISSING_SELF_REFERENCE",
            title: "Kendine Referans Veren (Self-Referential) Hreflang Eksik",
            severity: "MEDIUM",
            description: "Sayfa hreflang alternatifleri içeriyor fakat kendi URL'sine işaret eden bir hreflang etiketi bulundurmuyor. Google Search Central yönergelerine göre her dil varyantı kendisini de alternate olarak listelemelidir.",
            recommendation: `<link rel="alternate" hreflang="${htmlLang || 'tr'}" href="${finalUrl}" /> etiketini sayfanın <head> bölümüne ekleyin.`
          });
        }
      }
    }

    if (!robotsOk) {
      score -= 10;
      issues.push({
        rule_id: "ROBOTS_TXT_404",
        title: "robots.txt Dosyası Bulunamadı (404)",
        severity: "MEDIUM",
        description: "Sitenin kök dizininde robots.txt dosyası bulunmamaktadır.",
        recommendation: "Arama motoru botlarına rehberlik etmek için sitenizin ana dizinine bir robots.txt dosyası yükleyin."
      });
    }

    if (!sitemapOk) {
      score -= 10;
      issues.push({
        rule_id: "SITEMAP_404",
        title: "sitemap.xml Site Haritası Bulunamadı (404)",
        severity: "MEDIUM",
        description: "Sitenin ana dizininde sitemap.xml dosyası tespit edilemedi.",
        recommendation: "Tüm sayfalarınızın hızlı taranabilmesi için dinamik bir XML site haritası oluşturun ve Google'a bildirin."
      });
    }

    const healthScore = Math.max(10, Math.min(100, score));

    // AI Uzman Ajan Önerileri (Google Search Central Kılavuzu Esaslı)
    const aiRecommendations: AiRecommendation[] = [
      {
        agent: "TechnicalSeoAgent",
        title: "Kritik Tarama ve İndeksleme Sinyallerini Düzeltin",
        priority_score: 95,
        description: !canonicalUrl
          ? "Canonical etiketi eksikliği, arama motorlarının farklı URL varyantlarını parçalamasına yol açabilir."
          : "robots.txt ve sitemap.xml uyumluluğu Googlebot tarama verimliliğini %30 artırır.",
        reason: "Google Search Central: Özgün URL sinyalleri ve site haritaları olmadan dizinleme bütçesi verimsiz kullanılır.",
        expected_impact: "Tüm sayfaların eksiksiz dizine eklenmesi ve tarama bütçesi korunması."
      },
      {
        agent: "ContentSeoAgent",
        title: "Arama Niyetine (Search Intent) Odaklı Snippet İyileştirmesi",
        priority_score: 88,
        description: `Başlık (${title || "Eksik"}) ve açıklama metnini kullanıcıların tıklama oranını (TO) artıracak şekilde güncelleyin.`,
        reason: "Zenginleştirilmiş ve arama niyetini karşılayan snippet'lar organik tıklama oranını %15-%25 oranında artırır.",
        expected_impact: "SERP sonuçlarında tıklama oranında (CTR) net artış."
      },
      {
        agent: "SchemaMarkupAgent",
        title: "JSON-LD Yapılandırılmış Veri (Schema.org) Entegrasyonu",
        priority_score: 82,
        description: "Sitenize Organization veya WebSite tipinde Schema.org JSON-LD yapılandırılmış veri ekleyin.",
        reason: "Arama motorlarına işletme veya sitenin kurumsal varlığını makine tarafından okunabilir semantik formatta sunar.",
        expected_impact: "Arama sonuçlarında zengin önizleme (Rich Snippet) ve marka otoritesi."
      }
    ];

    return NextResponse.json({
      url: finalUrl,
      status_code: statusCode,
      health_score: healthScore,
      page_info: {
        url: finalUrl,
        status_code: statusCode,
        title: title || null,
        meta_description: metaDesc || null,
        canonical_url: canonicalUrl || null,
        has_noindex: hasNoindex,
        word_count: wordCount,
        response_time_ms: responseTimeMs,
        viewport: viewport || null,
        is_mobile_friendly: isMobileFriendly,
        has_structured_data: hasStructuredData,
        schema_types: schemaTypes,
        html_lang: htmlLang,
        hreflangs: hreflangs,
        has_hreflang: hreflangs.length > 0
      },
      issues,
      ai_recommendations: aiRecommendations
    });
  } catch (error: any) {
    return NextResponse.json(
      { detail: `Canlı analiz sırasında beklenmeyen bir hata oluştu: ${error.message}` },
      { status: 500 }
    );
  }
}
