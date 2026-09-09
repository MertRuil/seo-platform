import { NextResponse } from "next/server";
import { authStore } from "@/lib/auth-users";

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

    if (!user || user.password !== String(password)) {
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

    // Oturum belirteci
    const token = `jwt_seo_${Buffer.from(`${user.id}:${Date.now()}`).toString("base64")}`;

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

    // Cookie olarak saklayalım
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
      { error: "Giriş işlemi sırasında sunucu hatası oluştu: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
