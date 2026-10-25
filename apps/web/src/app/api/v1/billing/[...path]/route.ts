import { NextRequest } from "next/server";
import { joinPathSegments, proxyBackendOnly } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

// Plan kataloğu ve abonelik bilgisi uydurulamaz; arka uç yoksa 503.
async function proxy(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyBackendOnly(req, `/billing/${joinPathSegments(path)}`, "Faturalama şu an kullanılamıyor: arka uç servisine ulaşılamadı.");
}

export const GET = proxy;
export const POST = proxy;
