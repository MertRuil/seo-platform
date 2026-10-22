// Hermes'te Intl "compact" gösterimi her platformda yok; Türkçe kısaltma elle yapılır (web'deki formatCompact ile aynı çıktı).
const trDecimal = (n: number, digits: number, keepZeros = false): string => {
  const fixed = keepZeros ? n.toFixed(digits) : n.toFixed(digits).replace(/\.0+$/, "");
  const [int, frac] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return frac ? `${grouped},${frac}` : grouped;
};

/** 142800 → "142,8 B", 2410000 → "2,4 Mn" */
export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${trDecimal(n / 1_000_000_000, 1)} Mr`;
  if (abs >= 1_000_000) return `${trDecimal(n / 1_000_000, 1)} Mn`;
  if (abs >= 1_000) return `${trDecimal(n / 1_000, 1)} B`;
  return trDecimal(n, 0);
}

/** 14.5 → "₺14,50" */
export function formatTry(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `₺${trDecimal(n, 2, true)}`;
}
