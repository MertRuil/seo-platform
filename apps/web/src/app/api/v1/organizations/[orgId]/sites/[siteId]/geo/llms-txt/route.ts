import { NextRequest } from "next/server";
import { tryBackendProxy, demoFallbackOrUnavailable } from "@/lib/backend-proxy";
import { DEMO_GEO } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ orgId: string; siteId: string }> }
) {
  const params = await ctx.params;
  const search = req.nextUrl.search || "";
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/geo/llms-txt${search}`
  );
  if (proxied) return proxied;

  return demoFallbackOrUnavailable(() => ({ ...DEMO_GEO.llmsTxtReadiness, is_simulated: true }));
}
