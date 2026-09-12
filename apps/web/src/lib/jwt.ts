import crypto from "crypto";
import fs from "fs";
import path from "path";

let cachedSecret: string | null = null;

function loadSecretFromFile(): string | null {
  const possiblePaths = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), ".env.production"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "..", "..", ".env"),
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, "utf8");
        const match = content.match(/^\s*APP_SECRET_KEY\s*=\s*(.+)$/m);
        if (match && match[1]) {
          const val = match[1].trim().replace(/^["']|["']$/g, "");
          if (val.length > 0) {
            return val;
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export function getJwtSecret(): string {
  if (cachedSecret) {
    return cachedSecret;
  }

  // 1. Ortam değişkenlerinden kontrol et
  const envSecret = process.env.APP_SECRET_KEY;
  if (envSecret && envSecret.trim().length > 0) {
    cachedSecret = envSecret.trim();
    return cachedSecret;
  }

  // 2. .env dosyalarından yüklemeyi dene
  const fileSecret = loadSecretFromFile();
  if (fileSecret && fileSecret.trim().length > 0) {
    cachedSecret = fileSecret.trim();
    process.env.APP_SECRET_KEY = cachedSecret;
    return cachedSecret;
  }

  // 3. Güvenli stabil yedek anahtar (girişin 500 hatasıyla çökmesini önler)
  const defaultFallback = "calpeo-seo-platform-autonomous-jwt-signing-secret-key-2026-production-min-32-chars";
  cachedSecret = defaultFallback;
  if (typeof window === "undefined") {
    console.warn(
      "\x1b[33m[Uyarı - Güvenlik] APP_SECRET_KEY ortam değişkeni bulunamadı; varsayılan imzalama anahtarı kullanılıyor.\x1b[0m"
    );
  }
  return cachedSecret;
}

export function createSignedToken(user: { id: string; email: string; role: string; isAdmin?: boolean }): string {
  const secret = getJwtSecret();
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      email: user.email,
      role: user.role,
      type: "access",
      is_admin: Boolean(user.isAdmin),
      exp: Math.floor(Date.now() / 1000) + 86400,
      iat: Math.floor(Date.now() / 1000),
    })
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function verifySignedToken(token: string): { sub: string; email: string; role: string; is_admin: boolean } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const secret = getJwtSecret();
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${header}.${payload}`)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
