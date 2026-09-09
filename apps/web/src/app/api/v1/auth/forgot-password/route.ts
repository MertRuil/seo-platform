import { NextResponse } from "next/server";
import { authStore } from "@/lib/auth-users";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, newPassword } = body;

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

    // Şifre sıfırlama talebi
    if (newPassword) {
      if (String(newPassword).length < 8) {
        return NextResponse.json(
          { error: "Yeni şifre en az 8 karakter olmalıdır." },
          { status: 400 }
        );
      }

      authStore.updatePassword(cleanEmail, String(newPassword));
      authStore.clearFailedAttempts(cleanEmail);

      return NextResponse.json({
        success: true,
        message: "Şifreniz başarıyla sıfırlandı. Yeni şifrenizle giriş yapabilirsiniz.",
      });
    }

    // Sıfırlama kodu / linki gönderimi simülasyonu
    authStore.clearFailedAttempts(cleanEmail);
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    return NextResponse.json({
      success: true,
      message: `${cleanEmail} adresine 6 haneli şifre sıfırlama kodu gönderildi.`,
      reset_code: resetCode,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Şifre sıfırlama işlemi sırasında hata oluştu: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
