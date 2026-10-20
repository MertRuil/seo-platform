import { NextRequest, NextResponse } from "next/server";
import { extractAndVerifyRequestToken } from "@/lib/jwt";

const BACKEND = (process.env.BACKEND_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
const IS_PRODUCTION = (process.env.NODE_ENV as string) === "production";

// Read timeout default 15s; mutating operation timeout default 35s (configurable via env)
const READ_TIMEOUT_MS = parseInt(process.env.BACKEND_TIMEOUT_MS || "15000", 10);
const WRITE_TIMEOUT_MS = parseInt(process.env.BACKEND_WRITE_TIMEOUT_MS || "35000", 10);

const HOP_BY_HOP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-length",
  "te",
  "trailer",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization",
]);

function enforceFallbackAuth(req: NextRequest): NextResponse | null {
  const tokenPayload = extractAndVerifyRequestToken(req);
  if (!tokenPayload) {
    return NextResponse.json(
      { detail: "Yetkisiz erişim: Geçerli bir oturum belirteci (JWT) gereklidir." },
      { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
    );
  }
  return null;
}

export async function tryBackendProxy(req: NextRequest, endpointPath: string): Promise<NextResponse | null> {
  if (!BACKEND) {
    return enforceFallbackAuth(req);
  }

  const isMutation = req.method !== "GET" && req.method !== "HEAD";
  const timeout = isMutation ? WRITE_TIMEOUT_MS : READ_TIMEOUT_MS;

  try {
    const url = `${BACKEND}${endpointPath}`;
    const headers: Record<string, string> = {};
    req.headers.forEach((val, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        headers[key] = val;
      }
    });

    // If client authenticated via httpOnly cookie without explicit Authorization header, forward as Bearer
    if (!headers["authorization"] && !headers["Authorization"]) {
      const cookieToken = req.cookies?.get?.("seo_platform_token")?.value;
      if (cookieToken) {
        headers["Authorization"] = `Bearer ${cookieToken}`;
      }
    }

    const init: RequestInit = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(timeout),
    };

    if (isMutation) {
      try {
        const cloned = req.clone();
        const bodyText = await cloned.text();
        if (bodyText) init.body = bodyText;
      } catch {
        // no body
      }
    }

    const res = await fetch(url, init);
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || String(err).includes("timeout") || String(err).includes("aborted");

    // Üretim ortamında REQUIRE_STRICT_BACKEND açıkça "false" yapılmadıkça sahte veriye düşülmez; 502/504 döner.
    const strictBackend =
      process.env.REQUIRE_STRICT_BACKEND === "true" ||
      (IS_PRODUCTION && process.env.REQUIRE_STRICT_BACKEND !== "false");

    if (strictBackend) {
      if (isTimeout) {
        return NextResponse.json(
          { error: "Arka uç servisi zaman aşımına uğradı (504 Gateway Timeout).", detail: `İşlem ${timeout}ms süresince tamamlanamadı.` },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: "Arka uç servisine bağlanılamadı (502 Bad Gateway).", detail: "Üretim ortamında veri yalnızca arka uçtan (PostgreSQL) okunur; sahte veriye düşülmez." },
        { status: 502 }
      );
    }

    // Geliştirme veya standalone mod: mutasyon isteklerinde (POST, PUT, DELETE, PATCH) zaman aşımında sessizce sahte veriye düşülmemeli
    if (isMutation && isTimeout) {
      return NextResponse.json(
        {
          error: "Arka uç servisi zaman aşımına uğradı (504 Gateway Timeout).",
          detail: `İşlem ${timeout}ms süresince tamamlanamadı. Veri bütünlüğünü korumak ve mükerrer tetiklemeyi önlemek için sahte veriye düşülmedi.`
        },
        { status: 504 }
      );
    }

    // Yerel depoya (serverlessStore) düşmeden önce JWT kimlik doğrulaması zorunludur
    const authError = enforceFallbackAuth(req);
    if (authError) return authError;

    // Yerel depoya düşülür (null => çağıran rota serverlessStore kullanır)
    return null;
  }
}

/**
 * Arka uç yanıt vermediğinde örnek (DEMO_*) veri yalnızca geliştirme ortamında dönebilir.
 * Üretimde kullanıcının kendi sitesi için uydurma sonuç gösterilmez; 503 döner.
 */
export function demoFallbackOrUnavailable(build: () => unknown): NextResponse {
  if (IS_PRODUCTION) {
    return NextResponse.json(
      { detail: "Bu servis şu an kullanılamıyor: arka uç servisine ulaşılamadı. Lütfen biraz sonra tekrar deneyin." },
      { status: 503, headers: { "Retry-After": "30" } }
    );
  }
  return NextResponse.json(build());
}
