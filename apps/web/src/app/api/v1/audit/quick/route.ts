import { NextRequest, NextResponse } from "next/server";
import { validateSafeAuditUrl, SSRFSecurityError } from "@/lib/ssrf";

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

    // 2. Vercel & Sunucusuz (Serverless) Yerleşik Canlı Analiz Motoru
    const t0 = Date.now();
    let fetchResponse: Response;
    try {
      fetchResponse = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        redirect: "follow",
        signal: AbortSignal.timeout(10000)
      });
    } catch (err: any) {
      return NextResponse.json(
        { detail: `Hedef web sitesine erişilemedi veya zaman aşımına uğradı: ${err.message}` },
        { status: 400 }
      );
    }

    const finalUrl = fetchResponse.url;

    // Yönlendirme sonrası hedef adres için de SSRF doğrulaması
    try {
      await validateSafeAuditUrl(finalUrl);
    } catch (redirectSsrfErr: any) {
      return NextResponse.json(
        { detail: `Yönlendirme güvenliği ihlali (SSRF): Hedef yönlendirme adresi engellendi.` },
        { status: 400 }
      );
    }

    const responseTimeMs = Date.now() - t0;
    const statusCode = fetchResponse.status;
    const html = await fetchResponse.text();

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

    const hasNoindex = /<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html) ||
      (fetchResponse.headers.get("x-robots-tag") || "").toLowerCase().includes("noindex");

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
    const wordCount = cleanText ? cleanText.split(" ").length : 0;

    // robots.txt ve sitemap.xml canlı kontrolü (Açık yönlendirme ve SSRF kalkanı için redirect: 'manual')
    let robotsOk = false;
    let sitemapOk = false;
    try {
      const robotsUrl = new URL("/robots.txt", finalUrl).href;
      const rResp = await fetch(robotsUrl, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(3000) });
      robotsOk = rResp.ok;
    } catch {}

    try {
      const sitemapUrl = new URL("/sitemap.xml", finalUrl).href;
      const sResp = await fetch(sitemapUrl, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(3000) });
      sitemapOk = sResp.ok;
    } catch {}

    // Deterministik Kural Değerlendirmesi
    const issues: IssueDetail[] = [];
    let score = 100;

    if (!title) {
      score -= 20;
      issues.push({
        rule_id: "TITLE_MISSING",
        title: "Sayfa Başlığı (<title>) Bulunamadı",
        severity: "CRITICAL",
        description: "Sayfada <title> etiketi bulunmuyor. Arama motorları dizinleme yaparken sayfa kimliğini tespit edemez.",
        recommendation: "Sayfanın <head> bölümüne birincil anahtar kelimeyi ve marka adını içeren özgün bir <title> etiketi ekleyin."
      });
    } else if (title.length < 20 || title.length > 70) {
      score -= 10;
      issues.push({
        rule_id: "TITLE_LENGTH",
        title: "Sayfa Başlığı Uzunluğu Optimize Edilmemiş",
        severity: "MEDIUM",
        description: `Başlık şu an ${title.length} karakter. Arama motorlarında ideal başlık aralığı 40-60 karakterdir.`,
        recommendation: "Başlığınızı arama niyetine uygun olacak şekilde 40-60 karakter arasında düzenleyin."
      });
    }

    if (!metaDesc) {
      score -= 15;
      issues.push({
        rule_id: "META_DESC_MISSING",
        title: "Meta Açıklaması (Description) Eksik",
        severity: "HIGH",
        description: "Sayfada <meta name=\"description\"> tanımlanmamış. Google arama sonuçlarında rastgele metin çekmektedir.",
        recommendation: "120-160 karakter uzunluğunda, harekete geçirici mesaj içeren zengin bir meta açıklaması ekleyin."
      });
    } else if (metaDesc.length < 50 || metaDesc.length > 170) {
      score -= 5;
      issues.push({
        rule_id: "META_DESC_LENGTH",
        title: "Meta Açıklaması Karakter Sınırı Uyumsuzluğu",
        severity: "LOW",
        description: `Meta açıklaması ${metaDesc.length} karakter uzunluğundadır (Önerilen: 120-160 karakter).`,
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

    if (h1Count === 0) {
      score -= 10;
      issues.push({
        rule_id: "H1_MISSING",
        title: "H1 Başlık Etiketi Bulunamadı",
        severity: "HIGH",
        description: "Sayfada ana başlığı temsil eden bir <h1> etiketi bulunmuyor.",
        recommendation: "Sayfanın ana konusunu ve hedef anahtar kelimelerini içeren tek bir <h1> etiketi yerleştirin."
      });
    } else if (h1Count > 1) {
      score -= 5;
      issues.push({
        rule_id: "H1_MULTIPLE",
        title: "Birden Fazla H1 Etiketi Mevcut",
        severity: "LOW",
        description: `Sayfada ${h1Count} adet <h1> etiketi tespit edildi. Sayfa başına tek <h1> önerilir.`,
        recommendation: "Yalnızca en önemli başlığı <h1> bırakın, diğerlerini <h2> veya <h3> seviyesine indirin."
      });
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
        response_time_ms: responseTimeMs
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
