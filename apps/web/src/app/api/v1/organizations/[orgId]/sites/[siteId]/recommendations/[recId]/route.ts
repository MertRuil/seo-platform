import { NextRequest, NextResponse } from "next/server";
import { serverlessStore } from "@/lib/serverless-store";
import { tryBackendProxy } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orgId: string; siteId: string; recId: string } }
) {
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/recommendations/${params.recId}`
  );
  if (proxied) return proxied;

  const body = await req.json().catch(() => ({}));
  const updated = serverlessStore.updateRecommendationStatus(
    params.siteId,
    params.recId,
    body.status || "APPROVED"
  );
  if (!updated) {
    return NextResponse.json({ detail: "Öneri bulunamadı" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
