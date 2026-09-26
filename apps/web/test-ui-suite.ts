import assert from "node:assert";
import { decideSource } from "./src/lib/dataSource";
import { niceMax, linePath, areaPath, xPositions } from "./src/components/ui/chart-math";

function run() {
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
    const csvFilename = `seo_raporu_${activeClient.toLowerCase().replace(/\s+/g, "_")}.csv`;
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

  console.log("  resolveReportMetadata site synchronization: ok");

  console.log("ALL UI LOGIC TESTS PASSED");
}

run();

