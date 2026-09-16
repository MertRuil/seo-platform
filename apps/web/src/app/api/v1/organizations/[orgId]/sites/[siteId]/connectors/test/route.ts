import { NextRequest, NextResponse } from "next/server";
import { tryBackendProxy } from "@/lib/backend-proxy";
import { validateSafeAuditUrl, safeAuditFetch, SSRFSecurityError } from "@/lib/ssrf";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ orgId: string; siteId: string }> }
) {
  const params = await ctx.params;
  // First try backend proxy (FastAPI with native Python connectors)
  const proxied = await tryBackendProxy(
    req,
    `/organizations/${params.orgId}/sites/${params.siteId}/connectors/test`
  );
  if (proxied) return proxied;

  // Fallback: Standalone live testing with SSRF protection
  const body = await req.json().catch(() => ({}));
  const { connector_type, base_url, credentials, endpoint } = body;
  const targetUrl = base_url || endpoint || "";

  if (targetUrl.startsWith("mock://")) {
    return NextResponse.json({
      success: true,
      status_code: 200,
      message: "Simülasyon bağlantısı ve yetki testi başarılı. Tüm bağlayıcı fonksiyonları aktif.",
      capabilities: ["CAN_EDIT_TITLE", "CAN_EDIT_META", "CAN_EDIT_CANONICAL", "CAN_EDIT_CONTENT"],
    });
  }

  if (!targetUrl) {
    return NextResponse.json({
      success: false,
      status_code: 400,
      message: "Uç nokta URL adresi belirtilmelidir.",
      capabilities: [],
    });
  }

  try {
    const validated = await validateSafeAuditUrl(targetUrl);
    const res = await safeAuditFetch(validated.toString(), {
      headers: {
        "User-Agent": "Autonomous-SEO-Bot/1.0 (+https://calpeo.io/bot)",
      },
    });

    if (res.statusCode >= 200 && res.statusCode < 400) {
      return NextResponse.json({
        success: true,
        status_code: res.statusCode,
        message: `Uç nokta başarıyla doğrulandı (HTTP ${res.statusCode}). Bağlayıcı veri aktarımına hazır.`,
        capabilities: ["CAN_EDIT_TITLE", "CAN_EDIT_META", "CAN_EDIT_CANONICAL"],
      });
    } else {
      return NextResponse.json({
        success: false,
        status_code: res.statusCode,
        message: `Uç noktadan beklenmeyen durum kodu alındı (HTTP ${res.statusCode}). Lütfen yetkilendirme anahtarlarını kontrol edin.`,
        capabilities: [],
      });
    }
  } catch (err: any) {
    if (err instanceof SSRFSecurityError) {
      return NextResponse.json({
        success: false,
        status_code: 403,
        message: `Güvenlik Kalkanı (SSRF): Hedef adrese erişim engellendi (${err.message}).`,
        capabilities: [],
      });
    }
    return NextResponse.json({
      success: false,
      status_code: 502,
      message: `Bağlantı hatası: ${err.message || "Hedef sunucuya ulaşılamadı"}`,
      capabilities: [],
    });
  }
}
