import { NextRequest, NextResponse } from "next/server";
import { serverlessStore } from "@/lib/serverless-store";
import { tryBackendProxy } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ orgId: string; siteId: string; changeSetId: string }> }
) {
  const params = await ctx.params;
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/change-sets/${params.changeSetId}/execute`
  );
  if (proxied) return proxied;

  const result = serverlessStore.executeChangeSet(params.siteId, params.changeSetId);
  return NextResponse.json(result);
}
