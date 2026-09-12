export interface PlotOptions {
  width: number;
  height: number;
  max: number;
  padX: number;
  padTop: number;
  padBottom: number;
}

/** Eksen tavanı: 1-2-5-10 basamaklarına yuvarlanmış okunur bir üst sınır (asla 0 değil). */
export function niceMax(values: number[]): number {
  const m = Math.max(0, ...values.filter((v) => Number.isFinite(v)));
  if (m <= 0) return 1;
  const exp = Math.floor(Math.log10(m));
  const base = Math.pow(10, exp);
  const frac = m / base;
  const step = frac <= 1 ? 1 : frac <= 1.5 ? 1.5 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10;
  return Number((step * base).toPrecision(12));
}

export function xPositions(count: number, width: number, padX: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [width / 2];
  const inner = width - padX * 2;
  return Array.from({ length: count }, (_, i) => padX + (inner * i) / (count - 1));
}

function yFor(value: number, o: PlotOptions): number {
  const plotH = o.height - o.padTop - o.padBottom;
  const ratio = o.max > 0 ? Math.min(Math.max(value, 0), o.max) / o.max : 0;
  return o.padTop + plotH * (1 - ratio);
}

function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}

export function points(values: number[], o: PlotOptions): Array<[number, number]> {
  const xs = xPositions(values.length, o.width, o.padX);
  return values.map((v, i) => [xs[i], yFor(v, o)]);
}

export function linePath(values: number[], o: PlotOptions): string {
  const pts = points(values, o);
  if (pts.length === 0) return "";
  return pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${fmt(x)} ${fmt(y)}`).join(" ");
}

export function areaPath(values: number[], o: PlotOptions): string {
  const pts = points(values, o);
  if (pts.length === 0) return "";
  const baseline = yFor(0, o);
  const first = pts[0];
  const last = pts[pts.length - 1];
  return `${linePath(values, o)} L${fmt(last[0])} ${fmt(baseline)} L${fmt(first[0])} ${fmt(baseline)} Z`;
}
