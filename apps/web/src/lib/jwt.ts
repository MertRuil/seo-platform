import crypto from "crypto";
import fs from "fs";
import path from "path";

let cachedSecret: string | null = null;

function searchEnvFiles(): string | null {
  const candidateDirs: string[] = [];

  // 1. Current working directory and parents up to 5 levels
  let cur = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (!candidateDirs.includes(cur)) candidateDirs.push(cur);
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  // 2. Dirname of this module and parents up to 5 levels (if __dirname exists)
  if (typeof __dirname !== "undefined") {
    let dir = __dirname;
    for (let i = 0; i < 5; i++) {
      if (!candidateDirs.includes(dir)) candidateDirs.push(dir);
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  const envFiles = [".env.local", ".env", ".env.production", ".env.development"];

  for (const dir of candidateDirs) {
    for (const file of envFiles) {
      const fullPath = path.resolve(dir, file);
      try {
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, "utf8");
          const match = content.match(/^\s*(?:APP_SECRET_KEY|JWT_SECRET|SECRET_KEY)\s*=\s*(.+)$/m);
          if (match && match[1]) {
            const val = match[1].trim().replace(/^["']|["']$/g, "");
            if (val.length >= 16) {
              return val;
            }
          }
        }
      } catch {
        // ignore read/permission errors
      }
    }
  }
  return null;
}

export function getJwtSecret(): string {
  if (cachedSecret && cachedSecret.length >= 16) {
    return cachedSecret;
  }

  // 1. Ortam değişkenlerinden kontrol et
  const envKeys = ["APP_SECRET_KEY", "JWT_SECRET", "SECRET_KEY", "NEXTAUTH_SECRET"];
  for (const key of envKeys) {
    const val = process.env[key];
    if (val && val.trim().length >= 16) {
      cachedSecret = val.trim();
      process.env.APP_SECRET_KEY = cachedSecret;
      return cachedSecret;
    }
  }

  // 2. .env dosyalarından yüklemeyi dene
  const fileSecret = searchEnvFiles();
  if (fileSecret && fileSecret.trim().length >= 16) {
    cachedSecret = fileSecret.trim();
    process.env.APP_SECRET_KEY = cachedSecret;
    return cachedSecret;
  }

  // 3. Ortam değişkeni veya .env bulunamadığında:
  // Sabit (hardcoded) bilinen bir anahtar KULLANILMAZ.
  // Bunun yerine, tahmin edilemez 256-bit kriptografik rastgele bir oturum anahtarı üretilir.
  // Böylece hem dış saldırganların token taklit etmesi (token forgery) matematiksel olarak imkansız hale gelir,
  // hem de platform 500 hatası vermeden güvenle ve kesintisiz çalışır.
  const generatedSecret = crypto.randomBytes(32).toString("hex");
  cachedSecret = generatedSecret;
  process.env.APP_SECRET_KEY = cachedSecret;

  if (typeof window === "undefined") {
    console.warn(
      "\x1b[33m[Güvenlik Uyarısı] APP_SECRET_KEY ortam değişkeni tanımlanmamış. " +
      "Oturum güvenliği için çalışma zamanında 256-bit kriptografik rastgele geçici anahtar üretildi. " +
      "Sunucu yeniden başlatıldığında mevcut oturumların korunması için .env dosyasına APP_SECRET_KEY tanımlamanız önerilir.\x1b[0m"
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
