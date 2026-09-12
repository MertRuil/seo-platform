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
    `/organizations/${params.orgId}/sites/${params.siteId}/crawls/${params.crawlId}/health`
  );
  if (proxied) return proxied;

  const report = serverlessStore.getCrawlHealth(params.crawlId);
  if (!report) {
    return NextResponse.json({ detail: "Sağlık raporu bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(report);
}
