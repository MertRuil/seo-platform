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
    `/organizations/${params.orgId}/sites/${params.siteId}/change-sets`
  );
  if (proxied) return proxied;

  const sets = serverlessStore.getChangeSets(params.siteId);
  return NextResponse.json(sets);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string; siteId: string } }
) {
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/change-sets`
  );
  if (proxied) return proxied;

  const body = await req.json().catch(() => ({}));
  const cs = serverlessStore.createChangeSet(params.siteId, {
    recommendation_id: body.recommendation_id,
    risk_level: body.risk_level,
    items: body.items || [],
  });
  return NextResponse.json(cs, { status: 201 });
}
