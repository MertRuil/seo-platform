import { NextRequest, NextResponse } from "next/server";
import { tryBackendProxy } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

/** Yönetim uçları yalnızca arka uçtan okunur; yerel depoya ya da örnek veriye düşülmez. */
async function proxy(req: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  const endpoint = `/admin/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const proxied = await tryBackendProxy(req, endpoint);
  if (proxied) return proxied;
  return NextResponse.json(
    { detail: "Yönetim paneli şu an kullanılamıyor: arka uç servisine ulaşılamadı." },
    { status: 503, headers: { "Retry-After": "30" } }
  );
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
