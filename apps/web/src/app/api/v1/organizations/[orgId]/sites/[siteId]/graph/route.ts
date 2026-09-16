import { NextRequest, NextResponse } from "next/server";
import { serverlessStore } from "@/lib/serverless-store";
import { tryBackendProxy } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ orgId: string; siteId: string }> }
) {
  const params = await ctx.params;
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/graph`
  );
  if (proxied) return proxied;

  const graph = serverlessStore.getSiteGraph(params.siteId);
  return NextResponse.json(graph);
}
