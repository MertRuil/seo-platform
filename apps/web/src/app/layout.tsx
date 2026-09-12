import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { DensityProvider } from "@/context/DensityContext";
import { AppLayoutShell } from "@/components/AppLayoutShell";

export const metadata = {
  title: "CALPEO | Arama Görünürlüğü ve Kanıt İşletim Sistemi",
  description: "Aramada görün. Yanıtlarda seçil. Sonucu kanıtla. SEO, GEO ve AEO için birleşik karar ve kanıt platformu.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body className="bg-calpeo-night text-[#f4f3ee] min-h-screen antialiased selection:bg-calpeo-blue selection:text-white font-sans">
        <AuthProvider>
          <DensityProvider>
            <AppLayoutShell>{children}</AppLayoutShell>
          </DensityProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

