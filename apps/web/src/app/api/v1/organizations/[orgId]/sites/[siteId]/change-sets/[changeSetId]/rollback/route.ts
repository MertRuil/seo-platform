import { NextRequest } from "next/server";
import { proxyBackendOnly } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orgId: string; siteId: string; changeSetId: string }> };

// Canlı sitede geri alma; yerel depoda taklit edilmez.
export async function POST(req: NextRequest, ctx: Ctx) {
  const { orgId, siteId, changeSetId } = await ctx.params;
  return proxyBackendOnly(
    req,
    `/organizations/${encodeURIComponent(orgId)}/sites/${encodeURIComponent(siteId)}/change-sets/${encodeURIComponent(changeSetId)}/rollback`,
    "Geri alma yapılamadı: arka uç servisine ulaşılamadı. Sitede değişiklik yapılmadı."
  );
}
