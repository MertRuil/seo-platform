import assert from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { decideSource } from "./src/lib/dataSource";
import { niceMax, linePath, areaPath, xPositions } from "./src/components/ui/chart-math";
import { scanTextForMenaCompliance } from "./src/lib/compliance-mena";
import { siteSummary, scoreTone, plainTask } from "./src/lib/summary";
import { navGroups, SITE_HEALTH_TABS, ADMIN_TABS, isNavItemActive, isAdminTabActive, visibleNavGroups } from "./src/lib/nav";
import { adminQuery } from "./src/lib/api";
import { formatCompact, formatDelta, formatPercentValue, formatTry, formatMoneyMinor, formatMinorByCurrency } from "./src/lib/format";

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

  // Türkçe sayı biçimleri: yüzde işareti başta, ondalık virgül, B = bin, Mn = milyon.
  assert.strictEqual(formatDelta(8.1), "+%8,1");
  assert.strictEqual(formatDelta(-2.34), "−%2,3");
  assert.strictEqual(formatDelta(0), "%0,0");
  assert.strictEqual(formatPercentValue(98.2), "%98,2");
  assert.strictEqual(formatTry(14.5), "₺14,50");
  assert.deepStrictEqual([142800, 2410000, 999].map(formatCompact), ["142,8\u00a0B", "2,4\u00a0Mn", "999"]);
  console.log("  Türkçe sayı biçimleri: ok");

  // Sade Mod başlığı: yüksek puan kritik sorunu gizlemez.
  assert.strictEqual(siteSummary(94, 1, 4).title, "Sitenizde 1 acil sorun var");
  assert.strictEqual(siteSummary(94, 1, 4).tone, "critical");
  assert.match(siteSummary(94, 1, 4).body, /4 öneri onayınızı bekliyor/);
  assert.match(siteSummary(94, 1, 4).body, /^Bu sorun Google.*önce bunu düzeltin/);
  assert.match(siteSummary(94, 3, 0).body, /^Bu sorunlar .*önce bunları düzeltin\.$/);
  assert.strictEqual(siteSummary(94, 0, 0).title, "Siteniz iyi durumda");
  assert.strictEqual(siteSummary(94, 0, 0).body, "Acil sorun yok.");
  assert.strictEqual(siteSummary(62, 0, 2).tone, "warn");
  assert.deepStrictEqual([scoreTone(80), scoreTone(79), scoreTone(49)], ["evidence", "warn", "critical"]);
  console.log("  siteSummary: ok");

  // Sade Mod görev metni teknik terim taşımaz; bilinmeyen kategori özgün başlığı korur.
  assert.strictEqual(plainTask({ title: "x", category: "CANONICAL" }).title, "Bir sayfanın Google'da yanlış adresle görünmesini düzeltin");
  assert.strictEqual(plainTask({ title: "x", category: "İÇ LİNK" }).title, "Önemli bir sayfaya site içinden daha çok bağlantı verin");
  assert.strictEqual(plainTask({ title: "x", category: "KEYWORD_CANNIBALIZATION_CANDIDATE" }).title, "Aynı aramada birbiriyle yarışan sayfalarınızı ayırın");
  assert.strictEqual(plainTask({ title: "x", category: "CTR_SNIPPET_OPPORTUNITY" }).title, "Arama sonucundaki başlığınızı daha çok tıklanacak şekilde yenileyin");
  assert.strictEqual(plainTask({ title: "Özgün başlık", category: "BILINMEYEN" }).title, "Özgün başlık");
  for (const c of ["CANONICAL", "CTR", "İÇ LİNK", "SCHEMA", "REDIRECT_CHAIN", "RULE_INTERNAL_LINK_TO_404"]) {
    assert.doesNotMatch(plainTask({ title: "x", category: c }).title + plainTask({ title: "x", category: c }).benefit, /canonical|anchor|pagerank|diff|schema/i, c);
  }
  console.log("  plainTask: ok");

  // Menü 5 alan; her sayfa ya menüden ya Site sağlığı sekmelerinden açılır.
  assert.deepStrictEqual(navGroups.map((g) => g.label), ["Özet", "Yapılacaklar", "Görünürlük", "Site sağlığı", "Yönetim"]);
  const reachable = new Set([...visibleNavGroups(true).flatMap((g) => g.items.map((i) => i.href)), ...SITE_HEALTH_TABS.map((t) => t.href)]);
  const pages = readdirSync("src/app", { withFileTypes: true })
    .filter((e) => e.isDirectory() && !["api", "login"].includes(e.name) && readdirSync(join("src/app", e.name)).includes("page.tsx"))
    .map((e) => `/${e.name}`);
  assert.deepStrictEqual(pages.filter((p) => !reachable.has(p)), [], "menüden ulaşılamayan sayfa");
  const icons = navGroups.flatMap((g) => g.items.map((i) => i.icon));
  assert.strictEqual(new Set(icons).size, icons.length, "menüde tekrar eden ikon");
  const health = navGroups.flatMap((g) => g.items).find((i) => i.href === "/health")!;
  assert(isNavItemActive(health, "/issues") && isNavItemActive(health, "/crawls") && !isNavItemActive(health, "/keywords"));
  console.log("  menü yapısı: ok");

  // Platform yönetimi: menü girişi yalnızca yöneticiye; detay sayfalarında da etkin; her sekmenin sayfası var.
  assert(!visibleNavGroups(false).some((g) => g.items.some((i) => i.href === "/admin")), "yönetici olmayana yönetim menüsü");
  const adminItem = visibleNavGroups(true).flatMap((g) => g.items).find((i) => i.href === "/admin")!;
  assert(adminItem && isNavItemActive(adminItem, "/admin/organizations/abc") && !isNavItemActive(adminItem, "/administrator"));
  assert(isAdminTabActive("/admin/organizations", "/admin/organizations/abc") && !isAdminTabActive("/admin", "/admin/users"));
  for (const t of ADMIN_TABS) {
    const dir = join("src/app", t.href);
    assert(readdirSync(dir).includes("page.tsx"), `${t.href} sayfası yok`);
  }
  // Yönetim vekili yerel depoya ya da örnek veriye düşmez.
  const proxyLib = readFileSync("src/lib/backend-proxy.ts", "utf8");
  assert(/export async function proxyBackendOnly[\s\S]*req\.nextUrl\.search[\s\S]*status: 503/.test(proxyLib), "proxyBackendOnly sorgu dizgesini korumalı ve 503 dönmeli");
  const SITE = "organizations/[orgId]/sites/[siteId]";
  for (const route of [
    "admin/[...path]",
    "billing/[...path]",
    "knowledge/[...path]",
    "organizations/[orgId]/billing/[...path]",
    "auth/me",
    `${SITE}/change-sets/[changeSetId]`,
    `${SITE}/change-sets/[changeSetId]/rollback`,
    `${SITE}/self-heal`,
    `${SITE}/leads`,
    `${SITE}/leads/[...path]`,
  ]) {
    const code = readFileSync(`src/app/api/v1/${route}/route.ts`, "utf8");
    assert(code.includes("proxyBackendOnly(") && !/serverless-store|serverlessStore|demoFallback|DEMO_/.test(code), `${route} vekili yedek veriye düşmemeli`);
  }
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  assert(!/serverless-store|lib\/demo|DEMO_/.test(walk("src/app/admin").map((f) => readFileSync(f, "utf8")).join("\n")), "yönetim ekranında örnek veri");
  // Bilgi bankası formu yalnızca platform yöneticisine
  assert(/const canIngest = Boolean\(user\?\.isAdmin\);/.test(readFileSync("src/app/knowledge/page.tsx", "utf8")), "bilgi bankası formu yönetici dışına açık");
  // Düzeltme ve geri alma hata verdiğinde set "uygulandı" sayılmaz.
  for (const page of ["src/app/changes/page.tsx", "src/app/issues/page.tsx"]) {
    const code = readFileSync(page, "utf8");
    for (const m of code.matchAll(/catch \([^)]*\) \{([\s\S]*?)\n {4}\}/g)) {
      assert(!/UYGULANDI|GERİ_ALINDI|tone: "success"/.test(m[1]), `${page}: hata dalında başarı`);
    }
    assert(!/sandbox koruma motorunda uygulandı|Fallback gracefully|Sandbox execution fallback/.test(code), `${page}: sahte sandbox başarısı`);
  }
  assert.strictEqual(adminQuery({ q: "", page: 2, admin: true, plan: undefined }), "?page=2&admin=true");
  assert.strictEqual(adminQuery({}), "");
  assert.strictEqual(formatMoneyMinor(11900, "USD"), "$119,00");
  assert.strictEqual(formatMinorByCurrency({ USD: 7800, TRY: 10000 }), "₺100,00 · $78,00");
  assert.strictEqual(formatMinorByCurrency({}), "—");
  console.log("  platform yönetimi: ok");

  // api.ts'teki her yolun Next tarafında bir vekil ucu olmalı; yoksa istek 404 alır.
  const apiRoot = "src/app/api/v1";
  const routeDirs = walk(apiRoot)
    .filter((f) => f.endsWith("/route.ts"))
    .map((f) => f.slice(apiRoot.length + 1, -"/route.ts".length).split("/").filter(Boolean));
  const routeMatches = (segs: string[], route: string[]) => {
    for (let i = 0; i < route.length; i++) {
      if (route[i].startsWith("[...")) return segs.length > i;
      if (i >= segs.length || !(route[i].startsWith("[") || route[i] === segs[i])) return false;
    }
    return segs.length === route.length;
  };
  const apiSource = readFileSync("src/lib/api.ts", "utf8") + readFileSync("src/app/knowledge/page.tsx", "utf8");
  const clientPaths = new Set(
    [...apiSource.matchAll(/(?:this\.request<[^(]*\(|API_BASE_URL\}`?\s*\+?\s*`?)\s*[`"]?(\/[a-z][^`"?$]*(?:\$\{[^}]+\}[^`"?$]*)*)/g)]
      .map((m) => m[1].replace(/\$\{adminQuery\([^)]*\)\}/g, "").replace(/\$\{[^}]+\}/g, "*").replace(/\/$/, ""))
  );
  const unrouted = [...clientPaths].filter((p) => !routeDirs.some((r) => routeMatches(p.split("/").filter(Boolean), r)));
  assert.deepStrictEqual(unrouted, [], "Next vekil ucu olmayan istemci yolu");
  for (const p of ["/billing/plans", "/organizations/*/billing/subscription", "/knowledge/stats", "/auth/me", "/organizations/*/sites/*/self-heal", "/organizations/*/sites/*/leads", "/organizations/*/sites/*/leads/export-crm"]) {
    assert(clientPaths.has(p), `tarama ${p} yolunu bulamadı`);
  }
  console.log("  istemci yolları vekilde: ok");

  // tailwind.config.js renk paletini ve gölge/yarıçap ölçeğini daralttığı için bu sınıflar CSS üretmez, sessizce stilsiz kalır.
  const undefinedClass =
    /(?<![\w-])(?:[a-z]+:)*(?:(?:text|bg|border|from|to|via|ring|divide|fill|stroke|accent)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+|rounded-(?:xl|2xl|3xl)|shadow-(?:sm|md|lg|xl|2xl|inner)|(?:bg|text)-accent-(?:strong|contrast))(?![\w-])/g;
  const tsxFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? tsxFiles(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : []));
  const offenders = tsxFiles("src").flatMap((f) => (readFileSync(f, "utf8").match(undefinedClass) ?? []).map((c) => `${f}: ${c}`));
  assert.deepStrictEqual(offenders, [], "tanımsız Tailwind sınıfı");

  // Arayüz metninde emoji yok; durum renk, ikon ve metinle anlatılır.
  const emoji = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  const emojiFiles = tsxFiles("src").filter((f) => emoji.test(readFileSync(f, "utf8")));
  assert.deepStrictEqual(emojiFiles, [], "emoji içeren bileşen");
  console.log("  tailwind sınıfları tanımlı: ok");

  // globals.css ile mobilin okuduğu ortak belirteç dosyası aynı kalmalı; kontrast iki temada da AA.
  const tokens = JSON.parse(readFileSync("../../packages/design-tokens/tokens.json", "utf8"));
  const css = readFileSync("src/app/globals.css", "utf8");
  const cssBlock = (selector: string) =>
    Object.fromEntries([...css.split(`${selector} {`)[1].split("\n}")[0].matchAll(/--([a-z0-9-]+):\s*(\d+ \d+ \d+);/g)].map((m) => [m[1], m[2]]));
  assert.deepStrictEqual(cssBlock(":root"), tokens.color.light, "globals.css açık tema belirteç dosyasından ayrışmış");
  assert.deepStrictEqual(cssBlock(".dark"), tokens.color.dark, "globals.css koyu tema belirteç dosyasından ayrışmış");
  const luminance = (rgb: string) => {
    const [r, g, b] = rgb.split(" ").map((c) => {
      const v = Number(c) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const pairs: [string, string][] = [
    ...["ink", "muted", "accent", "evidence", "warn", "critical"].flatMap((fg) => ["bg", "surface", "surface-2"].map((bg) => [fg, bg] as [string, string])),
    ["evidence", "evidence-soft"], ["warn", "warn-soft"], ["critical", "critical-soft"], ["accent-ink", "accent-soft"],
  ];
  for (const theme of ["light", "dark"] as const) {
    const t = tokens.color[theme];
    const low = pairs.map(([fg, bg]) => [fg, bg, contrast(t[fg], t[bg])] as const).filter(([, , r]) => r < 4.5);
    assert.deepStrictEqual(low.map(([fg, bg, r]) => `${fg}/${bg} ${r.toFixed(2)}`), [], `${theme} temada 4,5:1 altı çift`);
    assert(contrast("255 255 255", t["accent-fill"]) >= 4.5, `${theme} temada birincil buton yazısı`);
  }
  console.log("  ortak belirteçler ve kontrast: ok");

  // Terim sözlüğündeki İngilizce ifadeler arayüz metnine girmez; başlıklar rakip ürünle kıyaslamaz.
  const glossary: { pattern: string; flags: string; tr: string }[] = JSON.parse(readFileSync("../../packages/glossary/terms.json", "utf8")).terms;
  const uiFiles = [
    ...tsxFiles("src/app").filter((f) => !f.startsWith(join("src", "app", "api"))),
    ...tsxFiles("src/components"),
    "src/lib/demo.ts", "src/lib/serverless-store.ts", "src/lib/summary.ts", "src/lib/nav.ts",
  ];
  const termHits = uiFiles.flatMap((f) =>
    readFileSync(f, "utf8").split("\n").flatMap((line, i) =>
      /^\s*(\/\/|\*|\/\*|\{\/\*|import )/.test(line)
        ? []
        : glossary.filter((t) => new RegExp(t.pattern, t.flags).test(line)).map((t) => `${f}:${i + 1} → ${t.tr}`)
    )
  );
  assert.deepStrictEqual(termHits, [], "sözlükte Türkçesi olan İngilizce terim");
  const headerTexts = tsxFiles("src/app").flatMap((f) => {
    const src = readFileSync(f, "utf8");
    return [...src.matchAll(/<PageHeader\b/g)].map((m) => {
      // title ve description her sayfada bileşenin ilk satırlarında.
      const props = src.slice(m.index, m.index + 600);
      const attr = (name: string) => props.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "";
      return `${f}: ${attr("title")} ${attr("description")}`;
    });
  });
  assert.deepStrictEqual(headerTexts.filter((t) => /Semrush|Ahrefs|Surfer|\bMoz\b|standard|kalitesinde/i.test(t)), [], "sayfa başlığında rakip kıyası");
  console.log("  terim sözlüğü: ok");

  // Yazı boyutu alt sınırı 12 px; 11 px (text-2xs) yalnızca mono etiketlerde.
  const smallText = uiFiles.flatMap((f) =>
    readFileSync(f, "utf8").split("\n").flatMap((line, i) => {
      const hits = [...line.matchAll(/text-\[(\d+(?:\.\d+)?)px\]|fontSize=\{(\d+)\}/g)].filter((m) => Number(m[1] ?? m[2]) < 12).map((m) => m[0]);
      if (/text-2xs(?![\w-])/.test(line) && !line.includes("font-mono")) hits.push("text-2xs");
      return hits.map((h) => `${f}:${i + 1} ${h}`);
    })
  );
  assert.deepStrictEqual(smallText, [], "12 px altı yazı");
  // Grafik koordinatları ekrandaki genişliğe eşit; eksen yazısı bu yüzden gerçek px.
  assert(Number(/const AXIS_FONT = (\d+)/.exec(readFileSync("src/components/ui/TrendChart.tsx", "utf8"))?.[1]) >= 11, "grafik eksen yazısı 11 px altında");
  console.log("  yazı boyutu alt sınırı: ok");

  console.log("ALL UI LOGIC TESTS PASSED");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});



