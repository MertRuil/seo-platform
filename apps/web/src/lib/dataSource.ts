export type DataSource = "live" | "demo";

export type DemoReason =
  | "no-backend"
  | "unauthorized"
  | "no-org"
  | "no-site"
  | "no-crawl"
  | "fetch-failed"
  | "no-endpoint";

export interface SourceInputs {
  backendReachable: boolean;
  authorized: boolean;
  hasOrg: boolean;
  hasSite: boolean;
  hasCrawl: boolean;
}

export interface SourceDecision {
  source: DataSource;
  reason?: DemoReason;
}

/** Tek karar noktası: ekran canlı veri mi, örnek veri mi gösterecek ve neden. */
export function decideSource(i: SourceInputs): SourceDecision {
  if (!i.backendReachable) return { source: "demo", reason: "no-backend" };
  if (!i.authorized) return { source: "demo", reason: "unauthorized" };
  if (!i.hasOrg) return { source: "demo", reason: "no-org" };
  if (!i.hasSite) return { source: "demo", reason: "no-site" };
  if (!i.hasCrawl) return { source: "demo", reason: "no-crawl" };
  return { source: "live" };
}

export const DEMO_REASON_TEXT: Record<DemoReason, string> = {
  "no-backend": "Arka uca ulaşılamıyor; örnek veri gösteriliyor.",
  unauthorized: "Bu hesap arka uçta tanımlı değil; örnek veri gösteriliyor.",
  "no-org": "Hesabınıza bağlı bir organizasyon yok; örnek veri gösteriliyor.",
  "no-site": "Henüz kayıtlı site yok; örnek veri gösteriliyor.",
  "no-crawl": "Henüz tamamlanmış tarama yok; örnek veri gösteriliyor.",
  "fetch-failed": "Canlı veri alınamadı; örnek veri gösteriliyor.",
  "no-endpoint": "Bu görünüm için arka uç ucu henüz yok; örnek veri gösteriliyor.",
};
