import crypto from "crypto";

let ephemeralSecret: string | null = null;

export function getJwtSecret(): string {
  const envSecret = process.env.APP_SECRET_KEY;
  if (envSecret && envSecret.trim().length > 0) {
    return envSecret.trim();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "KRİTİK GÜVENLİK HATASI: APP_SECRET_KEY ortam değişkeni tanımlanmamış. " +
      "Üretim ortamında güvenli bir JWT imzalama anahtarı zorunludur."
    );
  }

  // Geliştirme/test ortamında rastgele geçici anahtar türet (statik zayıf fallback YASAK)
  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(32).toString("hex");
    if (typeof window === "undefined") {
      console.warn(
        "\x1b[33m[Uyarı - Güvenlik] APP_SECRET_KEY tanımlanmadığı için rastgele geçici imzalama anahtarı türetildi.\x1b[0m"
      );
    }
  }
  return ephemeralSecret;
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
