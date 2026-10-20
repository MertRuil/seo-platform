import { NextRequest, NextResponse } from "next/server";
import { tryBackendProxy } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

// Backlink verisi yalnızca arka uçta tutulur; yerel yedek depo yoktur.
function backlinksUnavailable() {
  return NextResponse.json(
    { detail: "Backlink servisine ulaşılamıyor. Lütfen biraz sonra tekrar deneyin." },
    { status: 503, headers: { "Retry-After": "30" } }
  );
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ orgId: string; siteId: string }> }
) {
  const params = await ctx.params;
  const proxied = await tryBackendProxy(req, `/organizations/${params.orgId}/sites/${params.siteId}/backlinks`);
  return proxied ?? backlinksUnavailable();
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ orgId: string; siteId: string }> }
) {
  const params = await ctx.params;
  const proxied = await tryBackendProxy(req, `/organizations/${params.orgId}/sites/${params.siteId}/backlinks`);
  return proxied ?? backlinksUnavailable();
}
