import "./globals.css";
import { Navigation } from "@/components/Navigation";

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
      <body className="bg-slate-950 text-slate-100 flex min-h-screen antialiased selection:bg-indigo-500 selection:text-white">
        <Navigation />
        <main className="flex-1 ml-64 p-8 overflow-y-auto min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
