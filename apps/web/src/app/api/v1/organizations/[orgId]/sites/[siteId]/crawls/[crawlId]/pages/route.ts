import { NextRequest, NextResponse } from "next/server";
import { serverlessStore } from "@/lib/serverless-store";
import { tryBackendProxy } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string; siteId: string; crawlId: string } }
) {
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/crawls/${params.crawlId}/pages?${req.nextUrl.searchParams.toString()}`
  );
  if (proxied) return proxied;

  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "100", 10);
  const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0", 10);
  const pages = serverlessStore.getCrawlPages(params.crawlId, limit, offset);
  return NextResponse.json(pages);
}
