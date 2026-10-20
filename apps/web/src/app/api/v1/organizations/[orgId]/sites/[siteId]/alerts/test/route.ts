import { NextRequest, NextResponse } from "next/server";
import { tryBackendProxy } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ orgId: string; siteId: string }> }
) {
  const params = await ctx.params;
  const proxied = await tryBackendProxy(req, `/organizations/${params.orgId}/sites/${params.siteId}/alerts/test`);
  return (
    proxied ??
    NextResponse.json(
      { detail: "Alarm servisine ulaşılamıyor. Lütfen biraz sonra tekrar deneyin." },
      { status: 503, headers: { "Retry-After": "30" } }
    )
  );
}
