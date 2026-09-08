import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { AppLayoutShell } from "@/components/AppLayoutShell";

export const metadata = {
  title: "Otonom AI SEO Platformu | SEO İşletim Sistemi",
  description: "Kurumsal seviyede otonom SEO yönetim sistemi, teknik denetim ve AI optimizasyon platformu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-indigo-500 selection:text-white font-sans">
        <AuthProvider>
          <AppLayoutShell>{children}</AppLayoutShell>
        </AuthProvider>
      </body>
    </html>
  );
}
