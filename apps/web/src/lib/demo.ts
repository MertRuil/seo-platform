/**
 * Örnek (demo) veri ve ekran görünüm modelleri.
 * Ekranlar canlı veriyi bu modellere eşler; site/tarama yoksa bu setler
 * "Örnek veri" bandıyla gösterilir. Sahte veri asla bantsız görünmez.
 */

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: "Kritik",
  HIGH: "Yüksek",
  MEDIUM: "Orta",
  LOW: "Düşük",
  INFO: "Bilgi",
};

export interface QueueItem {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  score: number;
  reason: string;
  source: string;
  impact?: string;
  confidence?: number;
  href: string;
  actionLabel: string;
}

export interface DashboardData {
  series: { labels: string[]; google: number[]; ai?: number[] };
  markers: Array<{ index: number; label: string }>;
  googleScore: number;
  aiScore?: number;
  visibilityDelta: number;
  queue: QueueItem[];
  health: { score: number; pages: number; critical: number; delta: number };
  search: { clicks: number; ctr: number; position: number };
  impact: { lift: number; confidence: number; experiments: number };
  engines: Array<{ name: string; score: string; trend: string; status: string }>;
  technical: { indexability: string; ttfb: string; schemaCoverage: string };
}

export const DEMO_DASHBOARD: DashboardData = {
  series: {
    labels: ["1. hf", "2. hf", "3. hf", "4. hf", "5. hf", "6. hf", "7. hf", "8. hf"],
    google: [32, 38, 35, 46, 54, 63, 71, 82],
    ai: [12, 14, 16, 20, 31, 42, 55, 67],
  },
  markers: [{ index: 4, label: "#42 canonical düzeltmesi" }],
  googleScore: 81,
  aiScore: 67,
  visibilityDelta: 8.1,
  queue: [
    {
      id: "REC-01",
      title: "/urunler/kurumsal sayfasındaki canonical döngüsünü düzeltin",
      category: "CANONICAL",
      severity: "CRITICAL",
      score: 96,
      reason: "Dairesel canonical yönlendirmesi arama motoru botlarının sayfayı dizine eklemesini engelliyor.",
      source: "Google Search Central: Canonicalization",
      impact: "+%4,8 dizin kapsamı",
      confidence: 0.95,
      href: "/changes",
      actionLabel: "Diff incele",
    },
    {
      id: "REC-02",
      title: "Yüksek gösterimli, düşük tıklamalı başlık etiketini optimize edin",
      category: "CTR",
      severity: "MEDIUM",
      score: 84,
      reason: "'otonom seo yazılımı' sorgusu 42.000 gösterimde 4,2 pozisyondayken yalnızca %1,8 tıklama alıyor.",
      source: "GSC arama analitiği",
      impact: "+1.140 tıklama/ay",
      confidence: 0.82,
      href: "/opportunities",
      actionLabel: "Başlığı optimize et",
    },
    {
      id: "REC-03",
      title: "/fiyatlandirma sayfasına eksik iç bağlantıları ekleyin",
      category: "İÇ LİNK",
      severity: "MEDIUM",
      score: 79,
      reason: "Yüksek dönüşümlü fiyatlandırma sayfası site genelinden yalnızca 3 iç bağlantı alıyor.",
      source: "NetworkX site grafı & PageRank",
      impact: "PageRank +0,6",
      confidence: 0.78,
      href: "/links",
      actionLabel: "Anchor önerileri",
    },
    {
      id: "REC-04",
      title: "Organization ve FAQPage yapılandırılmış verisini zenginleştirin",
      category: "SCHEMA",
      severity: "LOW",
      score: 72,
      reason: "Ana varlık ilişkilendirmesini netleştirmek için JSON-LD ekleyin; düşük riskli, otomatik uygulanabilir.",
      source: "schema.org & Google yapılandırılmış veri rehberi",
      impact: "14 sayfa",
      confidence: 0.9,
      href: "/schema",
      actionLabel: "Şemayı doğrula",
    },
  ],
  health: { score: 94, pages: 1240, critical: 1, delta: 2.4 },
  search: { clicks: 142800, ctr: 0.0595, position: 6.8 },
  impact: { lift: 4.8, confidence: 0.92, experiments: 3 },
  engines: [
    { name: "Google Arama & AI Overviews", score: "%81", trend: "+6,2", status: "Yüksek otorite" },
    { name: "Perplexity", score: "%72", trend: "+18,4", status: "Aktif atıf kaynağı" },
    { name: "ChatGPT Search", score: "%64", trend: "+9,1", status: "Gelişen kaynak" },
    { name: "Gemini", score: "%65", trend: "+4,0", status: "Dengeli" },
  ],
  technical: { indexability: "%98,2", ttfb: "210 ms", schemaCoverage: "%89,4" },
};

export interface HealthRule {
  rule: string;
  status: "Mükemmel" | "İyi" | "Uyarı" | "Kritik";
  score: string;
  note: string;
}

export interface HealthData {
  score: number;
  pages: number;
  issues: number;
  breakdown: Array<{ label: string; pct: number }>;
  rules: HealthRule[];
}

export const DEMO_HEALTH: HealthData = {
  score: 94,
  pages: 124,
  issues: 4,
  breakdown: [
    { label: "Dizinlenebilirlik & taranabilirlik", pct: 96 },
    { label: "Meta veri & içerik uyumu", pct: 98 },
    { label: "Yönlendirmeler & HTTP durumu", pct: 78 },
  ],
  rules: [
    { rule: "Canonical doğruluğu", status: "Uyarı", score: "85/100", note: "1 sayfada canonical döngüsü tespit edildi." },
    { rule: "Robots.txt & noindex uyumu", status: "Mükemmel", score: "100/100", note: "Robots tarafından engellenen noindex sayfası yok." },
    { rule: "Yönlendirme zincirleri", status: "Kritik", score: "60/100", note: "2 adet 3+ atlamalı yönlendirme zinciri var." },
    { rule: "Başlık etiketi (title)", status: "Mükemmel", score: "100/100", note: "Tüm sayfalarda benzersiz başlık etiketi var." },
    { rule: "Meta açıklamaları", status: "Mükemmel", score: "95/100", note: "Boş veya eksik meta açıklaması yok." },
    { rule: "Yapılandırılmış veri sözdizimi", status: "Mükemmel", score: "100/100", note: "JSON-LD şemalarında sözdizimi hatası yok." },
    { rule: "HTTP yanıt kodları", status: "İyi", score: "90/100", note: "5xx yok; yalnızca 1 adet 404 bulundu." },
  ],
};

export interface IssueItem {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  url: string;
  diagnosis: string;
  fix: string;
  before: string;
  after: string;
  docUrl?: string;
  affected?: number;
}

export const DEMO_ISSUES: IssueItem[] = [
  {
    id: "ISSUE-01",
    title: "Canonical döngüsü (A → B → A)",
    category: "CANONICAL",
    severity: "CRITICAL",
    url: "https://flagship-store.com/urunler/kurumsal",
    diagnosis: "Sayfa kendisini başka bir URL'ye canonical olarak gösteriyor; o sayfa da ilk sayfaya geri dönüyor.",
    fix: "rel=canonical etiketini doğrudan kendi mutlak URL'sine (self-referential) çevirin.",
    before: '<link rel="canonical" href="https://flagship-store.com/urunler/kurumsal-alt" />',
    after: '<link rel="canonical" href="https://flagship-store.com/urunler/kurumsal" />',
    docUrl: "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
    affected: 1,
  },
  {
    id: "ISSUE-02",
    title: "3 kademeli yönlendirme zinciri (301 → 301 → 200)",
    category: "YÖNLENDİRME",
    severity: "HIGH",
    url: "https://flagship-store.com/blog/eski-yazi",
    diagnosis: "URL doğrudan hedefe varmak yerine ara 301'lerden geçerek tarama bütçesi harcıyor.",
    fix: "İç bağlantıları doğrudan nihai hedef URL'ye işaret edecek şekilde güncelleyin.",
    before: '<a href="https://flagship-store.com/blog/eski-yazi">Rehberi oku</a>\n<!-- 301 -> /blog/yazi-v2 -> /blog/guncel-rehber -->',
    after: '<a href="https://flagship-store.com/blog/guncel-rehber">Rehberi oku</a>\n<!-- Doğrudan 200 OK -->',
    affected: 2,
  },
  {
    id: "ISSUE-03",
    title: "404 veren kırık iç bağlantı",
    category: "KIRIK LİNK",
    severity: "MEDIUM",
    url: "https://flagship-store.com/hakkimizda",
    diagnosis: "Sayfa gövdesindeki /ekip bağlantısı HTTP 404 döndürüyor.",
    fix: "Bağlantıyı çalışan ekip sayfasına yönlendirin veya etiketi kaldırın.",
    before: '<a href="/ekip" class="nav-link">Ekibimizle tanışın</a>\n<!-- HTTP 404 -->',
    after: '<a href="/kadromuz" class="nav-link">Ekibimizle tanışın</a>\n<!-- HTTP 200 -->',
    affected: 1,
  },
  {
    id: "ISSUE-04",
    title: "Kısa meta açıklaması",
    category: "İÇERİK",
    severity: "LOW",
    url: "https://flagship-store.com/iletisim",
    diagnosis: "Meta açıklaması 45 karakter; önerilen aralık 120–160 karakter.",
    fix: "Arama niyetini ve harekete geçirici mesajı içeren açıklama ekleyin.",
    before: '<meta name="description" content="İletişim sayfası. Bize ulaşın.">',
    after: '<meta name="description" content="Flagship Store müşteri hizmetleri ve destek ekibine 7/24 ulaşın. Adres, telefon ve canlı destek bilgilerimizle hemen iletişime geçin.">',
    affected: 1,
  },
];

export interface PageRow {
  url: string;
  status: number;
  title: string;
  canonical: string;
  canonicalBroken?: boolean;
  indexable: boolean;
  words: number;
  depth?: number;
  responseMs?: number | null;
}

export const DEMO_PAGES: PageRow[] = [
  { url: "https://flagship-store.com/", status: 200, title: "Ana Sayfa | Otonom E-Ticaret Deneyimi", canonical: "Kendisi", indexable: true, words: 1420, depth: 0, responseMs: 180 },
  { url: "https://flagship-store.com/urunler/kategori", status: 200, title: "Öne Çıkan Ürün ve Kategori Modelleri", canonical: "Kendisi", indexable: true, words: 980, depth: 1, responseMs: 210 },
  { url: "https://flagship-store.com/urunler/kurumsal", status: 200, title: "Kurumsal Satış & Toplu Tedarik", canonical: "Döngü (hatalı)", canonicalBroken: true, indexable: false, words: 640, depth: 1, responseMs: 240 },
  { url: "https://flagship-store.com/blog/eski-yazi", status: 301, title: "Yönlendirme sayfası", canonical: "—", indexable: false, words: 0, depth: 2, responseMs: 90 },
  { url: "https://flagship-store.com/404-broken", status: 404, title: "Sayfa bulunamadı", canonical: "—", indexable: false, words: 30, depth: 2, responseMs: 70 },
  { url: "https://flagship-store.com/fiyatlandirma", status: 200, title: "Fiyatlandırma & Şeffaf Paketler", canonical: "Kendisi", indexable: true, words: 1100, depth: 1, responseMs: 200 },
];

export interface PerformanceData {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  deltas: { clicks: string; impressions: string; position: string };
  queries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>;
}

export const DEMO_PERFORMANCE: PerformanceData = {
  clicks: 142800,
  impressions: 2410000,
  ctr: 0.0595,
  position: 6.8,
  deltas: { clicks: "+%8,1", impressions: "+%14,2", position: "+1,4 sıra" },
  queries: [
    { query: "otonom seo platformu", clicks: 14200, impressions: 128000, ctr: 0.1109, position: 2.1 },
    { query: "yapay zeka seo işletim sistemi", clicks: 9840, impressions: 94500, ctr: 0.1041, position: 1.8 },
    { query: "teknik seo denetim yazılımı", clicks: 6510, impressions: 82000, ctr: 0.0793, position: 3.4 },
    { query: "otomatik canonical düzeltme", clicks: 4200, impressions: 68000, ctr: 0.0617, position: 4.2 },
    { query: "sayfa hızı ve lcp optimizasyonu", clicks: 3150, impressions: 54000, ctr: 0.0583, position: 5.1 },
  ],
};

export interface OpportunityItem {
  category: string;
  query: string;
  page: string;
  impressions: number;
  clicks: number;
  ctr: number;
  targetCtr: number;
  potential: string;
  action: string;
  before: string;
  after: string;
}

export const DEMO_OPPORTUNITIES: OpportunityItem[] = [
  {
    category: "Yüksek gösterim · düşük tıklama",
    query: "otonom seo yazılımı",
    page: "https://flagship-store.com/yazilim",
    impressions: 42000,
    clicks: 750,
    ctr: 0.0178,
    targetCtr: 0.045,
    potential: "+1.140 tıklama/ay",
    action: "Başlık ve meta açıklamasını arama niyetine odaklanacak şekilde revize edin.",
    before: `<title>SEO Yazılımı | Flagship</title>\n<meta name="description" content="SEO optimizasyon yazılımımız hakkında bilgiler.">`,
    after: `<title>Otonom AI SEO Yazılımı ve Otomatik Sıralama Yükseltme | Flagship</title>\n<meta name="description" content="Yapay zeka destekli otonom SEO yazılımı ile teknik hataları otomatik onarın, Google'da 1. sayfaya yükselin. Hemen ücretsiz deneyin.">`,
  },
  {
    category: "2. sayfa → 1. sayfa",
    query: "yapay zeka canonical motoru",
    page: "https://flagship-store.com/ozellikler",
    impressions: 28500,
    clicks: 420,
    ctr: 0.0147,
    targetCtr: 0.06,
    potential: "+1.290 tıklama/ay",
    action: "Sayfaya güçlü otoriteye sahip blog yazılarından bağlamsal iç link ekleyin.",
    before: `<!-- /blog/seo-rehberi içinde bağlamsal link yok -->\n<p>Sayfalar arası bağlantı stratejisi önemlidir.</p>`,
    after: `<!-- Bağlamsal PageRank akışı eklendi -->\n<p>Sayfalar arası bağlantı stratejisi önemlidir; özellikle <a href="/ozellikler">yapay zeka canonical motoru</a> kullanarak yinelenen içerik risklerini sıfıra indirebilirsiniz.</p>`,
  },
  {
    category: "Anahtar kelime kanibalizasyonu",
    query: "site içi link analizi",
    page: "2 URL yarışıyor (/blog/linkler ve /ozellikler/link)",
    impressions: 19400,
    clicks: 310,
    ctr: 0.016,
    targetCtr: 0.052,
    potential: "+700 tıklama/ay",
    action: "İki sayfayı birleştirin veya rel=canonical ile ana ticari sayfayı yetkilendirin.",
    before: `<!-- /blog/linkler sayfasında bağımsız self-canonical -->\n<link rel="canonical" href="https://flagship-store.com/blog/linkler" />`,
    after: `<!-- Kanibalizasyonu önlemek için ana ticari sayfaya canonical -->\n<link rel="canonical" href="https://flagship-store.com/ozellikler/link" />`,
  },
];

export interface LinksData {
  nodes: number;
  edges: number;
  orphans: number;
  avgDepth: string;
  top: Array<{ url: string; pagerank: number; inbound: number; outbound: number; status: string; weak?: boolean }>;
  opportunities: Array<{ source: string; target: string; reason: string }>;
}

export const DEMO_LINKS: LinksData = {
  nodes: 124,
  edges: 842,
  orphans: 1,
  avgDepth: "1,8",
  top: [
    { url: "https://flagship-store.com/", pagerank: 0.245, inbound: 85, outbound: 42, status: "Ana merkez (hub)" },
    { url: "https://flagship-store.com/urunler/kategori", pagerank: 0.142, inbound: 38, outbound: 18, status: "Güçlü kategori" },
    { url: "https://flagship-store.com/blog", pagerank: 0.118, inbound: 32, outbound: 65, status: "Otorite dağıtıcı" },
    { url: "https://flagship-store.com/fiyatlandirma", pagerank: 0.034, inbound: 3, outbound: 4, status: "Yetim / zayıf", weak: true },
  ],
  opportunities: [
    { source: "https://flagship-store.com/blog/seo-rehberi", target: "https://flagship-store.com/fiyatlandirma", reason: "Yüksek otoriteli blog sayfasından dönüşüm sayfasına bağlantı yok." },
    { source: "https://flagship-store.com/urunler/kategori", target: "https://flagship-store.com/fiyatlandirma", reason: "Kategori sayfasından fiyatlandırmaya bağlamsal geçiş eksik." },
  ],
};

export interface SchemaRow {
  type: string;
  page: string;
  status: "Geçerli" | "Uyarı" | "Hatalı";
  richResult: string;
  missing: string;
}

export const DEMO_SCHEMA: SchemaRow[] = [
  { type: "Organization", page: "https://flagship-store.com/", status: "Geçerli", richResult: "Knowledge Graph", missing: "—" },
  { type: "Product", page: "https://flagship-store.com/urunler/kategori", status: "Geçerli", richResult: "Fiyat & stok rozeti", missing: "—" },
  { type: "Article", page: "https://flagship-store.com/blog/rehber", status: "Geçerli", richResult: "Zengin makale görünümü", missing: "—" },
  { type: "BreadcrumbList", page: "Site geneli (124 sayfa)", status: "Geçerli", richResult: "Hiyerarşik URL yolu", missing: "—" },
];

export interface CwvData {
  lcpMs: number | null;
  inpMs: number | null;
  cls: number | null;
  formFactor?: string;
  fetchedAt?: string;
}

export const DEMO_CWV: CwvData = { lcpMs: 1800, inpMs: 85, cls: 0.02, formFactor: "PHONE" };

export interface ChangeSetItem {
  id: string;
  sorunId?: string;
  baslik: string;
  onem?: string;
  etkilenenSayfa: string;
  kategori?: string;
  oneri?: string;
  durum: "BEKLİYOR" | "UYGULANIYOR" | "UYGULANDI" | "GERİ_ALINDI";
  oncekiKod: string;
  yeniKod: string;
  olusturulmaTarihi?: string;
}

export const DEMO_CHANGESETS: ChangeSetItem[] = [
  {
    id: "CS-4102",
    sorunId: "ISSUE-01",
    baslik: "Kategori sayfası başlık ve canonical iyileştirmesi",
    onem: "CRITICAL",
    etkilenenSayfa: "https://flagship-store.com/urunler/kategori",
    kategori: "CANONICAL",
    durum: "BEKLİYOR",
    oncekiKod: `<title>Kategori Ürünleri</title>\n<link rel="canonical" href="https://flagship-store.com/404-broken" />`,
    yeniKod: `<title>Öne Çıkan Ürünler ve Kategori Modelleri | Flagship</title>\n<link rel="canonical" href="https://flagship-store.com/urunler/kategori" />`,
    olusturulmaTarihi: "Bugün 01:25",
  },
];

export interface ExperimentItem {
  name: string;
  days: number;
  variantPct: number;
  controlPct: number;
  liftPct: number;
  significant: boolean;
  variantPages: number;
  controlPages: number;
}

export const DEMO_EXPERIMENTS: ExperimentItem[] = [
  { name: "Ürün kategori başlıklarında CTA testi", days: 56, variantPct: 25, controlPct: 5, liftPct: 20, significant: true, variantPages: 10, controlPages: 10 },
];

export interface CrawlRow {
  id: string;
  mode: string;
  status: string;
  pages: number;
  errors: number;
  duration: string;
  date: string;
}

export const DEMO_CRAWLS: CrawlRow[] = [
  { id: "CRAWL-9842", mode: "Googlebot simülasyonu", status: "COMPLETED", pages: 124, errors: 0, duration: "34 sn", date: "Bugün 00:15" },
  { id: "CRAWL-9820", mode: "Site sahibi tam denetimi", status: "COMPLETED", pages: 118, errors: 1, duration: "42 sn", date: "Dün 14:30" },
];

export interface ConnectorItem {
  id: string;
  ad: string;
  tur: string;
  durum: "Bağlandı" | "Test Edilmedi" | "Bağlantı Başarısız" | "Yapılandırılmadı";
  aciklama: string;
  endpoint: string;
  tokenMasked: string;
}

export const DEMO_CONNECTORS: ConnectorItem[] = [
  { id: "gsc", ad: "Google Search Console", tur: "OAuth 2.0", durum: "Test Edilmedi", aciklama: "Arama analitiği ve dizin denetim verileri (Henüz test edilmedi).", endpoint: "https://searchconsole.googleapis.com/v1", tokenMasked: "ya29.a0AfH6SM••••••••••••" },
  { id: "wp", ad: "WordPress REST", tur: "Application Password", durum: "Test Edilmedi", aciklama: "Yazı başlıkları, meta etiketleri ve canonical güncellemeleri (Henüz test edilmedi).", endpoint: "https://flagship-store.com/wp-json/wp/v2", tokenMasked: "app_pwd_••••••••••••" },
  { id: "git", ad: "Git / GitHub PR", tur: "Kişisel erişim belirteci", durum: "Test Edilmedi", aciklama: "Headless siteler için pull request ve onay akışı (Henüz test edilmedi).", endpoint: "https://api.github.com/repos/org/seo-store", tokenMasked: "ghp_••••••••••••••••" },
  { id: "webhook", ad: "Kurumsal webhook", tur: "HMAC-SHA256 imzalı", durum: "Test Edilmedi", aciklama: "Özel CMS sistemlerine imzalı veri aktarımı (Henüz test edilmedi).", endpoint: "https://cms.flagship-store.com/api/seo/webhook", tokenMasked: "whsec_••••••••••••••" },
];

export interface AuditRow {
  time: string;
  user: string;
  action: string;
  target: string;
  detail: string;
  ip: string;
}

export const DEMO_AUDIT: AuditRow[] = [
  { time: "00:25:12", user: "Sistem (otonom motor)", action: "DEĞİŞİKLİK_UYGULANDI", target: "/urunler/kategori", detail: "Canonical etiketi düzeltildi ve doğrulanarak kaydedildi.", ip: "127.0.0.1" },
  { time: "00:20:04", user: "mert@seo.com", action: "DEĞİŞİKLİK_ONAYLANDI", target: "Değişiklik seti #CS-4102", detail: "Kullanıcı manuel inceleme ve onay verdi.", ip: "127.0.0.1" },
  { time: "00:15:30", user: "Sistem (crawler)", action: "TARAMA_TAMAMLANDI", target: "https://flagship-store.com", detail: "124 sayfa tarandı ve indeks durumu güncellendi.", ip: "127.0.0.1" },
  { time: "00:10:02", user: "admin@calpeo.io", action: "OTURUM_AÇILDI", target: "JWT oturumu", detail: "HMAC-SHA256 imzalı oturum başlatıldı.", ip: "127.0.0.1" },
];

// ==========================================
// 1. Keywords (Rank Tracker & Explorer)
// ==========================================
export interface KeywordItem {
  id: string;
  keyword: string;
  current_pos: number;
  prev_pos: number;
  change: number;
  volume: number;
  difficulty: number;
  cpc: number;
  intent: "TRANSACTIONAL" | "COMMERCIAL" | "INFORMATIONAL" | "NAVIGATIONAL";
  target_url: string;
  trend_7d: number[];
  serp_features?: string[];
  checked_at: string;
}

export interface KeywordResearchItem {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  intent: "TRANSACTIONAL" | "COMMERCIAL" | "INFORMATIONAL" | "NAVIGATIONAL";
  type: "LONG_TAIL" | "QUESTION" | "RELATED" | "PAA";
  has_ai_overview: boolean;
}

export interface KeywordsData {
  trackedCount: number;
  top3Count: number;
  top10Count: number;
  avgPosition: number;
  totalVolume: number;
  keywords: KeywordItem[];
  researchSuggestions: KeywordResearchItem[];
}

export const DEMO_KEYWORDS: KeywordsData = {
  trackedCount: 24,
  top3Count: 8,
  top10Count: 17,
  avgPosition: 6.4,
  totalVolume: 142800,
  keywords: [
    {
      id: "kw-1",
      keyword: "otonom seo platformu",
      current_pos: 1,
      prev_pos: 2,
      change: 1,
      volume: 8400,
      difficulty: 32,
      cpc: 14.5,
      intent: "COMMERCIAL",
      target_url: "https://flagship-store.com/",
      trend_7d: [3, 2, 2, 2, 1, 1, 1],
      serp_features: ["AI Overview", "Featured Snippet", "SiteLinks"],
      checked_at: "Bugün 01:10"
    },
    {
      id: "kw-2",
      keyword: "yapay zeka canonical duzeltme",
      current_pos: 2,
      prev_pos: 4,
      change: 2,
      volume: 5200,
      difficulty: 28,
      cpc: 18.2,
      intent: "TRANSACTIONAL",
      target_url: "https://flagship-store.com/ozellikler/canonical",
      trend_7d: [5, 4, 4, 3, 3, 2, 2],
      serp_features: ["AI Overview", "People Also Ask"],
      checked_at: "Bugün 01:10"
    },
    {
      id: "kw-3",
      keyword: "generative engine optimization turkiye",
      current_pos: 3,
      prev_pos: 5,
      change: 2,
      volume: 6800,
      difficulty: 35,
      cpc: 22.0,
      intent: "COMMERCIAL",
      target_url: "https://flagship-store.com/geo",
      trend_7d: [7, 6, 5, 4, 4, 3, 3],
      serp_features: ["AI Overview", "Video Pack"],
      checked_at: "Bugün 01:10"
    },
    {
      id: "kw-4",
      keyword: "schema markup json ld validator",
      current_pos: 4,
      prev_pos: 4,
      change: 0,
      volume: 18200,
      difficulty: 46,
      cpc: 12.8,
      intent: "INFORMATIONAL",
      target_url: "https://flagship-store.com/schema",
      trend_7d: [4, 4, 5, 4, 4, 4, 4],
      serp_features: ["Featured Snippet", "People Also Ask"],
      checked_at: "Bugün 01:10"
    },
    {
      id: "kw-5",
      keyword: "core web vitals mobile lcp hizlandirma",
      current_pos: 6,
      prev_pos: 9,
      change: 3,
      volume: 9400,
      difficulty: 41,
      cpc: 16.4,
      intent: "INFORMATIONAL",
      target_url: "https://flagship-store.com/cwv",
      trend_7d: [11, 10, 9, 8, 7, 6, 6],
      serp_features: ["People Also Ask"],
      checked_at: "Bugün 01:10"
    },
    {
      id: "kw-6",
      keyword: "otomatik site ici link analizi",
      current_pos: 7,
      prev_pos: 6,
      change: -1,
      volume: 4600,
      difficulty: 29,
      cpc: 9.7,
      intent: "COMMERCIAL",
      target_url: "https://flagship-store.com/links",
      trend_7d: [5, 5, 6, 6, 6, 7, 7],
      serp_features: ["People Also Ask"],
      checked_at: "Bugün 01:10"
    },
    {
      id: "kw-7",
      keyword: "teknik seo denetimi araci",
      current_pos: 8,
      prev_pos: 12,
      change: 4,
      volume: 24500,
      difficulty: 58,
      cpc: 26.5,
      intent: "TRANSACTIONAL",
      target_url: "https://flagship-store.com/health",
      trend_7d: [14, 12, 11, 10, 9, 8, 8],
      serp_features: ["AI Overview", "Local Pack", "People Also Ask"],
      checked_at: "Bugün 01:10"
    },
    {
      id: "kw-8",
      keyword: "calpeo seo giris",
      current_pos: 1,
      prev_pos: 1,
      change: 0,
      volume: 12000,
      difficulty: 12,
      cpc: 3.2,
      intent: "NAVIGATIONAL",
      target_url: "https://flagship-store.com/login",
      trend_7d: [1, 1, 1, 1, 1, 1, 1],
      serp_features: ["SiteLinks"],
      checked_at: "Bugün 01:10"
    }
  ],
  researchSuggestions: [
    {
      keyword: "yapay zeka arama motorlari seo stratejileri 2026",
      volume: 15400,
      difficulty: 34,
      cpc: 24.5,
      intent: "INFORMATIONAL",
      type: "LONG_TAIL",
      has_ai_overview: true
    },
    {
      keyword: "chatgpt ve perplexity alintisi nasil alinir?",
      volume: 11200,
      difficulty: 28,
      cpc: 19.8,
      intent: "INFORMATIONAL",
      type: "QUESTION",
      has_ai_overview: true
    },
    {
      keyword: "en iyi otonom seo yazilimi karsilastirmasi",
      volume: 18900,
      difficulty: 52,
      cpc: 31.0,
      intent: "COMMERCIAL",
      type: "RELATED",
      has_ai_overview: false
    },
    {
      keyword: "cloudflare worker seo yonlendirmeleri nasil yapilir?",
      volume: 6800,
      difficulty: 25,
      cpc: 12.3,
      intent: "INFORMATIONAL",
      type: "QUESTION",
      has_ai_overview: true
    },
    {
      keyword: "otonom seo araci satin al",
      volume: 8200,
      difficulty: 49,
      cpc: 38.0,
      intent: "TRANSACTIONAL",
      type: "LONG_TAIL",
      has_ai_overview: false
    }
  ]
};

// ==========================================
// 2. Competitors (Intelligence & Keyword Gap)
// ==========================================
export interface CompetitorItem {
  id: string;
  name: string;
  domain: string;
  seo_score: number;
  organic_traffic: number;
  ranked_keywords: number;
  backlinks: number;
  geo_visibility: number;
  top_keywords: string[];
}

export interface CompetitorGapItem {
  keyword: string;
  volume: number;
  my_position: number | null;
  competitor_positions: Record<string, number>;
  opportunity_score: number;
  recommended_action: string;
}

export interface CompetitorsData {
  myDomain: string;
  mySeoScore: number;
  myOrganicTraffic: number;
  myRankedKeywords: number;
  myBacklinks: number;
  myGeoVisibility: number;
  competitors: CompetitorItem[];
  keywordGap: CompetitorGapItem[];
}

export const DEMO_COMPETITORS: CompetitorsData = {
  myDomain: "flagship-store.com",
  mySeoScore: 88,
  myOrganicTraffic: 142000,
  myRankedKeywords: 8400,
  myBacklinks: 48500,
  myGeoVisibility: 82,
  competitors: [
    {
      id: "comp-1",
      name: "Semrush Pro",
      domain: "semrush.com",
      seo_score: 95,
      organic_traffic: 1850000,
      ranked_keywords: 420000,
      backlinks: 12500000,
      geo_visibility: 89,
      top_keywords: ["seo audit", "keyword research tool", "backlink checker"]
    },
    {
      id: "comp-2",
      name: "Ahrefs Webmaster",
      domain: "ahrefs.com",
      seo_score: 96,
      organic_traffic: 2400000,
      ranked_keywords: 510000,
      backlinks: 18900000,
      geo_visibility: 93,
      top_keywords: ["site explorer", "seo score", "broken link finder"]
    },
    {
      id: "comp-3",
      name: "Moz Pro",
      domain: "moz.com",
      seo_score: 90,
      organic_traffic: 980000,
      ranked_keywords: 230000,
      backlinks: 7800000,
      geo_visibility: 79,
      top_keywords: ["domain authority", "keyword difficulty", "page authority"]
    }
  ],
  keywordGap: [
    {
      keyword: "ai generative engine optimization",
      volume: 14800,
      my_position: null,
      competitor_positions: { "semrush.com": 3, "ahrefs.com": 2, "moz.com": 7 },
      opportunity_score: 94,
      recommended_action: "Kapsamlı rehber içeriği oluştur & AI FAQ Schema ekle"
    },
    {
      keyword: "automated technical seo fixes cdn",
      volume: 9200,
      my_position: 18,
      competitor_positions: { "semrush.com": 4, "ahrefs.com": 5, "moz.com": 9 },
      opportunity_score: 88,
      recommended_action: "Mevcut sayfayı güncel vaka çalışmasıyla zenginleştir"
    },
    {
      keyword: "schema markup json ld validator",
      volume: 18200,
      my_position: 4,
      competitor_positions: { "semrush.com": 2, "ahrefs.com": 1, "moz.com": 5 },
      opportunity_score: 82,
      recommended_action: "İç link gücünü artır ve ilk 2 sırayı hedefle"
    },
    {
      keyword: "self referential canonical tag generator",
      volume: 5400,
      my_position: null,
      competitor_positions: { "semrush.com": 2, "ahrefs.com": 3, "moz.com": 6 },
      opportunity_score: 79,
      recommended_action: "Ücretsiz çevrimiçi araç sayfası aç"
    },
    {
      keyword: "core web vitals mobile inp optimization",
      volume: 7600,
      my_position: 12,
      competitor_positions: { "semrush.com": 5, "ahrefs.com": 4, "moz.com": 8 },
      opportunity_score: 75,
      recommended_action: "Teknik kod örnekleri ve çözüm rehberi ekle"
    }
  ]
};

// ==========================================
// 3. Content Optimizer & NLP Scorer
// ==========================================
export interface ContentOptimizationData {
  url: string;
  targetKeyword: string;
  contentScore: number;
  geoScore: number;
  readabilityScore: number;
  wordCount: number;
  targetWordCount: number;
  keywordDensity: number;
  headings: { h1: number; h2: number; h3: number };
  missingEntities: Array<{ name: string; current: number; recommended: string; status: "Eksik" | "Yetersiz" | "Optimal" }>;
  missingHeadings: string[];
  aiSuggestions: string[];
}

export const DEMO_CONTENT: ContentOptimizationData = {
  url: "https://flagship-store.com/blog/otonom-seo-rehberi",
  targetKeyword: "otonom seo yazılımı",
  contentScore: 84,
  geoScore: 88,
  readabilityScore: 82,
  wordCount: 1680,
  targetWordCount: 1850,
  keywordDensity: 1.7,
  headings: { h1: 1, h2: 5, h3: 7 },
  missingEntities: [
    { name: "Google Knowledge Graph", current: 0, recommended: "2-4 kez", status: "Eksik" },
    { name: "Helpful Content System", current: 1, recommended: "3-5 kez", status: "Yetersiz" },
    { name: "Structured Data JSON-LD", current: 4, recommended: "3-5 kez", status: "Optimal" },
    { name: "Core Web Vitals INP", current: 1, recommended: "2-4 kez", status: "Yetersiz" },
    { name: "PageRank Dağılımı", current: 3, recommended: "2-4 kez", status: "Optimal" },
    { name: "Generative AI Alıntıları", current: 0, recommended: "2-3 kez", status: "Eksik" }
  ],
  missingHeadings: [
    "H2: 2026'da Otonom SEO Araçları Nasıl Çalışır?",
    "H2: Geleneksel SEO ve Otonom CDN Çözümleri Arasındaki Farklar",
    "H3: Sıkça Sorulan Sorular (FAQ Schema Destekli)"
  ],
  aiSuggestions: [
    "Hedef anahtar kelime ilk 100 kelime içerisinde ve H1 başlığının hemen altında bir kez daha vurgulanmalı.",
    "İçeriğe 1 adet karşılaştırma tablosu veya özellik matrisi eklenmesi, ChatGPT ve Perplexity'nin 'Direct Answer' alıntı ihtimalini %45 artırır.",
    "Sayfa sonuna FAQPage schema uyumlu 3 soru ve net yanıt bloğu yerleştirin."
  ]
};

// ==========================================
// 4. AI SEO Specialist Copilot
// ==========================================
export interface AiCopilotMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  sources?: string[];
  actions?: Array<{ label: string; actionType: "APPLY_FIX" | "CRAWL" | "CREATE_TASK" | "GENERATE_CONTENT"; href?: string }>;
}

export const DEMO_AI_CHAT: AiCopilotMessage[] = [
  {
    id: "ai-1",
    sender: "assistant",
    text: "Merhaba! Ben Calpeo Otonom SEO & GEO Uzmanıyım. Sitenizin arama motoru performansı, tarama verileri, teknik indeksleme ve yapay zeka (ChatGPT, Perplexity, Gemini) görünürlüğünü gerçek zamanlı denetliyorum.\n\nBugün sitenizin performansını artırmak için ne yapmak istersiniz?",
    timestamp: "Bugün 01:00",
    sources: ["Google Search Central Kılavuzu", "Calpeo Rule Engine", "GSC Canlı Metrikleri"],
    actions: [
      { label: "Kritik Hataları Analiz Et", actionType: "APPLY_FIX", href: "/issues" },
      { label: "Trafik Fırsatlarını Göster", actionType: "GENERATE_CONTENT", href: "/opportunities" },
      { label: "Yeni Derin Tarama Başlat", actionType: "CRAWL", href: "/crawls" }
    ]
  },
  {
    id: "ai-2",
    sender: "user",
    text: "Sitemizde son günlerde tespit edilen en kritik teknik SEO açıkları neler?",
    timestamp: "Bugün 01:05"
  },
  {
    id: "ai-3",
    sender: "assistant",
    text: "flagship-store.com üzerinde son yapılan taramada 2 adet kritik, 1 adet yüksek öncelikli sorun saptandı:\n\n1. **Kanonik Yönlendirme Döngüsü (/urunler/kategori):** Sayfa kendi kendine 404 URL'ye canonical veriyor. Bu durum dizin kaybına yol açabilir (+14 Puan etki potansiyeli).\n2. **Eksik JSON-LD Schema (48 Ürün Sayfası):** Ürün sayfalarında fiyat ve stok rozetleri eksik. Google arama sonuçlarında yıldızlı snippet görünmüyor.\n3. **LCP Görsel Sıkıştırma (Mobil):** Ana banner görseli webp formatında değil, mobil LCP 3.2 sn seviyesinde.\n\nÖnerim: İlk olarak canonical düzeltmesini CDN seviyesinde yayına alalım.",
    timestamp: "Bugün 01:05",
    sources: ["Crawl Engine #CRAWL-9842", "Schema.org Validator", "Chrome UX Report LCP"],
    actions: [
      { label: "Canonical Düzeltmesini Onayla (#CS-4102)", actionType: "APPLY_FIX", href: "/changes" },
      { label: "JSON-LD Kodunu İncele", actionType: "CREATE_TASK", href: "/schema" }
    ]
  }
];

// ==========================================
// 5. GEO (Generative Engine Optimization)
// ==========================================
export interface GeoPlatformScore {
  platform: string;
  score: number;
  mentions: number;
  citations: number;
  status: "DOMINANT" | "VISIBLE" | "RARE";
  trend: string;
}

export interface GeoPromptItem {
  id: string;
  prompt: string;
  frequency: string;
  brand_mentioned: boolean;
  citation_rank: number;
  platform_results: Record<string, { mentioned: boolean; snippet: string }>;
  top_competitor_cited: string;
}

export interface GeoData {
  overallVisibility: number;
  aiSearchShare: number;
  topEngine: string;
  platforms: GeoPlatformScore[];
  prompts: GeoPromptItem[];
  quickActions: Array<{ title: string; impact: string; category: string; description: string }>;
}

export const DEMO_GEO: GeoData = {
  overallVisibility: 82,
  aiSearchShare: 64,
  topEngine: "Perplexity AI (%89)",
  platforms: [
    { platform: "Perplexity AI", score: 89, mentions: 58, citations: 42, status: "DOMINANT", trend: "+12%" },
    { platform: "ChatGPT (GPT-4o)", score: 86, mentions: 48, citations: 33, status: "DOMINANT", trend: "+8%" },
    { platform: "Google AI Overviews", score: 79, mentions: 39, citations: 26, status: "VISIBLE", trend: "+15%" },
    { platform: "Gemini Pro", score: 72, mentions: 22, citations: 14, status: "VISIBLE", trend: "+5%" },
    { platform: "Claude 3.5 Sonnet", score: 68, mentions: 17, citations: 11, status: "RARE", trend: "+2%" }
  ],
  prompts: [
    {
      id: "gp-1",
      prompt: "2026'da Türkiye'nin en iyi otonom SEO ve teknik optimizasyon platformu hangisi?",
      frequency: "GÜNLÜK",
      brand_mentioned: true,
      citation_rank: 1,
      platform_results: {
        "Perplexity AI": { mentioned: true, snippet: "Öne çıkan platform, otonom teknik denetim ve CDN seviyesinde canonical düzeltme sağlayan Flagship Store / Calpeo çözümüdür." },
        "ChatGPT (GPT-4o)": { mentioned: true, snippet: "Kullanıcı deneyimi ve teknik SEO otomasyonunda birinci sırada tavsiye edilmektedir (Kaynak: flagship-store.com)." },
        "Gemini Pro": { mentioned: true, snippet: "Kurumsal SEO araçları karşılaştırma listesinde yer almaktadır." }
      },
      top_competitor_cited: "semrush.com"
    },
    {
      id: "gp-2",
      prompt: "E-ticaret sitelerinde kanonikleştirme ve zengin sonuç nasıl uygulanır?",
      frequency: "GÜNLÜK",
      brand_mentioned: true,
      citation_rank: 2,
      platform_results: {
        "Perplexity AI": { mentioned: true, snippet: "Flagship Store tarafından yayınlanan kanonikleştirme kılavuzu doğrudan kaynak olarak alıntılanmıştır." },
        "ChatGPT (GPT-4o)": { mentioned: true, snippet: "JSON-LD schema örnekleri ve self-referential canonical adımları referans gösterilmiştir." },
        "Gemini Pro": { mentioned: false, snippet: "Genel sektörel blog sayfaları listelendi." }
      },
      top_competitor_cited: "ahrefs.com"
    },
    {
      id: "gp-3",
      prompt: "Core Web Vitals INP optimizasyonu için en etkili teknikler nelerdir?",
      frequency: "HAFTALIK",
      brand_mentioned: true,
      citation_rank: 1,
      platform_results: {
        "Perplexity AI": { mentioned: true, snippet: "JavaScript main-thread iş parçacığı optimizasyonu ve hydration kılavuzu referans verilmiştir." },
        "ChatGPT (GPT-4o)": { mentioned: true, snippet: "Teknik vaka çalışması doğrudan yanıt olarak özetlenmiştir." },
        "Gemini Pro": { mentioned: true, snippet: "Örnek kaynaklar arasında atıf almıştır." }
      },
      top_competitor_cited: "web.dev"
    }
  ],
  quickActions: [
    {
      title: "Direct Answer (Net Yanıt) Blokları Ekleyin",
      impact: "+%24 Alıntı Artışı",
      category: "GEO BİÇİMLENDİRME",
      description: "Anahtar kavramların altına 40-60 kelimelik net tanımlar yerleştirerek ChatGPT ve Perplexity'nin doğrudan sizi alıntılamasını sağlayın."
    },
    {
      title: "ClaimReview ve FAQPage Schema Doğrulaması",
      impact: "+%18 Güvenilirlik",
      category: "YAPILANDIRILMIŞ VERİ",
      description: "Yapay zeka modellerinin içeriğinizi 'doğrulanmış gerçek' olarak sınıflandırması için schema hiyerarşisini tamamlayın."
    },
    {
      title: "Otorite Karşılaştırma Tabloları",
      impact: "+%31 Tablo Çekme Oranı",
      category: "VERİ SUNUMU",
      description: "Google AI Overviews ve Claude karmaşık metin yerine HTML tablolarını doğrudan yanıt kartına taşımaktadır."
    }
  ]
};

