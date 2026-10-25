import { NextRequest } from "next/server";
import { proxyBackendOnly } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orgId: string; siteId: string; changeSetId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { orgId, siteId, changeSetId } = await ctx.params;
  return proxyBackendOnly(
    req,
    `/organizations/${encodeURIComponent(orgId)}/sites/${encodeURIComponent(siteId)}/change-sets/${encodeURIComponent(changeSetId)}`,
    "Değişiklik seti şu an okunamıyor: arka uç servisine ulaşılamadı."
  );
}
