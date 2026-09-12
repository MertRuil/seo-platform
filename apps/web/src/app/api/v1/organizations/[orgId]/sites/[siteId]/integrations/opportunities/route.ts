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
    `/organizations/${params.orgId}/sites/${params.siteId}/integrations/opportunities`
  );
  if (proxied) return proxied;

  const opps = serverlessStore.getOpportunities(params.siteId);
  return NextResponse.json(opps);
}
