import { NextResponse } from "next/server";
import { authStore } from "@/lib/auth-users";
import { createSignedToken } from "@/lib/jwt";
import { backendLogin } from "@/lib/backend-auth";

function sessionResponse(token: string, user: Record<string, unknown>, source: "backend" | "local") {
  const res = NextResponse.json({ access_token: token, token_type: "bearer", user, expires_in: 86400, source }, { status: 200 });
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

    if (String(password).length > 128) {
      return NextResponse.json(
        { error: "Şifre en fazla 128 karakter olabilir." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Önce arka uç (FastAPI): başarılıysa canlı veriye erişen gerçek JWT döner.
    // Arka uç kapalıysa veya kullanıcı orada yoksa yerel depoya düşülür.
    const bridged = await backendLogin(cleanEmail, String(password));
    if (bridged.ok) {
      return sessionResponse(bridged.session.access_token, bridged.session.user, "backend");
    }

    // Brute-force lockout (5 failures / 15 min), checked before password verification
    if (authStore.isLockedOut(cleanEmail)) {
      return NextResponse.json(
        { error: "Çok fazla hatalı giriş denemesi. Hesap geçici olarak kilitlendi; 15 dakika sonra tekrar deneyin veya şifrenizi sıfırlayın." },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }

    const user = authStore.findUserByEmail(cleanEmail);

    if (!user) {
      return NextResponse.json(
        {
          error: "Bu e-posta adresiyle kayıtlı bir hesap bulunamadı. Lütfen 'Yeni Kayıt Ol' sekmesinden kaydolun veya e-postanızı kontrol edin.",
          failed_attempts: 0,
          show_forgot_password: false,
        },
        { status: 401 }
      );
    }

    if (!authStore.verifyUserPassword(cleanEmail, String(password))) {
      const attempts = authStore.incrementFailedAttempts(cleanEmail);
      const showForgotPassword = attempts >= 3;

      return NextResponse.json(
        {
          error: showForgotPassword
            ? `Şifreniz ${attempts} kez hatalı girildi. Güvenliğiniz için lütfen şifrenizi sıfırlayın.`
            : `Hatalı şifre girdiniz (${attempts}/3 deneme).`,
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

    return sessionResponse(
      token,
      {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isSuperAdmin,
        permissions: user.permissions,
      },
      "local"
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Giriş işlemi sırasında sunucu hatası oluştu: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
