/**
 * Auth köprüsü: Next.js giriş/kayıt rotaları önce FastAPI arka ucunu dener.
 * Başarılıysa arka ucun JWT'si döner (canlı veriye giden tek yol);
 * arka uç yoksa veya kullanıcı orada tanımlı değilse yerel depoya düşülür.
 */

const BACKEND = (process.env.BACKEND_API_URL || "").replace(/\/$/, "");
const TIMEOUT_MS = 4000;

export interface BridgedSession {
  access_token: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    permissions: string[];
  };
}

type BridgeResult = { ok: true; session: BridgedSession } | { ok: false; status: number; detail?: string };

async function backendFetch(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${BACKEND}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

async function sessionFromToken(accessToken: string, fallbackEmail: string): Promise<BridgedSession> {
  let me: { id?: string; email?: string; full_name?: string | null; is_platform_admin?: boolean } | null = null;
  try {
    const r = await backendFetch("/auth/me", { headers: { Authorization: `Bearer ${accessToken}` } });
    if (r.ok) me = await r.json();
  } catch {
    /* profil alınamazsa e-posta ile devam */
  }
  const isAdmin = Boolean(me?.is_platform_admin);
  return {
    access_token: accessToken,
    user: {
      id: me?.id || fallbackEmail,
      email: me?.email || fallbackEmail,
      fullName: me?.full_name || fallbackEmail.split("@")[0],
      role: isAdmin ? "Platform Yöneticisi" : "SEO Yöneticisi",
      isAdmin,
      isSuperAdmin: isAdmin,
      permissions: isAdmin ? ["read", "crawl", "audit", "recommendations", "execute", "rollback", "admin"] : ["read", "crawl", "audit", "recommendations"],
    },
  };
}

/** status 0 = arka uca ulaşılamadı (yerel depoya düş). */
export async function backendLogin(email: string, password: string): Promise<BridgeResult> {
  if (!BACKEND) return { ok: false, status: 0 };
  try {
    const r = await backendFetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      return { ok: false, status: r.status, detail: typeof data.detail === "string" ? data.detail : undefined };
    }
    const tok = (await r.json()) as { access_token: string };
    return { ok: true, session: await sessionFromToken(tok.access_token, email) };
  } catch {
    return { ok: false, status: 0 };
  }
}

export async function backendRegister(email: string, password: string, fullName: string): Promise<BridgeResult> {
  if (!BACKEND) return { ok: false, status: 0 };
  try {
    const r = await backendFetch("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      return { ok: false, status: r.status, detail: typeof data.detail === "string" ? data.detail : undefined };
    }
    return backendLogin(email, password);
  } catch {
    return { ok: false, status: 0 };
  }
}
