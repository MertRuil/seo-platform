const nf = new Intl.NumberFormat("tr-TR");

export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return digits > 0 ? new Intl.NumberFormat("tr-TR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n) : nf.format(n);
}

const compact = new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 });

/** 142800 → "142,8 B", 2410000 → "2,4 Mn" (Türkçe kısaltma: B = bin, Mn = milyon) */
export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return compact.format(n);
}

/** 0.0595 → "%5,95" (ratio) */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return `%${formatNumber(ratio * 100, digits)}`;
}

/** 98.2 → "%98,2" (değer zaten yüzde) */
export function formatPercentValue(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `%${formatNumber(value, digits)}`;
}

/** Değişim yüzdesi: 8.1 → "+%8,1", -2.3 → "−%2,3" */
export function formatDelta(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}%${formatNumber(Math.abs(value), digits)}`;
}

const tryCurrency = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 14.5 → "₺14,50" */
export function formatTry(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return tryCurrency.format(n);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "az önce";
  if (diffMin < 60) return `${diffMin} dk önce`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h} sa önce`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days} gün önce`;
  return formatDateTime(iso);
}

export function shortUrl(url: string, max = 48): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "/" : u.pathname.replace(/\/$/, "");
    const s = `${u.hostname}${path}`;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  } catch {
    return url.length > max ? `${url.slice(0, max - 1)}…` : url;
  }
}

/** Kuruş cinsinden tutar: (11900, "USD") → "$119,00". Kurla çevrilmez. */
export function formatMoneyMinor(minor: number | null | undefined, currency: string): string {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return "—";
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
  } catch {
    return `${formatNumber(minor / 100, 2)} ${currency}`;
  }
}

/** Para birimine göre ayrı tutarlar: { USD: 7800, TRY: 10000 } → "$78,00 · ₺100,00"; boşsa "—". */
export function formatMinorByCurrency(byCurrency: Record<string, number> | null | undefined): string {
  const entries = Object.entries(byCurrency ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return entries.length ? entries.map(([cur, minor]) => formatMoneyMinor(minor, cur)).join(" · ") : "—";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
}
