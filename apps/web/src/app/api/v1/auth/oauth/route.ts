import { NextResponse } from "next/server";
import { authStore } from "@/lib/auth-users";
import crypto from "crypto";

const JWT_SECRET = process.env.APP_SECRET_KEY || "autonomous-seo-platform-secure-token-signing-key-2026";

function createSignedToken(user: { id: string; email: string; role: string; isAdmin?: boolean }) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: user.id,
    email: user.email,
    role: user.role,
    type: "access",
    is_admin: Boolean(user.isAdmin),
    exp: Math.floor(Date.now() / 1000) + 86400,
    iat: Math.floor(Date.now() / 1000),
  })).toString("base64url");
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider } = body; // "google" | "github" | "microsoft"

    if (!provider) {
      return NextResponse.json(
        { error: "Giriş sağlayıcısı (provider) zorunludur." },
        { status: 400 }
      );
    }

    const providerNames: Record<string, string> = {
      google: "Google Workspace",
      github: "GitHub Developer",
      microsoft: "Microsoft Entra ID",
    };

    const providerLabel = providerNames[provider.toLowerCase()] || provider;
    const ssoEmail = `${provider.toLowerCase()}_user@seoplatform.com`;
    let user = authStore.findUserByEmail(ssoEmail);

    if (!user) {
      user = authStore.addUser({
        id: `usr_${provider.toLowerCase()}_${Date.now().toString(36)}`,
        email: ssoEmail,
        password: crypto.randomBytes(24).toString("hex"),
        fullName: `${providerLabel} Kullanıcısı`,
        role: "SEO Yöneticisi",
        isAdmin: true,
        isSuperAdmin: false,
        permissions: ["read", "crawl", "audit", "recommendations", "execute"],
        createdAt: new Date().toISOString()
      });
    }

    authStore.clearFailedAttempts(ssoEmail);

    const token = createSignedToken({ id: user.id, email: user.email, role: user.role, isAdmin: user.isAdmin });

    const responseData = {
      success: true,
      message: `${providerLabel} ile güvenli giriş başarılı.`,
      access_token: token,
      token_type: "bearer",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        permissions: user.permissions,
      },
      expires_in: 86400,
    };

    const res = NextResponse.json(responseData, { status: 200 });

    res.cookies.set({
      name: "seo_platform_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 86400,
      path: "/",
      sameSite: "lax",
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: "SSO Giriş işlemi sırasında hata: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
