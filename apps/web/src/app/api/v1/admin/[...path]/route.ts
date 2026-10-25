import { NextRequest } from "next/server";
import { joinPathSegments, proxyBackendOnly } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyBackendOnly(req, `/admin/${joinPathSegments(path)}`, "Yönetim paneli şu an kullanılamıyor: arka uç servisine ulaşılamadı.");
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
