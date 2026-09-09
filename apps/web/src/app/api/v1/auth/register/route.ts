import { NextResponse } from "next/server";
import { authStore } from "@/lib/auth-users";

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

    // Otomatik oturum belirteci oluştur
    const token = `jwt_seo_${Buffer.from(`${newUser.id}:${Date.now()}`).toString("base64")}`;

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
      httpOnly: false,
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
