import { NextRequest } from "next/server";
import { joinPathSegments, proxyBackendOnly } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

// Bilgi bankası sayfası arka uç yoksa kendi varsayılan kaynak listesini gösterir; vekil sahte sonuç üretmez.
async function proxy(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyBackendOnly(req, `/knowledge/${joinPathSegments(path)}`, "Bilgi bankası şu an kullanılamıyor: arka uç servisine ulaşılamadı.");
}

export const GET = proxy;
export const POST = proxy;
