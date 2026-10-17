import { NextRequest, NextResponse } from "next/server";
import { verifySignedToken } from "@/lib/jwt";
import { serverlessStore } from "@/lib/serverless-store";
import type { SiteResponse } from "@/lib/api";

/**
 * Arka uca ulaşılamadığında devreye giren yerel depo rotaları için kimlik ve sahiplik kontrolü.
 * Önceden bu rotalar oturumsuz çalışıyor ve tüm kullanıcılara aynı organizasyonu gösteriyordu.
 */
export interface StoreUser {
  id: string;
  email: string;
  isAdmin: boolean;
}

export function getStoreUser(req: NextRequest): StoreUser | null {
  const header = req.headers.get("authorization") || "";
  const bearer = /^bearer\s+/i.test(header) ? header.replace(/^bearer\s+/i, "").trim() : "";
  const token = bearer || req.cookies.get("seo_platform_token")?.value || "";
  if (!token) return null;
  const payload = verifySignedToken(token);
  if (!payload?.sub) return null;
  return { id: payload.sub, email: payload.email, isAdmin: Boolean(payload.is_admin) };
}

const unauthorized = () => NextResponse.json({ detail: "Oturum gerekli. Lütfen yeniden giriş yapın." }, { status: 401 });
const notFound = () => NextResponse.json({ detail: "Kayıt bulunamadı veya erişim yetkiniz yok." }, { status: 404 });

export function guardStoreUser(req: NextRequest): StoreUser | NextResponse {
  return getStoreUser(req) ?? unauthorized();
}

/** Organizasyon bu kullanıcıya ait değilse varlığını da sızdırmamak için 404 döner. */
export function guardStoreOrg(req: NextRequest, orgId: string): StoreUser | NextResponse {
  const user = getStoreUser(req);
  if (!user) return unauthorized();
  if (!serverlessStore.isOrgMember(orgId, user.id)) return notFound();
  return user;
}

export function guardStoreSite(req: NextRequest, orgId: string, siteId: string): { user: StoreUser; site: SiteResponse } | NextResponse {
  const user = guardStoreOrg(req, orgId);
  if (user instanceof NextResponse) return user;
  const site = serverlessStore.getSiteById(siteId);
  if (!site || site.organization_id !== orgId) return notFound();
  return { user, site };
}
