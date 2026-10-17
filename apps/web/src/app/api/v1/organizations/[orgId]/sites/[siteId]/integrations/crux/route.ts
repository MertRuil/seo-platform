import { NextRequest, NextResponse } from "next/server";
import { serverlessStore } from "@/lib/serverless-store";
import { tryBackendProxy } from "@/lib/backend-proxy";
import { guardStoreSite } from "@/lib/store-auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ orgId: string; siteId: string }> }
) {
  const params = await ctx.params;
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/integrations/crux`
  );
  if (proxied) return proxied;

  const guard = guardStoreSite(req, params.orgId, params.siteId);
  if (guard instanceof NextResponse) return guard;

  const crux = serverlessStore.getCruxMetrics(params.siteId);
  return NextResponse.json(crux);
}
