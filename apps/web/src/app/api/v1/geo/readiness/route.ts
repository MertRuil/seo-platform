import { NextRequest, NextResponse } from "next/server";
import { validateSafeAuditUrl, safeAuditFetch, SSRFSecurityError } from "@/lib/ssrf";
import { AI_BOTS, buildChecks, evaluateBot, extractHtmlSignals, parseRobots, type ParsedRobots } from "@/lib/geo-readiness";

export const dynamic = "force-dynamic";

// IP başına dakikada en fazla 10 denetim (her denetim hedef siteye 3-4 istek atar)
const HISTORY = new Map<string, number[]>();
function allow(ip: string): boolean {
  const now = Date.now();
  const recent = (HISTORY.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 10) return false;
  recent.push(now);
  HISTORY.set(ip, recent);
  return true;
}

const UA = "Mozilla/5.0 (compatible; CALPEO-AIReadiness/1.0; +https://calpeo.io/bot)";

async function tryFetch(url: string, timeoutMs = 6000) {
  try {
    return await safeAuditFetch(url, { headers: { "User-Agent": UA }, timeoutMs, maxRedirects: 3 });
  } catch (e) {
    if (e instanceof SSRFSecurityError) throw e;
    return null;
  }
}

/** AI yanıt motorları için erişim ve hazırlık denetimi: robots.txt, llms.txt, site haritası ve ana sayfa sinyalleri. */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  if (!allow(ip)) {
    return NextResponse.json({ detail: "Çok fazla istek. Bir dakika sonra tekrar deneyin." }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  let target = typeof body.url === "string" ? body.url.trim() : "";
  if (!target) return NextResponse.json({ detail: "Site adresi zorunludur." }, { status: 400 });
  if (!/^https?:\/\//i.test(target)) target = "https://" + target;

  let origin: string;
  try {
    origin = (await validateSafeAuditUrl(target)).origin;
  } catch (e) {
    return NextResponse.json({ detail: e instanceof Error ? e.message : "Geçersiz adres" }, { status: 400 });
  }

  try {
    const [robotsRes, llmsRes, homeRes] = await Promise.all([tryFetch(`${origin}/robots.txt`), tryFetch(`${origin}/llms.txt`), tryFetch(`${origin}/`, 9000)]);

    const robotsStatus = robotsRes?.statusCode ?? null;
    const robots: ParsedRobots | null = robotsRes && robotsStatus !== null && robotsStatus >= 200 && robotsStatus < 300 ? parseRobots(robotsRes.text) : null;
    const bots = AI_BOTS.map((b) =>
      !robots && !(robotsStatus !== null && robotsStatus >= 400 && robotsStatus < 500)
        ? { ...b, status: "unknown" as const, source: "none" as const }
        : evaluateBot(robots, b)
    );

    let sitemapFound = Boolean(robots?.sitemaps.length);
    if (!sitemapFound) {
      const sm = await tryFetch(`${origin}/sitemap.xml`, 5000);
      sitemapFound = Boolean(sm && sm.statusCode >= 200 && sm.statusCode < 300 && /<(urlset|sitemapindex)/i.test(sm.text));
    }

    const llmsTxt = Boolean(llmsRes && llmsRes.statusCode === 200 && !/<html/i.test(llmsRes.text.slice(0, 500)) && llmsRes.text.trim().length > 0);
    const homeOk = homeRes && homeRes.statusCode >= 200 && homeRes.statusCode < 300;
    const html = homeOk ? extractHtmlSignals(homeRes.text, homeRes.headers["x-robots-tag"] || "") : null;

    const checks = buildChecks({ robotsStatus, bots, llmsTxt, sitemapFound, html, homepageStatus: homeRes?.statusCode ?? null });

    return NextResponse.json({
      url: origin,
      checked_at: new Date().toISOString(),
      robots: { status: robotsStatus, found: robotsStatus !== null && robotsStatus >= 200 && robotsStatus < 300 },
      bots,
      checks,
    });
  } catch (e) {
    const blocked = e instanceof SSRFSecurityError;
    return NextResponse.json({ detail: blocked ? `Güvenlik engeli: ${e.message}` : "Denetim sırasında hata oluştu." }, { status: blocked ? 400 : 500 });
  }
}
