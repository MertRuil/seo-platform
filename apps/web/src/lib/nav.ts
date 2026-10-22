import type React from "react";
import {
  BarChart3,
  ShieldCheck,
  TrendingUp,
  ListChecks,
  Link2,
  GitCommit,
  FlaskConical,
  BookOpen,
  Sliders,
  History,
  CreditCard,
  KeyRound,
  PenTool,
  Bot,
  Sparkles,
  Swords,
  FileBarChart,
  Contact,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: "pending" | "critical";
  /** Bu öğe altında sekme olarak açılan diğer adresler. */
  also?: readonly string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Site sağlığı tek menü girişi; alt sayfalar üstteki sekmelerden açılır. */
export const SITE_HEALTH_TABS = [
  { name: "Özet", href: "/health" },
  { name: "Sorunlar", href: "/issues" },
  { name: "Sayfalar", href: "/pages" },
  { name: "Şema", href: "/schema" },
  { name: "İç linkler", href: "/links" },
  { name: "Web Vitals", href: "/cwv" },
  { name: "Taramalar", href: "/crawls" },
] as const;

export const navGroups: NavGroup[] = [
  {
    label: "Özet",
    items: [
      { name: "Genel Görünüm", href: "/", icon: BarChart3 },
      { name: "AI SEO Asistanı", href: "/ai", icon: Bot },
    ],
  },
  {
    label: "Yapılacaklar",
    items: [
      { name: "Öncelikli İşler", href: "/opportunities", icon: ListChecks, badge: "pending" },
      { name: "Değişiklikler", href: "/changes", icon: GitCommit },
      { name: "Deneyler", href: "/experiments", icon: FlaskConical },
    ],
  },
  {
    label: "Görünürlük",
    items: [
      { name: "Arama Performansı", href: "/performance", icon: TrendingUp },
      { name: "Anahtar Kelimeler", href: "/keywords", icon: KeyRound },
      { name: "AI Görünürlüğü", href: "/geo", icon: Sparkles },
      { name: "Rakipler", href: "/competitors", icon: Swords },
      { name: "Backlinkler", href: "/backlinks", icon: Link2 },
      { name: "İçerik", href: "/content", icon: PenTool },
    ],
  },
  {
    label: "Site sağlığı",
    items: [
      { name: "Site Sağlığı", href: "/health", icon: ShieldCheck, badge: "critical", also: SITE_HEALTH_TABS.map((t) => t.href) },
    ],
  },
  {
    label: "Yönetim",
    items: [
      { name: "Raporlar", href: "/reports", icon: FileBarChart },
      { name: "Bağlantılar ve Ayarlar", href: "/integrations", icon: Sliders },
      { name: "Abonelik ve Fatura", href: "/billing", icon: CreditCard },
      { name: "Denetim Günlüğü", href: "/audit", icon: History },
      { name: "Müşteriler (CRM)", href: "/leads", icon: Contact },
      { name: "Bilgi Tabanı", href: "/knowledge", icon: BookOpen },
    ],
  },
];

export function isNavItemActive(item: Pick<NavItem, "href" | "also">, path: string): boolean {
  return path === item.href || (item.also?.includes(path) ?? false);
}

