/**
 * Sorun kategorileri için kullanıcı dilinde etiket ve "neden önemli" açıklaması.
 * Bunlar genel SEO bilgisidir; ölçülmüş etki veya tahmini trafik kazancı değildir.
 */
export interface IssueGuide {
  label: string;
  why: string;
}

const GUIDES: Array<{ match: RegExp; guide: IssueGuide }> = [
  {
    match: /INDEX|NOINDEX|ROBOTS|CRAWL/,
    guide: { label: "Dizinlenme", why: "Arama motorunun dizinine girmeyen sayfa arama sonuçlarında hiç görünmez; bu sayfalardan organik trafik gelmez." },
  },
  {
    match: /CANONICAL|DUPLICAT|KOPYA/,
    guide: { label: "Kopya içerik ve canonical", why: "Aynı içeriğin birden fazla adresi olduğunda Google hangisini göstereceğini kendisi seçer; sıralama sinyalleri adresler arasında bölünür." },
  },
  {
    match: /STATUS|HTTP|KIRIK|BROKEN|404|5XX/,
    guide: { label: "Hata veren sayfalar", why: "Hata döndüren sayfalar dizinden düşer; bu sayfalara verilen bağlantılar ziyaretçiyi ve tarama bütçesini boşa harcar." },
  },
  {
    match: /REDIRECT|YÖNLENDİRME/,
    guide: { label: "Yönlendirmeler", why: "Zincirleme veya geçici yönlendirmeler sayfanın açılmasını yavaşlatır ve arama motorunun doğru adresi seçmesini zorlaştırır." },
  },
  {
    match: /SITEMAP/,
    guide: { label: "Site haritası", why: "Site haritası arama motoruna hangi sayfaların önemli olduğunu söyler; hatalı kayıtlar yeni sayfaların geç keşfedilmesine yol açar." },
  },
  {
    match: /TITLE|META|METADATA/,
    guide: { label: "Başlık ve meta açıklama", why: "Arama sonucunda kullanıcının gördüğü ilk metin budur; eksik veya kötü yazılmış başlık ve açıklama tıklanma oranını düşürür." },
  },
  {
    match: /HEADING|H1/,
    guide: { label: "Başlık yapısı", why: "Ana başlık sayfanın konusunu hem ziyaretçiye hem arama motoruna söyler; eksik ya da çoklu H1 konuyu bulanıklaştırır." },
  },
  {
    match: /CONTENT|İÇERİK|THIN/,
    guide: { label: "İçerik", why: "Az veya yüzeysel içerik arama niyetini karşılamaz; bu sayfalar hem Google'da hem AI yanıtlarında kaynak olarak seçilmez." },
  },
  {
    match: /LINK|ORPHAN|BAĞLANTI/,
    guide: { label: "İç bağlantılar", why: "İç bağlantılar arama motorunun sayfaları bulmasını ve önemini anlamasını sağlar; bağlantı almayan sayfalar geç taranır." },
  },
  {
    match: /IMAGE|IMG|ACCESSIB|ALT/,
    guide: { label: "Görseller ve erişilebilirlik", why: "Alt metni olmayan görseller ekran okuyucu kullananlar için anlamsızdır ve görsel aramada görünmez." },
  },
  {
    match: /SCHEMA|STRUCTURED/,
    guide: { label: "Yapılandırılmış veri", why: "Schema.org işaretlemesi zengin sonuçlar için gereklidir ve AI yanıt motorlarının sayfayı doğru yorumlamasına yardım eder." },
  },
  {
    match: /PERFORMANCE|SPEED|CWV|TTFB/,
    guide: { label: "Hız", why: "Yavaş açılan sayfalar ziyaretçi kaybettirir; Core Web Vitals Google'ın sayfa deneyimi sinyallerinden biridir." },
  },
  {
    match: /MOBILE|VIEWPORT/,
    guide: { label: "Mobil uyumluluk", why: "Google sitenin mobil sürümünü esas alır; mobilde düzgün görünmeyen sayfalar sıralamada geri kalır." },
  },
  {
    match: /HREFLANG|LANG/,
    guide: { label: "Dil ve bölge", why: "Hatalı dil işaretleri yanlış ülkedeki kullanıcıya yanlış dil sürümünün gösterilmesine yol açar." },
  },
  {
    match: /JAVASCRIPT|JS/,
    guide: { label: "JavaScript", why: "Yalnızca JavaScript ile oluşan içeriği bazı arama ve AI tarayıcıları göremez." },
  },
  {
    match: /COMPLIANCE|MEVZUAT/,
    guide: { label: "Mevzuat uyumu", why: "Reklam ve tüketici mevzuatına aykırı ifadeler yaptırım riski taşır ve güveni zedeler." },
  },
];

export function issueGuide(category: string, ruleId = ""): IssueGuide {
  const key = `${category} ${ruleId}`.toUpperCase();
  return GUIDES.find((g) => g.match.test(key))?.guide ?? { label: category, why: "Bu bulgu sitenin arama motorlarında doğru anlaşılmasını etkiler." };
}
