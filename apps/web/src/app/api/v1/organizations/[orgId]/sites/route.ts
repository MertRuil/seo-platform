import { NextRequest, NextResponse } from "next/server";
import { serverlessStore } from "@/lib/serverless-store";
import { tryBackendProxy } from "@/lib/backend-proxy";
import { validateSafeAuditUrl, SSRFSecurityError } from "@/lib/ssrf";

export const dynamic = "force-dynamic";

const ALLOWED_SITE_TYPES = new Set([
  "LOCAL_BUSINESS",
  "ECOMMERCE",
  "SAAS",
  "BLOG",
  "NEWS",
  "CORPORATE",
  "MARKETPLACE",
  "GENERAL",
  "OTHER",
]);

const ALLOWED_EXECUTION_MODES = new Set([
  "SUGGEST_ONLY",
  "REVIEW_ALL",
  "AUTO_LOW_RISK",
  "AUTO_LOW_AND_APPROVED_MEDIUM",
  "ASSISTED",
  "AUTONOMOUS",
  "SEMI_AUTONOMOUS",
  "MANUAL",
]);

export async function GET(req: NextRequest, { params }: { params: { orgId: string } }) {
  const orgId = params.orgId;
  if (!orgId || !/^[a-zA-Z0-9_-]{1,64}$/.test(orgId)) {
    return NextResponse.json({ detail: "Geçersiz organizasyon kimliği" }, { status: 400 });
  }

  const proxied = await tryBackendProxy(req, `/organizations/${orgId}/sites`);
  if (proxied) return proxied;

  const sites = serverlessStore.getSites(orgId);
  return NextResponse.json(sites);
}

export async function POST(req: NextRequest, { params }: { params: { orgId: string } }) {
  const orgId = params.orgId;
  if (!orgId || !/^[a-zA-Z0-9_-]{1,64}$/.test(orgId)) {
    return NextResponse.json({ detail: "Geçersiz organizasyon kimliği" }, { status: 400 });
  }

  const proxied = await tryBackendProxy(req, `/organizations/${orgId}/sites`);
  if (proxied) return proxied;

  const body = await req.json().catch(() => ({}));
  if (!body.primary_url || typeof body.primary_url !== "string") {
    return NextResponse.json({ detail: "Web sitesi adresi (primary_url) zorunludur" }, { status: 400 });
  }

  let cleanUrl = body.primary_url.trim();
  if (cleanUrl.length > 2048) {
    return NextResponse.json({ detail: "Web sitesi adresi çok uzun (maksimum 2048 karakter)" }, { status: 400 });
  }

  // Protokol zorunluluğu (varsayılan https)
  if (!/^https?:\/\//i.test(cleanUrl)) {
    cleanUrl = "https://" + cleanUrl;
  }

  // 1. SSRF & Hedef URL Güvenlik Doğrulaması (Localhost, Dahili IP'ler, Cloud Metadata vb. engellenir)
  let validatedUrlObj: URL;
  try {
    validatedUrlObj = await validateSafeAuditUrl(cleanUrl);
  } catch (err: any) {
    const isSSRF = err instanceof SSRFSecurityError || err.name === "SSRFSecurityError";
    return NextResponse.json(
      { detail: isSSRF ? `Güvenlik engeli: ${err.message}` : (err.message || "Geçersiz hedef adresi") },
      { status: 400 }
    );
  }

  // 2. XSS & Girdi Temizleme (Site adı)
  let safeName = "";
  if (body.name && typeof body.name === "string") {
    safeName = body.name
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
      .trim()
      .slice(0, 100);
  }
  if (!safeName) {
    safeName = validatedUrlObj.hostname.replace(/^www\./i, "");
  }

  // 3. Enum Doğrulamaları
  const siteType = ALLOWED_SITE_TYPES.has(body.site_type) ? body.site_type : "GENERAL";
  const executionMode = ALLOWED_EXECUTION_MODES.has(body.execution_mode) ? body.execution_mode : "ASSISTED";

  try {
    const site = serverlessStore.createSite(orgId, {
      name: safeName,
      primary_url: validatedUrlObj.toString(),
      site_type: siteType,
      execution_mode: executionMode,
    });
    return NextResponse.json(site, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message || "Site eklenirken hata oluştu" }, { status: 400 });
  }
}
