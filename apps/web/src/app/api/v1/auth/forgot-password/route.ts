import { NextResponse } from "next/server";
import { authStore, isLocalAuthEnabled } from "@/lib/auth-users";
import { sendEmail } from "@/lib/email-service";

const RESET_REQUEST_HISTORY = new Map<string, number[]>();
const MAX_RESET_REQUESTS_PER_WINDOW = 5;
const RESET_WINDOW_MS = 15 * 60 * 1000;

function checkResetRateLimit(email: string): boolean {
  const now = Date.now();
  if (RESET_REQUEST_HISTORY.size > 2000) {
    for (const [k, ts] of RESET_REQUEST_HISTORY.entries()) {
      if (!ts.length || now - ts[ts.length - 1] >= RESET_WINDOW_MS) {
        RESET_REQUEST_HISTORY.delete(k);
      }
    }
  }
  const history = (RESET_REQUEST_HISTORY.get(email) || []).filter((t) => now - t < RESET_WINDOW_MS);
  if (history.length >= MAX_RESET_REQUESTS_PER_WINDOW) {
    RESET_REQUEST_HISTORY.set(email, history);
    return false;
  }
  history.push(now);
  RESET_REQUEST_HISTORY.set(email, history);
  return true;
}

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

    // Bu kod tabanlı sıfırlama akışı yalnızca yerel (geliştirme) kullanıcı deposu için çalışır.
    // Üretimde kullanıcılar PostgreSQL'dedir; arka uç e-posta ile sıfırlama akışına bağlanana kadar kapalı tutulur.
    if (!isLocalAuthEnabled()) {
      return NextResponse.json(
        { error: "Şifre sıfırlama bu ortamda henüz aktif değil. Lütfen sistem yöneticinizle iletişime geçin." },
        { status: 503 }
      );
    }

    const user = authStore.findUserByEmail(cleanEmail);

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

      if (String(newPassword).length > 128) {
        return NextResponse.json(
          { error: "Yeni şifre en fazla 128 karakter olabilir." },
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

    // 2. Doğrulama Kodu Talebi (Hız Sınırı Korumalı)
    if (!checkResetRateLimit(cleanEmail)) {
      return NextResponse.json(
        { error: "Çok fazla şifre sıfırlama kodu talep ettiniz. Lütfen 15 dakika sonra tekrar deneyin." },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }

    const isProd = (process.env.NODE_ENV as string) === "production";

    // Kullanıcı numaralandırmasını (User Enumeration) önlemek için kayıtlı olmayan e-postalara da 200 OK döner
    if (!user) {
      return NextResponse.json({
        success: true,
        step: "code_sent",
        message: "Bu e-posta ile kayıtlı bir hesap varsa 6 haneli doğrulama kodu gönderildi.",
        is_simulation: false,
      });
    }

    const resetCode = authStore.createResetCode(cleanEmail);

    const emailResult = await sendEmail(
      {
        to: cleanEmail,
        subject: "CALPEO Güvenlik - Şifre Sıfırlama Doğrulama Kodu",
        text: `CALPEO hesabınız için şifre sıfırlama talebinde bulunuldu.\n\nDoğrulama Kodunuz: ${resetCode}\n\nBu kod 10 dakika geçerlidir.`,
      },
      resetCode
    );

    if (isProd && emailResult.method === "simulation") {
      return NextResponse.json(
        { error: "Şifre sıfırlama e-posta servisi henüz yapılandırılmamış." },
        { status: 503 }
      );
    }

    const canExposePreview = !isProd && emailResult.method === "simulation";

    return NextResponse.json({
      success: true,
      step: "code_sent",
      message: "Bu e-posta ile kayıtlı bir hesap varsa 6 haneli doğrulama kodu gönderildi.",
      preview_code: canExposePreview ? resetCode : undefined,
      is_simulation: canExposePreview,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Şifre sıfırlama işlemi sırasında hata oluştu: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}

