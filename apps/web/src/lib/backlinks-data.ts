export interface WebBacklinkItem {
  id: string;
  source_url: string;
  source_domain: string;
  target_url: string;
  anchor_text: string;
  anchor_category: "BRAND" | "EXACT_MATCH" | "PARTIAL_MATCH" | "GENERIC" | "NAKED_URL" | "SPAM";
  is_dofollow: boolean;
  domain_authority: number; // 1-100 DR
  page_authority: number;   // 1-100 UR
  spam_score: number;       // 0-100
  is_toxic: boolean;
  toxicity_reasons: string[];
  first_seen: string;
  status: "ACTIVE" | "LOST";
}

export const INITIAL_BACKLINKS: WebBacklinkItem[] = [
  {
    id: "bl-1",
    source_url: "https://techcrunch.com/2026/02/top-enterprise-seo-platforms",
    source_domain: "techcrunch.com",
    target_url: "https://flagship-store.com",
    anchor_text: "Flagship Store Platform",
    anchor_category: "BRAND",
    is_dofollow: true,
    domain_authority: 91,
    page_authority: 78,
    spam_score: 1,
    is_toxic: false,
    toxicity_reasons: [],
    first_seen: "2026-02-14",
    status: "ACTIVE",
  },
  {
    id: "bl-2",
    source_url: "https://searchengineland.com/geo-ai-search-optimization-guide",
    source_domain: "searchengineland.com",
    target_url: "https://flagship-store.com/geo",
    anchor_text: "yapay zeka seo araçları ve geo",
    anchor_category: "EXACT_MATCH",
    is_dofollow: true,
    domain_authority: 86,
    page_authority: 71,
    spam_score: 2,
    is_toxic: false,
    toxicity_reasons: [],
    first_seen: "2026-03-01",
    status: "ACTIVE",
  },
  {
    id: "bl-3",
    source_url: "https://medium.com/@seoguru/best-ecommerce-practices-2026",
    source_domain: "medium.com",
    target_url: "https://flagship-store.com/blog/ecommerce-seo",
    anchor_text: "https://flagship-store.com/blog/ecommerce-seo",
    anchor_category: "NAKED_URL",
    is_dofollow: false,
    domain_authority: 82,
    page_authority: 54,
    spam_score: 3,
    is_toxic: false,
    toxicity_reasons: [],
    first_seen: "2026-03-10",
    status: "ACTIVE",
  },
  {
    id: "bl-4",
    source_url: "https://e-ticaret-rehberi.org/baglantilar",
    source_domain: "e-ticaret-rehberi.org",
    target_url: "https://flagship-store.com",
    anchor_text: "tıklayın",
    anchor_category: "GENERIC",
    is_dofollow: true,
    domain_authority: 42,
    page_authority: 36,
    spam_score: 12,
    is_toxic: false,
    toxicity_reasons: [],
    first_seen: "2026-01-20",
    status: "ACTIVE",
  },
  {
    id: "bl-5",
    source_url: "https://free-crypto-casino-bonus.xyz/links-list",
    source_domain: "free-crypto-casino-bonus.xyz",
    target_url: "https://flagship-store.com",
    anchor_text: "online casino baccarat win free",
    anchor_category: "SPAM",
    is_dofollow: true,
    domain_authority: 4,
    page_authority: 6,
    spam_score: 88,
    is_toxic: true,
    toxicity_reasons: [
      "Yüksek riskli spam TLD uzantısı (.xyz)",
      "Yasaklı kumar/bahis anahtar kelimesi ('casino')",
      "Kritik alan adı spam skoru (%88)",
    ],
    first_seen: "2026-03-18",
    status: "ACTIVE",
  },
  {
    id: "bl-6",
    source_url: "https://auto-traffic-pbn.top/directory-scrape",
    source_domain: "auto-traffic-pbn.top",
    target_url: "https://flagship-store.com/products",
    anchor_text: "cheap replica watches payday",
    anchor_category: "SPAM",
    is_dofollow: true,
    domain_authority: 3,
    page_authority: 5,
    spam_score: 92,
    is_toxic: true,
    toxicity_reasons: [
      "Yüksek riskli PBN uzantısı (.top)",
      "Yapay link çiftliği tespit edildi",
      "Kritik alan adı spam skoru (%92)",
    ],
    first_seen: "2026-03-22",
    status: "ACTIVE",
  },
  {
    id: "bl-7",
    source_url: "https://webmaster-turkey.net/forum/seo-tartisma",
    source_domain: "webmaster-turkey.net",
    target_url: "https://flagship-store.com/hakkimizda",
    anchor_text: "Flagship Store uzman incelemesi",
    anchor_category: "PARTIAL_MATCH",
    is_dofollow: true,
    domain_authority: 56,
    page_authority: 48,
    spam_score: 8,
    is_toxic: false,
    toxicity_reasons: [],
    first_seen: "2026-02-05",
    status: "ACTIVE",
  },
  {
    id: "bl-8",
    source_url: "https://spambot-linkfarm.click/viagra-cialis",
    source_domain: "spambot-linkfarm.click",
    target_url: "https://flagship-store.com",
    anchor_text: "buy viagra online overnight",
    anchor_category: "SPAM",
    is_dofollow: true,
    domain_authority: 2,
    page_authority: 3,
    spam_score: 96,
    is_toxic: true,
    toxicity_reasons: [
      "Yüksek riskli şüpheli uzantı (.click)",
      "Yasaklı spam anahtar kelime ('viagra')",
      "Otomatik link çiftliği sinyalleri",
    ],
    first_seen: "2026-03-24",
    status: "ACTIVE",
  },
];

export const ANALYTICSHUB_BACKLINKS: WebBacklinkItem[] = [
  {
    id: "bl-ah-1",
    source_url: "https://github.com/topics/saas-analytics",
    source_domain: "github.com",
    target_url: "https://analyticshub.com",
    anchor_text: "SaaS Analytics Hub Platform",
    anchor_category: "BRAND",
    is_dofollow: true,
    domain_authority: 96,
    page_authority: 82,
    spam_score: 1,
    is_toxic: false,
    toxicity_reasons: [],
    first_seen: "2026-01-15",
    status: "ACTIVE",
  },
  {
    id: "bl-ah-2",
    source_url: "https://producthunt.com/products/analytics-hub",
    source_domain: "producthunt.com",
    target_url: "https://analyticshub.com",
    anchor_text: "Analytics Hub",
    anchor_category: "BRAND",
    is_dofollow: true,
    domain_authority: 91,
    page_authority: 76,
    spam_score: 1,
    is_toxic: false,
    toxicity_reasons: [],
    first_seen: "2026-02-01",
    status: "ACTIVE",
  },
  {
    id: "bl-ah-3",
    source_url: "https://techradar.com/pro/best-business-intelligence-tools",
    source_domain: "techradar.com",
    target_url: "https://analyticshub.com/features",
    anchor_text: "veri analitiği ve dashboard çözümleri",
    anchor_category: "PARTIAL_MATCH",
    is_dofollow: true,
    domain_authority: 89,
    page_authority: 70,
    spam_score: 2,
    is_toxic: false,
    toxicity_reasons: [],
    first_seen: "2026-02-18",
    status: "ACTIVE",
  },
  {
    id: "bl-ah-4",
    source_url: "https://capterra.com/p/analyticshub/reviews",
    source_domain: "capterra.com",
    target_url: "https://analyticshub.com",
    anchor_text: "https://analyticshub.com",
    anchor_category: "NAKED_URL",
    is_dofollow: false,
    domain_authority: 84,
    page_authority: 58,
    spam_score: 2,
    is_toxic: false,
    toxicity_reasons: [],
    first_seen: "2026-03-05",
    status: "ACTIVE",
  },
  {
    id: "bl-ah-5",
    source_url: "https://dev.to/dataarchitect/modern-analytics-architecture-2026",
    source_domain: "dev.to",
    target_url: "https://analyticshub.com/integrations",
    anchor_text: "Analytics Hub REST API",
    anchor_category: "BRAND",
    is_dofollow: true,
    domain_authority: 79,
    page_authority: 61,
    spam_score: 3,
    is_toxic: false,
    toxicity_reasons: [],
    first_seen: "2026-03-12",
    status: "ACTIVE",
  },
];

export function getSiteBacklinks(site?: { id?: string; domain?: string; primary_url?: string } | null): WebBacklinkItem[] {
  const domain = (site?.domain || "").toLowerCase().replace(/^https?:\/\//, "").split("/")[0].trim();
  const siteId = site?.id;
  if (domain === "analyticshub.com" || siteId === "site-2") {
    return ANALYTICSHUB_BACKLINKS;
  }
  if (domain === "flagship-store.com" || siteId === "site-1" || !domain) {
    return INITIAL_BACKLINKS;
  }
  // Gerçek müşteri siteleri için örnek link uydurulmaz; arka uç da boş listeyle başlar
  return [];
}
