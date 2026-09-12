import { NextRequest, NextResponse } from "next/server";
import { serverlessStore } from "@/lib/serverless-store";
import { tryBackendProxy } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string; siteId: string } }
) {
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/crawls`
  );
  if (proxied) return proxied;

  const crawls = serverlessStore.listCrawls(params.siteId);
  return NextResponse.json(crawls);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string; siteId: string } }
) {
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/crawls`
  );
  if (proxied) return proxied;

  const body = await req.json().catch(() => ({}));
  try {
    const run = await serverlessStore.runLiveCrawl(params.orgId, params.siteId, {
      max_pages: body.max_pages || 10,
      max_depth: body.max_depth || 3,
    });
    return NextResponse.json(run, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || "Tarama başlatılamadı" },
      { status: 400 }
    );
  }
}
