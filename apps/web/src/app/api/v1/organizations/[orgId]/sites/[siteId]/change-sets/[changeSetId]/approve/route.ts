import { NextRequest, NextResponse } from "next/server";
import { serverlessStore } from "@/lib/serverless-store";
import { tryBackendProxy } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string; siteId: string; changeSetId: string } }
) {
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/change-sets/${params.changeSetId}/approve`
  );
  if (proxied) return proxied;

  const cs = serverlessStore.approveChangeSet(params.siteId, params.changeSetId);
  if (!cs) {
    return NextResponse.json({ detail: "Değişiklik seti bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(cs);
}
