import { NextResponse } from "next/server";
import { authStore } from "@/lib/auth-users";
import { createSignedToken } from "@/lib/jwt";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { provider, token } = body;

    if (!provider) {
      return NextResponse.json(
        { error: "Giriş sağlayıcısı (provider) zorunludur." },
        { status: 400 }
      );
    }

    if (!token || typeof token !== "string" || !token.trim()) {
      return NextResponse.json(
        { error: "OAuth sağlayıcı doğrulama belirteci (token) zorunludur." },
        { status: 401 }
      );
    }

    const cleanToken = token.trim();
    if (["x", "test", "token", "dummy", "fake", "123", "admin"].includes(cleanToken.toLowerCase())) {
      return NextResponse.json(
        { error: "Geçersiz veya sahte OAuth belirteci." },
        { status: 401 }
      );
    }

    const cleanProvider = provider.trim().toLowerCase();
    let verifiedEmail = "";
    let verifiedName = "";

    // Test token support ONLY in test environment when explicitly enabled
    if (
      process.env.NODE_ENV === "test" &&
      process.env.ALLOW_TEST_OAUTH_TOKENS === "true" &&
      cleanToken.startsWith("test-oauth-token:")
    ) {
      const parts = cleanToken.split(":");
      verifiedEmail = (parts[1] || "").trim().toLowerCase();
      verifiedName = `${provider} Test Kullanıcısı`;
    } else if (cleanProvider === "google") {
      try {
        const gRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(cleanToken)}`
        );
        if (gRes.ok) {
          const gData = await gRes.json();
          const emailVerified = gData.email_verified === true || gData.email_verified === "true";
          if (!emailVerified) {
            return NextResponse.json(
              { error: "Google hesabında e-posta adresi doğrulanmamış." },
              { status: 401 }
            );
          }

          // Audience check to prevent token substitution attacks
          const expectedAud = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
          if (process.env.NODE_ENV === "production" && !expectedAud) {
            return NextResponse.json(
              { error: "Sunucu güvenlik yapılandırma hatası: GOOGLE_OAUTH_CLIENT_ID üretim ortamında tanımlanmalıdır." },
              { status: 500 }
            );
          }

          if (expectedAud && gData.aud !== expectedAud) {
            return NextResponse.json(
              { error: "Google belirteci hedef kitle (aud) uyuşmazlığı: Yetkisiz uygulama belirteci." },
              { status: 401 }
            );
          }

          verifiedEmail = (gData.email || "").trim().toLowerCase();
          verifiedName = gData.name || "Google Kullanıcısı";
        } else {
          // Fallback to Google Tokeninfo with access_token (which returns aud and email)
          const uRes = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(cleanToken)}`
          );
          if (!uRes.ok) {
            return NextResponse.json(
              { error: "Google OAuth belirteci doğrulanamadı veya süresi dolmuş." },
              { status: 401 }
            );
          }
          const uData = await uRes.json();
          const emailVerified = uData.email_verified === true || uData.email_verified === "true";
          if (!emailVerified) {
            return NextResponse.json(
              { error: "Google hesabında e-posta adresi doğrulanmamış." },
              { status: 401 }
            );
          }

          const expectedAud = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
          if (process.env.NODE_ENV === "production" && !expectedAud) {
            return NextResponse.json(
              { error: "Sunucu güvenlik yapılandırma hatası: GOOGLE_OAUTH_CLIENT_ID üretim ortamında tanımlanmalıdır." },
              { status: 500 }
            );
          }

          if (expectedAud && uData.aud !== expectedAud) {
            return NextResponse.json(
              { error: "Google belirteci hedef kitle (aud) uyuşmazlığı: Yetkisiz uygulama belirteci." },
              { status: 401 }
            );
          }

          verifiedEmail = (uData.email || "").trim().toLowerCase();
          verifiedName = uData.name || "Google Kullanıcısı";
        }
      } catch (err: any) {
        return NextResponse.json(
          { error: "Google kimlik doğrulama servisine ulaşılamadı: " + err.message },
          { status: 502 }
        );
      }
    } else if (cleanProvider === "github") {
      try {
        const ghRes = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            "User-Agent": "SEO-Platform-Next",
          },
        });
        if (!ghRes.ok) {
          return NextResponse.json(
            { error: "GitHub belirteci doğrulanamadı." },
            { status: 401 }
          );
        }
        // Token substitution guard: reject tokens minted for a different GitHub OAuth app
        const expectedGhClient = process.env.GITHUB_OAUTH_CLIENT_ID || process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
        if (process.env.NODE_ENV === "production" && !expectedGhClient) {
          return NextResponse.json(
            { error: "Sunucu güvenlik yapılandırma hatası: GITHUB_OAUTH_CLIENT_ID üretim ortamında tanımlanmalıdır." },
            { status: 500 }
          );
        }
        if (expectedGhClient && ghRes.headers.get("x-oauth-client-id") !== expectedGhClient) {
          return NextResponse.json(
            { error: "GitHub belirteci bu uygulama için üretilmemiş (client id uyuşmazlığı)." },
            { status: 401 }
          );
        }

        const ghData = await ghRes.json();
        let ghEmail = (ghData.email || "").trim().toLowerCase();

        // If email is private in user profile, query /user/emails
        if (!ghEmail) {
          const emailsRes = await fetch("https://api.github.com/user/emails", {
            headers: {
              Authorization: `Bearer ${cleanToken}`,
              "User-Agent": "SEO-Platform-Next",
            },
          });
          if (emailsRes.ok) {
            const emailsData = await emailsRes.json();
            if (Array.isArray(emailsData)) {
              const primary = emailsData.find((e: any) => e.primary && e.verified);
              if (primary && primary.email) {
                ghEmail = primary.email.trim().toLowerCase();
              }
            }
          }
        }

        if (!ghEmail) {
          return NextResponse.json(
            { error: "GitHub hesabında doğrulanmış birincil e-posta adresi bulunamadı." },
            { status: 401 }
          );
        }

        verifiedEmail = ghEmail;
        verifiedName = ghData.name || ghData.login || "GitHub Kullanıcısı";
      } catch (err: any) {
        return NextResponse.json(
          { error: "GitHub kimlik doğrulama servisine ulaşılamadı: " + err.message },
          { status: 502 }
        );
      }
    } else {
      return NextResponse.json(
        { error: `Desteklenmeyen OAuth sağlayıcısı: '${provider}'.` },
        { status: 400 }
      );
    }

    if (!verifiedEmail) {
      return NextResponse.json(
        { error: "OAuth sağlayıcısından geçerli ve doğrulanmış bir e-posta adresi alınamadı." },
        { status: 401 }
      );
    }

    const cleanExpectedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (cleanExpectedEmail && verifiedEmail !== cleanExpectedEmail) {
      return NextResponse.json(
        { error: `OAuth belirtecindeki e-posta (${verifiedEmail}) ile istekteki e-posta (${cleanExpectedEmail}) eşleşmiyor.` },
        { status: 401 }
      );
    }

    let user = authStore.findUserByEmail(verifiedEmail);
    if (!user) {
      // Create regular user - DO NOT elevate new SSO users to admin!
      user = authStore.addUser({
        id: `usr_${cleanProvider}_${Date.now().toString(36)}`,
        email: verifiedEmail,
        password: crypto.randomBytes(24).toString("hex"),
        fullName: verifiedName || `${provider} Kullanıcısı`,
        role: "Kullanıcı",
        isAdmin: false,
        isSuperAdmin: false,
        permissions: ["read", "crawl", "audit"],
        createdAt: new Date().toISOString(),
      });
    }

    authStore.clearFailedAttempts(verifiedEmail);

    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      isAdmin: Boolean(user.isAdmin),
    };

    const accessToken = createSignedToken(tokenPayload);

    const responseData = {
      success: true,
      message: `${provider} ile güvenli giriş başarılı.`,
      access_token: accessToken,
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
      expires_in: 86400,
    };

    const res = NextResponse.json(responseData, { status: 200 });

    res.cookies.set({
      name: "seo_platform_token",
      value: accessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 86400,
      path: "/",
      sameSite: "lax",
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: "SSO Giriş işlemi sırasında hata: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
