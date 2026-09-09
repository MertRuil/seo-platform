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
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-posta ve şifre zorunludur." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = authStore.findUserByEmail(cleanEmail);

    if (!user || !authStore.verifyUserPassword(cleanEmail, String(password))) {
      const attempts = authStore.incrementFailedAttempts(cleanEmail);
      const showForgotPassword = attempts >= 3;

      return NextResponse.json(
        {
          error: showForgotPassword
            ? `Şifre ${attempts} kez hatalı girildi. Güvenliğiniz için lütfen şifrenizi sıfırlayın.`
            : `Geçersiz e-posta veya şifre (${attempts}/3 deneme).`,
          failed_attempts: attempts,
          show_forgot_password: showForgotPassword,
        },
        { status: 401 }
      );
    }

    // Başarılı giriş -> hatalı denemeleri temizle
    authStore.clearFailedAttempts(cleanEmail);

    // Güvenli imzalı oturum belirteci üret
    const token = createSignedToken({ id: user.id, email: user.email, role: user.role, isAdmin: user.isAdmin });

    const responseData = {
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
      expires_in: 86400, // 24 saat
    };

    const res = NextResponse.json(responseData, { status: 200 });

    // httpOnly: true ile XSS korumalı güvenli çerez
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
      { error: "Giriş işlemi sırasında sunucu hatası oluştu: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
