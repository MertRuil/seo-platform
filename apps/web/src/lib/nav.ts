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
  Building2,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: "pending" | "critical";
  /** Bu öğe altında sekme olarak açılan diğer adresler. */
  also?: readonly string[];
  /** Bu önekle başlayan tüm adreslerde (detay sayfaları dahil) etkin sayılır. */
  prefix?: string;
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

/** Platform yönetimi bölümleri; menüde tek giriş, aralarında üstteki sekmelerle geçilir. */
export const ADMIN_TABS = [
  { name: "Genel bakış", href: "/admin" },
  { name: "Kullanıcılar", href: "/admin/users" },
  { name: "Organizasyonlar", href: "/admin/organizations" },
  { name: "Ödemeler", href: "/admin/billing" },
  { name: "Kullanım", href: "/admin/usage" },
  { name: "Denetim kaydı", href: "/admin/audit" },
] as const;

const adminNavGroup: NavGroup = {
  label: "Platform",
  items: [{ name: "Platform Yönetimi", href: "/admin", icon: Building2, prefix: "/admin" }],
};

/** Platform yönetimi girişi yalnızca yöneticiye görünür; asıl yetki kontrolü arka uçtadır. */
export function visibleNavGroups(isAdmin: boolean): NavGroup[] {
  return isAdmin ? [...navGroups, adminNavGroup] : navGroups;
}

export function isAdminPath(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

export function isAdminTabActive(href: string, path: string): boolean {
  return href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`);
}

export function isNavItemActive(item: Pick<NavItem, "href" | "also" | "prefix">, path: string): boolean {
  if (item.prefix && (path === item.prefix || path.startsWith(`${item.prefix}/`))) return true;
  return path === item.href || (item.also?.includes(path) ?? false);
}

