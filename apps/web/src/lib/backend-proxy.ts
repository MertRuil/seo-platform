import { NextRequest, NextResponse } from "next/server";

const BACKEND = (process.env.BACKEND_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
const IS_PRODUCTION = (process.env.NODE_ENV as string) === "production";

// Read timeout default 15s; mutating operation timeout default 35s (configurable via env)
const READ_TIMEOUT_MS = parseInt(process.env.BACKEND_TIMEOUT_MS || "15000", 10);
const WRITE_TIMEOUT_MS = parseInt(process.env.BACKEND_WRITE_TIMEOUT_MS || "35000", 10);

export async function tryBackendProxy(req: NextRequest, endpointPath: string): Promise<NextResponse | null> {
  if (!BACKEND) return null;

  const isMutation = req.method !== "GET" && req.method !== "HEAD";
  const timeout = isMutation ? WRITE_TIMEOUT_MS : READ_TIMEOUT_MS;

  try {
    const url = `${BACKEND}${endpointPath}`;
    const headers: Record<string, string> = {};
    req.headers.forEach((val, key) => {
      if (!["host", "cookie", "connection", "content-length"].includes(key.toLowerCase())) {
        headers[key] = val;
      }
    });
    if (!req.headers.has("authorization")) {
      const cookieToken = req.cookies.get("seo_platform_token")?.value;
      if (cookieToken) headers.Authorization = `Bearer ${cookieToken}`;
    }

    const init: RequestInit = {
      method: req.method,
      headers,
      signal: AbortSignal.timeout(timeout),
      redirect: "manual",
      cache: "no-store",
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
    const responseHeaders: Record<string, string> = {
      "Content-Type": res.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    };
    for (const key of ["location", "retry-after"]) {
      const value = res.headers.get(key);
      if (value) responseHeaders[key] = value;
    }
    const stateCookie = res.headers.getSetCookie().filter((cookie) => cookie.startsWith("calpeo_google_state="));
    if (stateCookie.length) responseHeaders["Set-Cookie"] = stateCookie[0];
    return new NextResponse(res.status === 204 || res.status === 304 ? null : data, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || String(err).includes("timeout") || String(err).includes("aborted");

    // Üretimde yerel demo yalnızca açıkça etkinleştirildiğinde kullanılabilir.
    if (IS_PRODUCTION && process.env.ALLOW_LOCAL_DEMO !== "true") {
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

    // Yerel depoya düşülür (null => çağıran rota serverlessStore kullanır)
    return null;
  }
}
