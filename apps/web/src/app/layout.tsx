import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppLayoutShell } from "@/components/AppLayoutShell";
import { THEME_INIT_SCRIPT } from "@/context/ThemeContext";

export const metadata = {
  title: "CALPEO | Arama Görünürlüğü ve Kanıt İşletim Sistemi",
  description: "Aramada görün. Yanıtlarda seçil. Sonucu kanıtla. SEO, GEO ve AEO için birleşik karar ve kanıt platformu.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        {/* Boyamadan önce temayı uygular; açık modda koyu flaşı önler */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-bg text-ink min-h-screen antialiased selection:bg-accent-soft selection:text-ink">
        <Providers>
          <AppLayoutShell>{children}</AppLayoutShell>
        </Providers>
      </body>
    </html>
  );
}
