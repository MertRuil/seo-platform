import { NextRequest, NextResponse } from "next/server";

const BACKEND = (process.env.BACKEND_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

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
      if (key.toLowerCase() !== "host") {
        headers[key] = val;
      }
    });

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
    
    // Mutasyon isteklerinde (POST, PUT, DELETE, PATCH) sessizce sahte veriye düşülmemeli!
    // Aksi halde tarama başlatma veya değişiklik uygulama gibi işlemler çift tetiklenebilir ya da kullanıcı yanıltılır.
    if (isMutation) {
      if (isTimeout) {
        return NextResponse.json(
          {
            error: "Arka uç servisi zaman aşımına uğradı (504 Gateway Timeout).",
            detail: `İşlem ${timeout}ms süresince tamamlanamadı. Veri bütünlüğünü korumak ve mükerrer tetiklemeyi önlemek için sahte veriye düşülmedi.`
          },
          { status: 504 }
        );
      }
      // Canlı backend tanımlıysa ve connection refused / network error alındıysa:
      if ((process.env.NODE_ENV as string) === "production") {
        return NextResponse.json(
          {
            error: "Arka uç servisine bağlanılamadı (502 Bad Gateway).",
            detail: "Üretim ortamında arka uç kapalıyken mutasyon işlemleri kabul edilemez."
          },
          { status: 502 }
        );
      }
    }

    // Yalnızca yerel geliştirme ortamında ve GET okuma isteklerinde demo fallback'e izin ver
    return null;
  }
}
