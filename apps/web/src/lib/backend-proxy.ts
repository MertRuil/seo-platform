import { NextRequest, NextResponse } from "next/server";

const BACKEND = (process.env.BACKEND_API_URL || "").replace(/\/$/, "");
const TIMEOUT_MS = 2500;

export async function tryBackendProxy(req: NextRequest, endpointPath: string): Promise<NextResponse | null> {
  if (!BACKEND) return null;

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
      signal: AbortSignal.timeout(TIMEOUT_MS),
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
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
  } catch {
    // Backend unreachable, fallback to serverless MVP store
    return null;
  }
}
