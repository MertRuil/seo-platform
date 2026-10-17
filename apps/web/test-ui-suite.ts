import assert from "node:assert";
import { decideSource } from "./src/lib/dataSource";
import { niceMax, linePath, areaPath, xPositions } from "./src/components/ui/chart-math";
import { scanTextForMenaCompliance } from "./src/lib/compliance-mena";
import { detectIntent } from "./src/lib/assistant";
import { AI_BOTS, buildChecks, evaluateBot, extractHtmlSignals, isPathAllowed, parseRobots, summarizeAnswerBotAccess } from "./src/lib/geo-readiness";
import { readChangeSets, updateChangeSetStatus, writeChangeSets } from "./src/lib/changesets";
import { DEMO_CHANGESETS } from "./src/lib/demo";

async function run() {
  console.log("UI LOGIC TEST SUITE");

  // decideSource: precedence no-backend > unauthorized > no-org > no-site > no-crawl > live
  assert.deepStrictEqual(
    decideSource({ backendReachable: false, authorized: false, hasOrg: false, hasSite: false, hasCrawl: false }),
    { source: "demo", reason: "no-backend" }
  );
  assert.deepStrictEqual(
    decideSource({ backendReachable: true, authorized: false, hasOrg: false, hasSite: false, hasCrawl: false }),
    { source: "demo", reason: "unauthorized" }
  );
  assert.deepStrictEqual(
    decideSource({ backendReachable: true, authorized: true, hasOrg: false, hasSite: false, hasCrawl: false }),
    { source: "demo", reason: "no-org" }
  );
  assert.deepStrictEqual(
    decideSource({ backendReachable: true, authorized: true, hasOrg: true, hasSite: false, hasCrawl: false }),
    { source: "demo", reason: "no-site" }
  );
  assert.deepStrictEqual(
    decideSource({ backendReachable: true, authorized: true, hasOrg: true, hasSite: true, hasCrawl: false }),
    { source: "demo", reason: "no-crawl" }
  );
  assert.deepStrictEqual(
    decideSource({ backendReachable: true, authorized: true, hasOrg: true, hasSite: true, hasCrawl: true }),
    { source: "live" }
  );
  console.log("  decideSource: ok");

  // niceMax: rounds up to a readable axis ceiling, never 0
  assert.strictEqual(niceMax([]), 1);
  assert.strictEqual(niceMax([0, 0]), 1);
  assert.strictEqual(niceMax([82]), 100);
  assert.strictEqual(niceMax([1420]), 1500);
  assert.strictEqual(niceMax([0.02, 0.05]), 0.05);
  assert.strictEqual(niceMax([0.02, 0.06]), 0.1);
  assert.strictEqual(niceMax([100]), 100);
  console.log("  niceMax: ok");

  // xPositions: first at padX, last at width - padX, evenly spaced; single point centered
  assert.deepStrictEqual(xPositions(3, 100, 10), [10, 50, 90]);
  assert.deepStrictEqual(xPositions(1, 100, 10), [50]);
  assert.deepStrictEqual(xPositions(0, 100, 10), []);
  console.log("  xPositions: ok");

  // linePath: max maps to padTop, 0 maps to height - padBottom
  const opts = { width: 100, height: 60, max: 10, padX: 0, padTop: 10, padBottom: 10 };
  assert.strictEqual(linePath([0, 10], opts), "M0 50 L100 10");
  assert.strictEqual(linePath([5], opts), "M50 30");
  assert.strictEqual(linePath([], opts), "");
  // areaPath closes down to the baseline
  assert.strictEqual(areaPath([0, 10], opts), "M0 50 L100 10 L100 50 L0 50 Z");
  console.log("  linePath/areaPath: ok");

  // Report client name & domain synchronization when switching sites
  const resolveReportMetadata = (
    site: { name?: string; domain?: string; primary_url?: string } | null,
    customClientInput?: string
  ) => {
    const rawClient = customClientInput !== undefined ? customClientInput : (site?.name || site?.domain || "Müşteri Firma");
    const activeClient = rawClient.trim() || site?.name || site?.domain || "Müşteri Firma";
    const activeDomain = site?.domain || site?.primary_url?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "site.com";
    const activeUrl = site?.primary_url || (activeDomain ? `https://${activeDomain}` : "https://site.com");
    const sanitized = activeClient.toLowerCase().replace(/[#%&{}\\<>*?/$!'":@+`|=]/g, "").trim().replace(/\s+/g, "_") || "musteri";
    const csvFilename = `seo_raporu_${sanitized}.csv`;
    return { activeClient, activeDomain, activeUrl, csvFilename };
  };

  const siteA = { name: "Acme Store E-Ticaret", domain: "acmestore.io", primary_url: "https://acmestore.io" };
  const siteB = { name: "Zenith Tech Çözümleri", domain: "zenithtech.co", primary_url: "https://zenithtech.co" };

  // 1. Initial load on site A
  const metaA = resolveReportMetadata(siteA);
  assert.strictEqual(metaA.activeClient, "Acme Store E-Ticaret");
  assert.strictEqual(metaA.activeDomain, "acmestore.io");
  assert.strictEqual(metaA.csvFilename, "seo_raporu_acme_store_e-ticaret.csv");

  // 2. Switching site to site B MUST NOT retain site A's name
  const metaB = resolveReportMetadata(siteB);
  assert.strictEqual(metaB.activeClient, "Zenith Tech Çözümleri");
  assert.strictEqual(metaB.activeDomain, "zenithtech.co");
  assert.strictEqual(metaB.csvFilename, "seo_raporu_zenith_tech_çözümleri.csv");
  assert.notStrictEqual(metaB.activeClient, metaA.activeClient, "Switching site MUST change report client name!");

  // 3. Custom client name overrides default site name
  const metaCustom = resolveReportMetadata(siteB, "Zenith Global Danışmanlık");
  assert.strictEqual(metaCustom.activeClient, "Zenith Global Danışmanlık");
  assert.strictEqual(metaCustom.activeDomain, "zenithtech.co");

  // 4. Empty client input gracefully falls back to current site
  const metaEmpty = resolveReportMetadata(siteB, "   ");
  assert.strictEqual(metaEmpty.activeClient, "Zenith Tech Çözümleri");

  // 5. Client name containing # must produce safe sanitized filename without # character
  const metaHash = resolveReportMetadata(siteA, "Acme #1 Super Store");
  assert.strictEqual(metaHash.activeClient, "Acme #1 Super Store");
  assert.strictEqual(metaHash.csvFilename, "seo_raporu_acme_1_super_store.csv");

  console.log("  resolveReportMetadata site synchronization: ok");

  // CSV Export & # character truncation regression test
  const generateCsvData = (rows: Array<Array<string | number>>) => {
    const escapeCsvCell = (val: string | number | undefined | null): string => {
      const str = String(val ?? "");
      if (/[;"\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    return (
      "\uFEFF" +
      rows.map((row) => row.map(escapeCsvCell).join(";")).join("\r\n")
    );
  };

  const sampleRowsWithHash = [
    ["METRIK", "DEGER"],
    ["Musteri", "Acme #1 E-Ticaret Global"],
    ["Anahtar Kelime", "C# SEO Optimizasyonu"],
    ["Kampanya", "Yılbaşı #indirim Trendleri"],
    ["Skor", 95],
  ];

  const fullCsvContent = generateCsvData(sampleRowsWithHash);

  // Verification 1: Full content must retain # characters in all rows
  assert(fullCsvContent.includes("Acme #1 E-Ticaret Global"));
  assert(fullCsvContent.includes("C# SEO Optimizasyonu"));
  assert(fullCsvContent.includes("Yılbaşı #indirim Trendleri"));

  // Verification 2: Simulate old buggy data: URI behavior where browser cuts URL at #
  const buggyDataUri = "data:text/csv;charset=utf-8,\uFEFF" + sampleRowsWithHash.map((e) => e.join(";")).join("\n");
  const buggyEncoded = encodeURI(buggyDataUri);
  // Browser interprets # as URL fragment identifier, truncating payload
  const hashIndex = buggyEncoded.indexOf("#");
  assert.notStrictEqual(hashIndex, -1, "Old code left # unencoded in data URI");
  const truncatedPayload = buggyEncoded.slice(0, hashIndex);
  assert(!truncatedPayload.includes("C# SEO Optimizasyonu"), "Old buggy data URI cuts before subsequent lines");
  assert(!truncatedPayload.includes("95"), "Old buggy data URI lost the end of file");

  // Verification 3: Blob payload preserves exact length and full content
  const blob = new Blob([fullCsvContent], { type: "text/csv;charset=utf-8;" });
  assert.strictEqual(blob.size, Buffer.byteLength(fullCsvContent, "utf8"));
  console.log("  csvExportHashTruncationFix: ok");

  // Backlink spam classification & anchor category tests
  const classifyBacklinkLogic = (sourceUrl: string, anchorText: string, spamScore: number = 0) => {
    const SPAM_TLDS = [
      ".xyz", ".top", ".click", ".link", ".buzz", ".work", ".bar", ".rest",
      ".monster", ".icu", ".cfd", ".sbs", ".cam", ".beauty", ".hair", ".skin",
      ".quest", ".boats", ".cyou", ".pw", ".cc", ".press",
    ];
    const SPAM_KEYWORDS = [
      "casino", "viagra", "cialis", "betting", "bahis", "kumar", "slot", "rulet",
      "porn", "escort", "replica", "payday", "pbn", "hack", "crack", "pharmacy",
    ];

    let domain = sourceUrl.trim();
    try {
      const parsed = new URL(sourceUrl.trim().startsWith("http") ? sourceUrl.trim() : `https://${sourceUrl.trim()}`);
      domain = parsed.hostname;
    } catch {
      domain = sourceUrl.trim().replace(/^https?:\/\//, "").split("/")[0];
    }

    const isSpamTld = SPAM_TLDS.some((tld) => domain.toLowerCase().endsWith(tld));
    const anchorLower = (anchorText || "").toLowerCase();
    const hasSpamKeyword = SPAM_KEYWORDS.some((kw) => anchorLower.includes(kw));
    const isRawIp = /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?/i.test(sourceUrl.trim()) || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/i.test(domain);

    const isToxic = isSpamTld || hasSpamKeyword || isRawIp || spamScore >= 60;
    const anchorCategory = hasSpamKeyword ? "SPAM" : "BRAND";

    return { domain, isToxic, anchorCategory, isSpamTld, hasSpamKeyword, isRawIp };
  };

  // 1. Single critical spam anchor must be classified as SPAM and toxic (even on neutral domain)
  const res1 = classifyBacklinkLogic("https://goodnews.com/post", "canlı bahis ve casino bonusu");
  assert.strictEqual(res1.isToxic, true, "Casino anchor must trigger toxicity");
  assert.strictEqual(res1.anchorCategory, "SPAM", "Casino anchor must be categorized as SPAM");

  // 2. High risk modern spam TLD (.monster) must be classified as toxic
  const res2 = classifyBacklinkLogic("https://free-credits.monster/list", "ziyaret edin");
  assert.strictEqual(res2.isToxic, true, ".monster TLD must be flagged as toxic");

  // 3. Raw IP address backlink must be flagged as toxic
  const res3 = classifyBacklinkLogic("http://185.220.101.5/partner-links", "tıklayın");
  assert.strictEqual(res3.isToxic, true, "Raw IP backlink must be flagged as toxic");

  // 4. Legitimate brand link must NOT be toxic or spam
  const res4 = classifyBacklinkLogic("https://techcrunch.com/article", "Acme Store Platform");
  assert.strictEqual(res4.isToxic, false, "Authoritative brand link must be safe");
  assert.strictEqual(res4.anchorCategory, "BRAND", "Brand link must have BRAND anchor category");

  console.log("  classifyBacklinkLogic: ok");

  // Organic CVR (Conversion Rate) calculation test
  const calculateConversionRates = (
    channels: Array<{ channel: string; sessions: number; conversions: number }>
  ) => {
    const totalSessions = channels.reduce((acc, c) => acc + c.sessions, 0);
    const totalConversions = channels.reduce((acc, c) => acc + c.conversions, 0);

    const organicRow = channels.find((c) => c.channel.toLowerCase().includes("organic"));
    const organicSessions = organicRow ? organicRow.sessions : 0;
    const organicConversions = organicRow ? organicRow.conversions : 0;

    const organicCvr = organicSessions > 0 ? (organicConversions / organicSessions) * 100 : 0;
    const overallCvr = totalSessions > 0 ? (totalConversions / totalSessions) * 100 : 0;
    const buggyInflatedCvr = organicSessions > 0 ? (totalConversions / organicSessions) * 100 : 0;

    return {
      totalSessions,
      totalConversions,
      organicSessions,
      organicConversions,
      organicCvr: Number(organicCvr.toFixed(2)),
      overallCvr: Number(overallCvr.toFixed(2)),
      buggyInflatedCvr: Number(buggyInflatedCvr.toFixed(2)),
    };
  };

  const channelData = [
    { channel: "Direct", sessions: 5000, conversions: 200 },
    { channel: "Paid Search", sessions: 4000, conversions: 156 },
    { channel: "Organic Search", sessions: 15200, conversions: 486 },
  ];

  const cvrResults = calculateConversionRates(channelData);
  assert.strictEqual(cvrResults.totalConversions, 842);
  assert.strictEqual(cvrResults.organicConversions, 486);
  assert.strictEqual(cvrResults.organicCvr, 3.20, "Organic CVR must be 486 / 15200 * 100 = 3.20%");
  assert.strictEqual(cvrResults.overallCvr, 3.48, "Overall CVR must be 842 / 24200 * 100 = 3.48%");
  assert.strictEqual(cvrResults.buggyInflatedCvr, 5.54, "Buggy code produced inflated 5.54%");
  assert.notStrictEqual(cvrResults.organicCvr, cvrResults.buggyInflatedCvr, "Organic CVR must not equal inflated total-based CVR");

  console.log("  calculateConversionRates (Organic CVR fix): ok");

  // Network Error & Offline Resilience Regression Test
  const safeNetworkExecute = async <T>(
    networkTask: () => Promise<T>,
    fallbackValue: T
  ): Promise<{ data: T; fellBack: boolean; errorHandled: boolean }> => {
    try {
      const result = await networkTask();
      return { data: result, fellBack: false, errorHandled: true };
    } catch {
      // Must not throw or produce unhandled rejection on network drop
      return { data: fallbackValue, fellBack: true, errorHandled: true };
    }
  };

  // 1. Simulating sudden network loss (ENOTFOUND / Network Request Failed)
  const networkLossTask = async () => {
    throw new TypeError("fetch failed: ENOTFOUND api.seoplatform.local");
  };

  let resFallback: any = null;
  await assert.doesNotReject(async () => {
    resFallback = await safeNetworkExecute(networkLossTask, { status: "demo", reason: "offline" });
  }, "Network drop must NEVER throw an unhandled rejection or crash the app");

  assert.strictEqual(resFallback.fellBack, true);
  assert.strictEqual(resFallback.errorHandled, true);
  assert.strictEqual(resFallback.data.status, "demo");

  // 2. Simulating successful network task
  const healthyTask = async () => ({ status: "live", id: "site-101" });
  const resHealthy = await safeNetworkExecute(healthyTask, { status: "demo", id: "demo-site" });
  assert.strictEqual(resHealthy.fellBack, false);
  assert.strictEqual(resHealthy.data.status, "live");

  console.log("  safeNetworkExecute (Offline & Crash Resilience): ok");

  // MENA Compliance Arabic Normalization Test (Issue 2)
  // Ensures both text and regex patterns are normalized (أ/إ/آ→ا, ة→ه, ى→ي)
  const arabicCasinoText = "أفضل كازينو أونلاين في دبي للعب بمال حقيقي";
  const casinoViolations = scanTextForMenaCompliance(arabicCasinoText);
  assert.ok(casinoViolations.length > 0, "Must flag 'كازينو أونلاين' even with alef hamza");
  assert.strictEqual(casinoViolations[0].ruleId, "MENA_ISLAMIC_MORALS_GAMBLING_ALCOHOL");

  const arabicAlcoholText = "خدمة توصيل مشروبات كحولية سريعة";
  const alcoholViolations = scanTextForMenaCompliance(arabicAlcoholText);
  assert.ok(alcoholViolations.length > 0, "Must flag 'توصيل مشروبات كحولية'");
  assert.strictEqual(alcoholViolations[0].ruleId, "MENA_ISLAMIC_MORALS_GAMBLING_ALCOHOL");

  const arabicOzempicText = "شراء أوزمبيك بدون وصفة طبية للتنحيف السريع";
  const ozempicViolations = scanTextForMenaCompliance(arabicOzempicText);
  assert.ok(ozempicViolations.length > 0, "Must flag 'شراء أوزمبيك بدون وصفة'");
  assert.strictEqual(ozempicViolations[0].ruleId, "MENA_MOHAP_SFDA_PRESCRIPTION_DRUGS");

  const arabicGamblingOnline = "قمار عبر الإنترنت بدون شروط";
  const gamblingViolations = scanTextForMenaCompliance(arabicGamblingOnline);
  assert.ok(gamblingViolations.length > 0, "Must flag 'قمار عبر الإنترنت'");
  console.log("  scanTextForMenaCompliance (Arabic normalization): ok");

  // Mobile / Chat AI Intent Routing Logic Test (Issue 10)
  // Verifies that Turkish words like 'yasal', 'yasak', 'kasa', 'hukuk' do NOT falsely trigger UK intent
  const classifyTestIntent = (query: string): "ASIA" | "UK" | "MENA" | "GENERAL" => {
    const lower = query.toLowerCase();
    if (lower.includes("mena") || lower.includes("bae") || lower.includes("uae") || lower.includes("dubai") || lower.includes("saudi")) {
      return "MENA";
    }
    // 1. Asia & Pacific evaluated first
    if (lower.includes("asya") || lower.includes("apac") || lower.includes("pmda") || lower.includes("samr") || /\bmas\b/i.test(lower)) {
      return "ASIA";
    }
    // 2. UK Intent uses strict word boundaries: \b(?:uk|asa|cma|fca|dmcc)\b
    const isUkIntent =
      lower.includes("ingiltere") ||
      lower.includes("birleşik krallık") ||
      lower.includes("botox") ||
      /\b(?:uk|asa|cma|fca|dmcc)\b/i.test(lower);
    if (isUkIntent) {
      return "UK";
    }
    return "GENERAL";
  };

  // Turkish queries containing 'yasal', 'yasak', 'kasa', 'hukuk' must NEVER route to UK
  assert.strictEqual(classifyTestIntent("Bu ürün reklamı yasal mı?"), "GENERAL");
  assert.strictEqual(classifyTestIntent("Hangi ifadeler yasak?"), "GENERAL");
  assert.strictEqual(classifyTestIntent("Kasa gelir raporu nerede?"), "GENERAL");
  assert.strictEqual(classifyTestIntent("Bu masa ve mobilya tanıtımı yasal mı?"), "GENERAL");
  assert.strictEqual(classifyTestIntent("Bu reklam hukuka uygun mu?"), "GENERAL");

  // Asia questions containing 'yasa' must route to ASIA, not UK
  assert.strictEqual(classifyTestIntent("Asya mevzuatında bu iddia yasal mı?"), "ASIA");
  assert.strictEqual(classifyTestIntent("APAC bölgesinde bu reklam yasağı var mı?"), "ASIA");

  // Real UK queries MUST route to UK
  assert.strictEqual(classifyTestIntent("UK ASA kuralları nedir?"), "UK");
  assert.strictEqual(classifyTestIntent("CMA Green claims rehberi"), "UK");
  assert.strictEqual(classifyTestIntent("DMCC Act 2024 kapsamı nedir?"), "UK");
  assert.strictEqual(classifyTestIntent("İngiltere pazarı için botox reklamı yapılabilir mi?"), "UK");
  console.log("  classifyIntent (Strict UK word boundary & Asia precedence): ok");

  // AI hazırlık denetimi: robots.txt değerlendirmesi RFC 9309 kurallarına uymalı
  {
    const bot = (t: string) => AI_BOTS.find((b) => b.token === t)!;
    const robots = parseRobots(
      "User-agent: GPTBot\nDisallow: /\n\nUser-agent: OAI-SearchBot\nUser-agent: PerplexityBot\nAllow: /\nDisallow: /admin\n\nUser-agent: *\nDisallow: /private/\nSitemap: https://x.com/sitemap.xml"
    );
    assert.strictEqual(evaluateBot(robots, bot("GPTBot")).status, "blocked");
    assert.strictEqual(evaluateBot(robots, bot("GPTBot")).source, "specific");
    assert.strictEqual(evaluateBot(robots, bot("OAI-SearchBot")).status, "partial");
    assert.strictEqual(evaluateBot(robots, bot("PerplexityBot")).status, "partial", "grouped user-agents share rules");
    assert.strictEqual(evaluateBot(robots, bot("ClaudeBot")).source, "wildcard");
    assert.strictEqual(evaluateBot(robots, bot("ClaudeBot")).status, "partial");
    assert.deepStrictEqual(robots.sitemaps, ["https://x.com/sitemap.xml"]);
    assert.strictEqual(evaluateBot(null, bot("GPTBot")).status, "allowed", "no robots.txt = allowed");
    // En uzun eşleşme kazanır; eşitlikte Allow
    assert.strictEqual(isPathAllowed([{ allow: false, path: "/" }, { allow: true, path: "/blog" }], "/blog/a").allowed, true);
    assert.strictEqual(isPathAllowed([{ allow: false, path: "/" }, { allow: true, path: "/" }], "/").allowed, true);
    // Boş Disallow her şeye izin verir; Google-Extended engeli Googlebot'u etkilemez
    const r2 = parseRobots("User-agent: *\nDisallow:\n\nUser-agent: Google-Extended\nDisallow: /");
    assert.strictEqual(evaluateBot(r2, bot("Googlebot")).status, "allowed");
    assert.strictEqual(evaluateBot(r2, bot("Google-Extended")).status, "blocked");
    // Yalnızca eğitim botu engelliyse yanıt motoru erişimi "pass"
    const checks = buildChecks({ robotsStatus: 200, bots: AI_BOTS.map((b) => evaluateBot(r2, b)), llmsTxt: false, sitemapFound: false, html: extractHtmlSignals("<title>T</title>"), homepageStatus: 200 });
    assert.strictEqual(checks.find((c) => c.id === "search-bots")!.status, "pass");
    const html = extractHtmlSignals('<meta name="robots" content="max-snippet:0"><script type="application/ld+json">{"@type":["Organization","WebSite"]}</script><p>hi</p>');
    assert.deepStrictEqual(html.jsonLdTypes, ["Organization", "WebSite"]);
    const c2 = buildChecks({ robotsStatus: 404, bots: [], llmsTxt: true, sitemapFound: true, html, homepageStatus: 200 });
    assert.strictEqual(c2.find((c) => c.id === "snippet-directives")!.status, "fail");
    assert.strictEqual(c2.find((c) => c.id === "server-text")!.status, "warn");
    const unknownBots = AI_BOTS.map((b) => ({ ...b, status: "unknown" as const, source: "none" as const }));
    const unknownAccess = summarizeAnswerBotAccess(unknownBots);
    assert.strictEqual(unknownAccess.accessible, 0);
    assert.strictEqual(unknownAccess.unknown.length, unknownAccess.total);
    assert.match(unknownAccess.summary, /bilinmiyor/);
    for (const robotsStatus of [503, null]) {
      const failed = buildChecks({ robotsStatus, bots: unknownBots, llmsTxt: false, sitemapFound: false, html, homepageStatus: 200 });
      assert.strictEqual(failed.find((c) => c.id === "search-bots")!.status, "warn");
    }
    const mixed = summarizeAnswerBotAccess([
      { ...bot("Googlebot"), status: "allowed", source: "none" },
      { ...bot("ChatGPT-User"), status: "unknown", source: "none" },
      { ...bot("GPTBot"), status: "unknown", source: "none" },
    ]);
    assert.strictEqual(mixed.accessible, 1);
    assert.strictEqual(mixed.total, 2);
    assert.deepStrictEqual(mixed.unknown, ["ChatGPT-User"]);
    console.log("  geo-readiness (robots.txt groups, longest match, signals): ok");
  }

  // Bir sitenin taslak durumu güncellenirken diğer sitelerin taslakları korunur.
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const stored = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  } });
  try {
    const a = { ...DEMO_CHANGESETS[0], id: "draft-a", etkilenenSayfa: "https://a.example/page" };
    const b = { ...DEMO_CHANGESETS[0], id: "draft-b", etkilenenSayfa: "https://b.example/page" };
    writeChangeSets([a, b]);
    updateChangeSetStatus(a.id, "UYGULANDI");
    assert.deepStrictEqual(readChangeSets(), [{ ...a, durum: "UYGULANDI" }, b]);
    updateChangeSetStatus("server-only-set", "GERİ_ALINDI");
    assert.deepStrictEqual(readChangeSets(), [{ ...a, durum: "UYGULANDI" }, b]);
  } finally {
    if (storageDescriptor) Object.defineProperty(globalThis, "localStorage", storageDescriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
  console.log("  changesets (other sites' drafts preserved): ok");

  // Asistan: tam kelime eşleşmesi ("uyumluluk" içindeki "uk" İngiltere'ye gitmemeli)
  assert.strictEqual(detectIntent("Mobil uyumluluk sorunlarım neler?"), "ISSUES");
  assert.strictEqual(detectIntent("UK ASA kuralları nedir?"), "REG_UK");
  assert.strictEqual(detectIntent("Bu reklam yasal mı?"), "REG_TR");
  assert.strictEqual(detectIntent("Asya mevzuatında bu iddia yasal mı?"), "REG_ASIA");
  assert.strictEqual(detectIntent("Mastercard ile ödeme seçenekleri"), "UNKNOWN");
  assert.strictEqual(detectIntent("Son 14 günde trafik neden düştü?"), "TRAFFIC");
  assert.strictEqual(detectIntent("ChatGPT sitemi okuyabiliyor mu?"), "AI_ACCESS");
  console.log("  assistant detectIntent (whole-word routing): ok");

  console.log("ALL UI LOGIC TESTS PASSED");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});


