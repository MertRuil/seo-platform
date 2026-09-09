import { NextResponse } from "next/server";
import { authStore } from "@/lib/auth-users";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, code, newPassword, action } = body;

    if (!email) {
      return NextResponse.json(
        { error: "E-posta adresi zorunludur." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = authStore.findUserByEmail(cleanEmail);

    if (!user) {
      return NextResponse.json(
        { error: "Bu e-posta adresine ait bir kullanıcı hesabı bulunamadı." },
        { status: 404 }
      );
    }

    // 1. Şifre Güncelleme Adımı (Kod + Yeni Şifre zorunludur)
    if (newPassword || code) {
      if (!code || !String(code).trim()) {
        return NextResponse.json(
          { error: "Güvenlik gerekçesiyle şifre sıfırlamak için 6 haneli doğrulama kodu zorunludur." },
          { status: 400 }
        );
      }

      if (!newPassword || String(newPassword).length < 8) {
        return NextResponse.json(
          { error: "Yeni şifre en az 8 karakter uzunluğunda olmalıdır." },
          { status: 400 }
        );
      }

      const resetResult = authStore.verifyAndResetPassword(cleanEmail, String(code).trim(), String(newPassword));
      if (!resetResult.success) {
        return NextResponse.json(
          { error: resetResult.error || "Geçersiz veya süresi dolmuş kod." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Şifreniz başarıyla sıfırlandı. Yeni şifrenizle giriş yapabilirsiniz.",
      });
    }

    // 2. Doğrulama Kodu Talebi (Kod üretilir, ASLA API yanıtında dışarı sızdırılmaz)
    const resetCode = authStore.createResetCode(cleanEmail);
    // Gerçek prodüksiyonda SMTP/SendGrid e-posta servisine iletilir:
    // console.log(`[SECURE DISPATCH] Reset code for ${cleanEmail} sent via email.`);

    return NextResponse.json({
      success: true,
      step: "code_sent",
      message: `${cleanEmail} adresine 6 haneli tek kullanımlık güvenlik kodu gönderildi (10 dakika geçerlidir).`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Şifre sıfırlama işlemi sırasında hata oluştu: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
