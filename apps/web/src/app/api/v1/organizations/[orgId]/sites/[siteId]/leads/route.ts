import { NextRequest } from "next/server";
import { proxyBackendOnly } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orgId: string; siteId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { orgId, siteId } = await ctx.params;
  return proxyBackendOnly(
    req,
    `/organizations/${encodeURIComponent(orgId)}/sites/${encodeURIComponent(siteId)}/leads`,
    "Müşteri adayları şu an okunamıyor: arka uç servisine ulaşılamadı."
  );
}
