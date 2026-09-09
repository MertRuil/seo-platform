import { NextResponse } from "next/server";
import { authStore } from "@/lib/auth-users";

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
      user = {
        id: `usr_${provider.toLowerCase()}_${Date.now().toString(36)}`,
        email: ssoEmail,
        password: "OAuthSecurePass_999*",
        fullName: `${providerLabel} Kullanıcısı`,
        role: "SEO Yöneticisi",
        isAdmin: true,
        isSuperAdmin: false,
        permissions: ["read", "crawl", "audit", "recommendations", "execute"],
        createdAt: new Date().toISOString()
      };
      authStore.addUser(user);
    }

    authStore.clearFailedAttempts(ssoEmail);

    const token = `jwt_seo_${Buffer.from(`${user.id}:${Date.now()}`).toString("base64")}`;

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
      httpOnly: false,
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
