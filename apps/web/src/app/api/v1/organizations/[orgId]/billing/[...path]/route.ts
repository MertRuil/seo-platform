import { NextRequest } from "next/server";
import { joinPathSegments, proxyBackendOnly } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orgId: string; path: string[] }> };

async function proxy(req: NextRequest, ctx: Ctx) {
  const { orgId, path } = await ctx.params;
  return proxyBackendOnly(
    req,
    `/organizations/${encodeURIComponent(orgId)}/billing/${joinPathSegments(path)}`,
    "Faturalama şu an kullanılamıyor: arka uç servisine ulaşılamadı."
  );
}

export const GET = proxy;
export const POST = proxy;
