import { NextRequest, NextResponse } from "next/server";
import { tryBackendProxy } from "@/lib/backend-proxy";

export const dynamic = "force-dynamic";

// Specific Next routes take precedence; the remaining API belongs to FastAPI.
async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (path.some((part) => !part || part === "." || part === ".." || /[\\/]/.test(part))) {
    return NextResponse.json({ detail: "Geçersiz API yolu" }, { status: 400 });
  }
  const query = req.nextUrl.search;
  return await tryBackendProxy(req, `/${path.map(encodeURIComponent).join("/")}${query}`)
    ?? NextResponse.json({ detail: "API servisine ulaşılamıyor. Lütfen daha sonra tekrar deneyin." }, { status: 503 });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as OPTIONS };
