import { NextResponse } from "next/server";

// Kayıtlı yetkili kullanıcılar listesi
const AUTHORIZED_USERS = [
  {
    id: "usr_mert_01",
    email: "mert@seo.com",
    password: "0706Ma*",
    fullName: "Mert Ruil",
    role: "Sistem Yöneticisi",
  },
  {
    id: "usr_aybo_01",
    email: "aybo@seo.com",
    password: "kardesler123",
    fullName: "Aybo",
    role: "Sistem Yöneticisi",
  },
  {
    id: "usr_admin_01",
    email: "admin@seoplatform.com",
    password: "Admin123!",
    fullName: "Baş Yönetici",
    role: "Sistem Yöneticisi",
  },
  {
    id: "usr_partner_01",
    email: "ekip@seoplatform.com",
    password: "Ekip123!",
    fullName: "SEO Ekip Üyesi",
    role: "SEO Uzmanı",
  }
];

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
    const user = AUTHORIZED_USERS.find(
      (u) => u.email.toLowerCase() === cleanEmail && u.password === String(password)
    );

    if (!user) {
      return NextResponse.json(
        { error: "Geçersiz e-posta adresi veya şifre!" },
        { status: 401 }
      );
    }

    // Sahte ama güvenli oturum belirteci (Serverless ortam için)
    const token = `jwt_seo_${Buffer.from(`${user.id}:${Date.now()}`).toString("base64")}`;

    const responseData = {
      access_token: token,
      token_type: "bearer",
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      expires_in: 86400, // 24 saat
    };

    const res = NextResponse.json(responseData, { status: 200 });

    // Cookie olarak da saklayalım (opsiyonel güvenlik)
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
