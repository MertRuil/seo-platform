export type SummaryTone = "evidence" | "warn" | "critical";

export interface SiteSummary {
  title: string;
  body: string;
  tone: SummaryTone;
}

/**
 * Sade Mod ana başlığı. Kritik sorun varken puan yüksek olsa da "iyi durumda" denmez;
 * başlık, aynı ekrandaki "kritik sorun" sayısıyla çelişmemelidir.
 */
export function siteSummary(score: number, critical: number, suggestions: number): SiteSummary {
  const next = suggestions > 0 ? ` ${suggestions} öneri onayınızı bekliyor.` : "";
  if (critical > 0) {
    return {
      title: `Sitenizde ${critical} acil sorun var`,
      body: `${critical > 1 ? "Bu sorunlar" : "Bu sorun"} Google'ın sayfalarınızı doğru görmesini engelliyor; önce ${critical > 1 ? "bunları" : "bunu"} düzeltin.${next}`,
      tone: "critical",
    };
  }
  if (score >= 80) {
    return { title: "Siteniz iyi durumda", body: `Acil sorun yok.${next}`, tone: "evidence" };
  }
  return { title: "Sitenizde iyileştirilecek alanlar var", body: `Acil sorun yok ama sağlık puanı ${score}/100.${next}`, tone: "warn" };
}

export function scoreTone(score: number): SummaryTone {
  if (score >= 80) return "evidence";
  if (score >= 50) return "warn";
  return "critical";
}

export interface PlainTask {
  title: string;
  benefit: string;
}

/**
 * Sade Mod görev metni. Öneri başlıkları teknik terim içerir (canonical, anchor, PageRank);
 * başlangıç kullanıcısına ne değişeceğini söyleyen cümle gösterilir. Eşleşme yoksa özgün başlık kalır.
 */
const PLAIN_TASKS: Array<[RegExp, PlainTask]> = [
  [/CANNIBAL/, { title: "Aynı aramada birbiriyle yarışan sayfalarınızı ayırın", benefit: "Google hangi sayfayı göstereceğini bilir, sıralama bölünmez." }],
  [/CANONICAL/, { title: "Bir sayfanın Google'da yanlış adresle görünmesini düzeltin", benefit: "Sayfa yeniden Google sonuçlarına girebilir." }],
  [/REDIRECT|YONLENDIRME/, { title: "Gereksiz yönlendirmeleri kaldırın", benefit: "Sayfalar daha hızlı açılır, Google daha kolay tarar." }],
  [/404|4XX|5XX|BROKEN|KIRIK/, { title: "Açılmayan sayfaları ve kırık bağlantıları onarın", benefit: "Ziyaretçiler ve Google hata sayfasına düşmez." }],
  [/CTR|TITLE|META|SNIPPET|BASLIK/, { title: "Arama sonucundaki başlığınızı daha çok tıklanacak şekilde yenileyin", benefit: "Aynı sıralamada daha fazla ziyaretçi gelir." }],
  [/LINK|ANCHOR|ORPHAN/, { title: "Önemli bir sayfaya site içinden daha çok bağlantı verin", benefit: "Google bu sayfayı daha önemli sayar." }],
  [/SCHEMA|STRUCTURED|SEMA/, { title: "Google'a işletme bilgilerinizi daha açık anlatın", benefit: "Arama sonucunda yıldız, SSS gibi ek bilgiler görünebilir." }],
  [/RANKING_EXPANSION/, { title: "İlk sayfaya yakın kelimeler için sayfanızı güçlendirin", benefit: "Birkaç sıra yükselmek tıklamayı belirgin artırır." }],
  [/CONTENT|THIN|ICERIK/, { title: "İçeriği zayıf sayfaları güçlendirin", benefit: "Google sayfayı soruya yanıt veren kaynak olarak görür." }],
];

export function plainTask(item: { title: string; category: string }): PlainTask {
  const key = item.category.toLocaleUpperCase("tr-TR").replace(/İ/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ç/g, "C").replace(/Ö/g, "O").replace(/Ü/g, "U");
  const hit = PLAIN_TASKS.find(([re]) => re.test(key));
  return hit ? hit[1] : { title: item.title, benefit: "Ayrıntılar Öncelikli İşler sayfasında." };
}
