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
    const { fullName, email, password } = body;

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: "Ad Soyad, e-posta ve şifre zorunludur." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Şifre en az 8 karakter uzunluğunda olmalıdır." },
        { status: 400 }
      );
    }

    if (password.length > 128) {
      return NextResponse.json(
        { error: "Şifre en fazla 128 karakter olabilir." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const existing = authStore.findUserByEmail(cleanEmail);

    if (existing) {
      return NextResponse.json(
        { error: "Bu e-posta adresiyle kayıtlı bir hesap zaten var." },
        { status: 409 }
      );
    }

    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newUser = {
      id: userId,
      email: cleanEmail,
      password: String(password),
      fullName: String(fullName).trim(),
      role: "SEO Yöneticisi",
      isAdmin: false,
      isSuperAdmin: false,
      permissions: ["read", "crawl", "audit", "recommendations"],
      createdAt: new Date().toISOString()
    };

    authStore.addUser(newUser);

    // Güvenli imzalı oturum belirteci oluştur
    const token = createSignedToken({ id: newUser.id, email: newUser.email, role: newUser.role, isAdmin: newUser.isAdmin });

    const responseData = {
      success: true,
      message: "Hesabınız başarıyla oluşturuldu.",
      access_token: token,
      token_type: "bearer",
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        isAdmin: newUser.isAdmin,
        isSuperAdmin: newUser.isSuperAdmin,
        permissions: newUser.permissions,
      },
      expires_in: 86400,
    };

    const res = NextResponse.json(responseData, { status: 201 });

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
      { error: "Kayıt işlemi sırasında hata oluştu: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
