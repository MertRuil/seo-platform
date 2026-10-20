import { NextRequest } from "next/server";
import { tryBackendProxy, demoFallbackOrUnavailable } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ orgId: string; siteId: string }> }
) {
  const params = await ctx.params;
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/experiments`
  );
  if (proxied) return proxied;

  const body = await req.json().catch(() => ({}));
  return demoFallbackOrUnavailable(() => ({
    experiment_name: body.name || "Başlık & Snippet Optimizasyon Testi",
    diff_in_diff_lift: 14.2,
    variant_relative_lift_percent: 18.6,
    is_statistically_significant: true,
    conclusion: "Örnek sonuç: arka uç olmadan deney analizi yapılamaz.",
    is_simulated: true,
  }));
}
