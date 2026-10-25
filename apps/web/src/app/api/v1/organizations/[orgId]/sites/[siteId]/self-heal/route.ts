import { NextRequest } from "next/server";
import { proxyBackendOnly } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orgId: string; siteId: string }> };

// Canlı sitede değişiklik; doğrulama, plan hakkı ve bağlayıcı kontrolleri arka uçta.
export async function POST(req: NextRequest, ctx: Ctx) {
  const { orgId, siteId } = await ctx.params;
  return proxyBackendOnly(
    req,
    `/organizations/${encodeURIComponent(orgId)}/sites/${encodeURIComponent(siteId)}/self-heal`,
    "Düzeltme uygulanamadı: arka uç servisine ulaşılamadı. Sitede değişiklik yapılmadı."
  );
}
