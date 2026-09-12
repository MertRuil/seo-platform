import { NextRequest, NextResponse } from "next/server";
import { tryBackendProxy } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string; siteId: string } }
) {
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/experiments`
  );
  if (proxied) return proxied;

  const body = await req.json().catch(() => ({}));
  return NextResponse.json({
    experiment_name: body.name || "Başlık & Snippet Optimizasyon Testi",
    diff_in_diff_lift: 14.2,
    variant_relative_lift_percent: 18.6,
    is_statistically_significant: true,
    conclusion: "Varyant grup, kontrol grubuna göre organik arama trafiğinde istatistiksel olarak anlamlı (+%18.6) artış gösterdi.",
  });
}
