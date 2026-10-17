import { NextRequest, NextResponse } from "next/server";
import { serverlessStore } from "@/lib/serverless-store";
import { tryBackendProxy } from "@/lib/backend-proxy";
import { guardStoreSite } from "@/lib/store-auth";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ orgId: string; siteId: string; crawlId: string }> }
) {
  const params = await ctx.params;
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/crawls/${params.crawlId}/health`
  );
  if (proxied) return proxied;

  const guard = guardStoreSite(req, params.orgId, params.siteId);
  if (guard instanceof NextResponse) return guard;

  const report = serverlessStore.getCrawlHealth(params.crawlId);
  if (!report || report.site_id !== params.siteId) {
    return NextResponse.json({ detail: "Sağlık raporu bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(report);
}
