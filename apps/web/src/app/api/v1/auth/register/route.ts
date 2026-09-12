import { NextResponse } from "next/server";
import { authStore } from "@/lib/auth-users";
import { createSignedToken } from "@/lib/jwt";
import crypto from "crypto";
import { backendRegister } from "@/lib/backend-auth";

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

    // Coerce before length checks: a numeric/object password would otherwise skip min-length validation
    if (typeof password !== "string" || typeof email !== "string") {
      return NextResponse.json(
        { error: "E-posta ve şifre metin olmalıdır." },
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

    // Önce arka uç (FastAPI) kaydı: başarılıysa gerçek kullanıcı ve JWT döner.
    const bridged = await backendRegister(cleanEmail, password, String(fullName).trim());
    if (bridged.ok) {
      const res = NextResponse.json(
        { success: true, message: "Hesabınız oluşturuldu.", access_token: bridged.session.access_token, token_type: "bearer", user: bridged.session.user, expires_in: 86400, source: "backend" },
        { status: 201 }
      );
      res.cookies.set({ name: "seo_platform_token", value: bridged.session.access_token, httpOnly: true, secure: process.env.NODE_ENV === "production", maxAge: 86400, path: "/", sameSite: "lax" });
      return res;
    }
    if (bridged.status === 409 || bridged.status === 400) {
      return NextResponse.json({ error: bridged.detail || "Bu e-posta adresiyle kayıtlı bir hesap zaten var." }, { status: bridged.status });
    }

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
