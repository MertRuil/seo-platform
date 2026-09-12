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
  { url: "https://flagship-store.com/urunler/ayakkabi", status: 200, title: "Spor ve Koşu Ayakkabıları Modelleri", canonical: "Kendisi", indexable: true, words: 980, depth: 1, responseMs: 210 },
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
    { url: "https://flagship-store.com/urunler/ayakkabi", pagerank: 0.142, inbound: 38, outbound: 18, status: "Güçlü kategori" },
    { url: "https://flagship-store.com/blog", pagerank: 0.118, inbound: 32, outbound: 65, status: "Otorite dağıtıcı" },
    { url: "https://flagship-store.com/fiyatlandirma", pagerank: 0.034, inbound: 3, outbound: 4, status: "Yetim / zayıf", weak: true },
  ],
  opportunities: [
    { source: "https://flagship-store.com/blog/seo-rehberi", target: "https://flagship-store.com/fiyatlandirma", reason: "Yüksek otoriteli blog sayfasından dönüşüm sayfasına bağlantı yok." },
    { source: "https://flagship-store.com/urunler/ayakkabi", target: "https://flagship-store.com/fiyatlandirma", reason: "Kategori sayfasından fiyatlandırmaya bağlamsal geçiş eksik." },
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
  { type: "Product", page: "https://flagship-store.com/urunler/ayakkabi", status: "Geçerli", richResult: "Fiyat & stok rozeti", missing: "—" },
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
    baslik: "Ayakkabı kategori sayfası başlık ve canonical iyileştirmesi",
    onem: "CRITICAL",
    etkilenenSayfa: "https://flagship-store.com/urunler/ayakkabi",
    kategori: "CANONICAL",
    durum: "BEKLİYOR",
    oncekiKod: `<title>Ayakkabılar</title>\n<link rel="canonical" href="https://flagship-store.com/404-broken" />`,
    yeniKod: `<title>Koşu ve Spor Ayakkabıları Modelleri | Flagship</title>\n<link rel="canonical" href="https://flagship-store.com/urunler/ayakkabi" />`,
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
  durum: "Bağlandı" | "Hazır" | "Doğrulama bekliyor";
  aciklama: string;
  endpoint: string;
  tokenMasked: string;
}

export const DEMO_CONNECTORS: ConnectorItem[] = [
  { id: "gsc", ad: "Google Search Console", tur: "OAuth 2.0", durum: "Bağlandı", aciklama: "Arama analitiği ve dizin denetim verileri.", endpoint: "https://searchconsole.googleapis.com/v1", tokenMasked: "ya29.a0AfH6SM••••••••••••" },
  { id: "wp", ad: "WordPress REST", tur: "Application Password", durum: "Hazır", aciklama: "Yazı başlıkları, meta etiketleri ve canonical güncellemeleri.", endpoint: "https://flagship-store.com/wp-json/wp/v2", tokenMasked: "app_pwd_••••••••••••" },
  { id: "git", ad: "Git / GitHub PR", tur: "Kişisel erişim belirteci", durum: "Hazır", aciklama: "Headless siteler için pull request ve onay akışı.", endpoint: "https://api.github.com/repos/org/seo-store", tokenMasked: "ghp_••••••••••••••••" },
  { id: "webhook", ad: "Kurumsal webhook", tur: "HMAC-SHA256 imzalı", durum: "Bağlandı", aciklama: "Özel CMS sistemlerine imzalı veri aktarımı.", endpoint: "https://cms.flagship-store.com/api/seo/webhook", tokenMasked: "whsec_••••••••••••••" },
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
  { time: "00:25:12", user: "Sistem (otonom motor)", action: "DEĞİŞİKLİK_UYGULANDI", target: "/urunler/ayakkabi", detail: "Canonical etiketi düzeltildi ve doğrulanarak kaydedildi.", ip: "127.0.0.1" },
  { time: "00:20:04", user: "mert@seo.com", action: "DEĞİŞİKLİK_ONAYLANDI", target: "Değişiklik seti #CS-4102", detail: "Kullanıcı manuel inceleme ve onay verdi.", ip: "127.0.0.1" },
  { time: "00:15:30", user: "Sistem (crawler)", action: "TARAMA_TAMAMLANDI", target: "https://flagship-store.com", detail: "124 sayfa tarandı ve indeks durumu güncellendi.", ip: "127.0.0.1" },
  { time: "00:10:02", user: "admin@calpeo.io", action: "OTURUM_AÇILDI", target: "JWT oturumu", detail: "HMAC-SHA256 imzalı oturum başlatıldı.", ip: "127.0.0.1" },
];
