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
    `/organizations/${params.orgId}/sites/${params.siteId}/connectors`
  );
  if (proxied) return proxied;

  const connectors = serverlessStore.listConnectors(params.siteId);
  return NextResponse.json(connectors);
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ orgId: string; siteId: string }> }
) {
  const params = await ctx.params;
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/connectors`
  );
  if (proxied) return proxied;

  const body = await req.json().catch(() => ({}));
  try {
    const updated = serverlessStore.saveConnector(params.siteId, body);
    return NextResponse.json(updated, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { detail: err.message || "Bağlayıcı kaydedilemedi" },
      { status: 400 }
    );
  }
}
