import { NextResponse } from "next/server";
import { authStore, isLocalAuthEnabled } from "@/lib/auth-users";
import { sendEmail } from "@/lib/email-service";
import { NextRequest } from "next/server";
import { tryBackendProxy } from "@/lib/backend-proxy";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, code, newPassword } = body;

    if (!email) {
      return NextResponse.json(
        { error: "E-posta adresi zorunludur." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const resetting = Boolean(code || newPassword);
    const backendRequest = new NextRequest(request.url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(resetting ? { email: cleanEmail, token: code || "", new_password: newPassword || "" } : { email: cleanEmail }),
    });
    const backend = await tryBackendProxy(backendRequest, resetting ? "/auth/reset-password" : "/auth/forgot-password");
    if (backend) {
      const result = await backend.json().catch(() => ({}));
      return NextResponse.json(backend.ok ? { success: true, message: result.message, step: resetting ? undefined : "code_sent" } : { error: result.detail || result.error || "Şifre sıfırlama tamamlanamadı" }, { status: backend.status });
    }

    // Bu kod tabanlı sıfırlama akışı yalnızca yerel (geliştirme) kullanıcı deposu için çalışır.
    // Üretimde kullanıcılar PostgreSQL'dedir; arka uç e-posta ile sıfırlama akışına bağlanana kadar kapalı tutulur.
    if (!isLocalAuthEnabled()) {
      return NextResponse.json(
        { error: "Şifre sıfırlama bu ortamda henüz aktif değil. Lütfen sistem yöneticinizle iletişime geçin." },
        { status: 503 }
      );
    }

    const user = authStore.findUserByEmail(cleanEmail);

    if (!user) {
      return NextResponse.json(
        { error: "Bu e-posta adresiyle kayıtlı bir hesap bulunamadı. Lütfen kontrol edin veya 'Yeni Kayıt Ol' sekmesinden kaydolun." },
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

    // 2. Doğrulama Kodu Talebi
    const resetCode = authStore.createResetCode(cleanEmail);

    const emailResult = await sendEmail(
      {
        to: cleanEmail,
        subject: "CALPEO Güvenlik - Şifre Sıfırlama Doğrulama Kodu",
        text: `CALPEO hesabınız için şifre sıfırlama talebinde bulunuldu.\n\nDoğrulama Kodunuz: ${resetCode}\n\nBu kod 10 dakika geçerlidir.`,
      },
      resetCode
    );

    const isSimulation = emailResult.method === "simulation" || process.env.NODE_ENV !== "production";

    return NextResponse.json({
      success: true,
      step: "code_sent",
      message: isSimulation
        ? `${cleanEmail} adresi için 6 haneli güvenlik kodu hazırlandı.`
        : `${cleanEmail} adresine 6 haneli doğrulama kodu e-posta ile gönderildi.`,
      preview_code: isSimulation ? resetCode : undefined,
      is_simulation: isSimulation,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Şifre sıfırlama işlemi sırasında hata oluştu: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
