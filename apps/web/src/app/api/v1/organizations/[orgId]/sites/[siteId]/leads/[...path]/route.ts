import { NextRequest } from "next/server";
import { joinPathSegments, proxyBackendOnly } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orgId: string; siteId: string; path: string[] }> };

// generate, quick-audit, export-crm: CRM'e yazan işlemler; yerel depoda taklit edilmez.
export async function POST(req: NextRequest, ctx: Ctx) {
  const { orgId, siteId, path } = await ctx.params;
  return proxyBackendOnly(
    req,
    `/organizations/${encodeURIComponent(orgId)}/sites/${encodeURIComponent(siteId)}/leads/${joinPathSegments(path)}`,
    "Müşteri adayı işlemi yapılamadı: arka uç servisine ulaşılamadı."
  );
}
