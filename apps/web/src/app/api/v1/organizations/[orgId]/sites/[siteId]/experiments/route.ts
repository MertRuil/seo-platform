import { NextRequest, NextResponse } from "next/server";
import { tryBackendProxy } from "@/lib/backend-proxy";
import { guardStoreSite } from "@/lib/store-auth";

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

  const guard = guardStoreSite(req, params.orgId, params.siteId);
  if (guard instanceof NextResponse) return guard;

  // Deney değerlendirmesi Search Console verisi ve arka uçtaki fark-içinde-fark motoru gerektirir.
  // Yerel modda sonuç uydurulmaz.
  return NextResponse.json(
    { detail: "Deney değerlendirmesi için sunucu bağlantısı ve Search Console verisi gerekir. Şu anda sonuç hesaplanamıyor." },
    { status: 503 }
  );
}
