const nf = new Intl.NumberFormat("tr-TR");

export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return digits > 0 ? new Intl.NumberFormat("tr-TR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n) : nf.format(n);
}

/** 142800 → "142,8B", 2410000 → "2,41M" */
export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${formatNumber(n / 1_000_000, 2)}M`;
  if (Math.abs(n) >= 1_000) return `${formatNumber(n / 1_000, 1)}B`;
  return formatNumber(n);
}

/** 0.0595 → "%5,95" (ratio) */
export function formatPercent(ratio: number | null | undefined, digits = 1): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return `%${formatNumber(ratio * 100, digits)}`;
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
