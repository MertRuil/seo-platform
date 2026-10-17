export type DataSource = "live" | "demo";

export type DemoReason =
  | "loading"
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
  loading: "Canlı veriler yükleniyor. Aşağıdaki geçici önizleme sitenize ait değildir.",
  "no-backend": "Sunucuya ulaşılamıyor. Aşağıdaki veriler örnektir, sitenize ait değildir.",
  unauthorized: "Oturumunuz bu verilere erişemiyor. Aşağıdaki veriler örnektir.",
  "no-org": "Henüz site eklemediniz. Aşağıdaki veriler örnektir.",
  "no-site": "Henüz site eklemediniz. Aşağıdaki veriler örnektir.",
  "no-crawl": "İlk tarama henüz tamamlanmadı. Aşağıdaki veriler örnektir.",
  "fetch-failed": "Sitenizin verisi alınamadı. Aşağıdaki veriler örnektir.",
  "no-endpoint": "Bu ekran henüz gerçek veriye bağlı değil. Aşağıdaki veriler örnektir.",
};
