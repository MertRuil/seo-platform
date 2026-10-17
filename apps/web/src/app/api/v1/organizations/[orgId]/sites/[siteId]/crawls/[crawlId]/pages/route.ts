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
    `/organizations/${params.orgId}/sites/${params.siteId}/crawls/${params.crawlId}/pages?${req.nextUrl.searchParams.toString()}`
  );
  if (proxied) return proxied;

  const guard = guardStoreSite(req, params.orgId, params.siteId);
  if (guard instanceof NextResponse) return guard;

  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100", 10);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0", 10);
  if (!serverlessStore.listCrawls(params.siteId).some((c) => c.id === params.crawlId)) {
    return NextResponse.json({ detail: "Tarama bulunamadı" }, { status: 404 });
  }
  const pages = serverlessStore.getCrawlPages(params.crawlId, limit, offset);
  return NextResponse.json(pages);
}
