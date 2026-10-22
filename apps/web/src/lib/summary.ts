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
