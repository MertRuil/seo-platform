import { NextRequest } from "next/server";
import { proxyBackendOnly } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return proxyBackendOnly(req, "/auth/me", "Hesap bilgisi şu an alınamıyor: arka uç servisine ulaşılamadı.");
}
