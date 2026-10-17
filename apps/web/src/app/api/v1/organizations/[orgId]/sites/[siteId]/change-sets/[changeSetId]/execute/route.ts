import { NextRequest, NextResponse } from "next/server";
import { serverlessStore } from "@/lib/serverless-store";
import { tryBackendProxy } from "@/lib/backend-proxy";
import { guardStoreSite } from "@/lib/store-auth";

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

  const guard = guardStoreSite(req, params.orgId, params.siteId);
  if (guard instanceof NextResponse) return guard;

  const result = serverlessStore.executeChangeSet(params.siteId, params.changeSetId);
  if (!result.success) {
    return NextResponse.json({ ...result, detail: result.detail }, { status: result.status === "NOT_FOUND" ? 404 : 409 });
  }
  return NextResponse.json(result);
}
