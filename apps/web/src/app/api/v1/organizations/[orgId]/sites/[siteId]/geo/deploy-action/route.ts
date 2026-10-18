import { NextRequest, NextResponse } from "next/server";
import { tryBackendProxy } from "@/lib/backend-proxy";
import { serverlessStore } from "@/lib/serverless-store";
import { DEMO_GEO } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ orgId: string; siteId: string }> }
) {
  const params = await ctx.params;
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/geo/deploy-action`
  );
  if (proxied) return proxied;

  const body = await req.json().catch(() => ({}));
  const actionType = String(body.action_type || "DEPLOY_LLMS_TXT");
  const targetUrl = String(body.target_url || "https://flagship-store.com/llms.txt");

  const cs = serverlessStore.createChangeSet(params.siteId, {
    risk_level: "LOW",
    items: [
      {
        target_url: targetUrl,
        operation: actionType,
        state_before: JSON.stringify({ url: targetUrl, geo_active: false }),
        state_after: JSON.stringify({
          url: targetUrl,
          operation: actionType,
          content: body.custom_content || DEMO_GEO.llmsTxtReadiness?.llms_txt_content || "",
        }),
        expected_hash_before: "geo-baseline-hash",
      },
    ],
  });

  return NextResponse.json({
    success: true,
    action_type: actionType,
    target_url: targetUrl,
    operation: actionType,
    change_set_id: cs.id,
    status: "SUCCESS",
    connector_type: "SANDBOX",
    message: `'${actionType}' işlemi (${targetUrl}) başarıyla ChangeSet (#${cs.id}) olarak oluşturuldu ve uygulandı.`,
    preview_diff: {
      before: { url: targetUrl, geo_active: false },
      after: { url: targetUrl, operation: actionType },
    },
  });
}
