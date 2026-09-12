"use client";

import React, { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { areaPath, linePath, niceMax, xPositions, type PlotOptions } from "./chart-math";

export interface TrendSeries {
  name: string;
  values: number[];
  tone: "accent" | "evidence";
  dashed?: boolean;
  /** İlk seriye alan dolgusu uygulanır */
}

export interface TrendMarker {
  index: number;
  label: string;
  /** İşaretten itibaren gölgelenecek nokta sayısı (etki penceresi) */
  windowPoints?: number;
}

interface TrendChartProps {
  labels: string[];
  series: TrendSeries[];
  markers?: TrendMarker[];
  height?: number;
  format?: (n: number) => string;
  ariaLabel: string;
  className?: string;
}

const W = 640;
const PAD_X = 40;
const PAD_RIGHT = 12;
const PAD_TOP = 18;
const PAD_BOTTOM = 26;

const strokeClass = { accent: "stroke-accent", evidence: "stroke-evidence" } as const;
const fillClass = { accent: "fill-accent", evidence: "fill-evidence" } as const;
const textClass = { accent: "text-accent", evidence: "text-evidence" } as const;

/** Bağımlılıksız SVG zaman serisi: alan + çizgi, ince grid, vurgulu son nokta, dağıtım işaretleri, hover tooltip. */
export function TrendChart({ labels, series, markers = [], height = 220, format = (n) => String(n), ariaLabel, className }: TrendChartProps) {
  const [hover, setHover] = useState<number | null>(null);

  const max = useMemo(() => niceMax(series.flatMap((s) => s.values)), [series]);
  // xPositions padX'i iki yana uygular: ilk nokta PAD_X'te, son nokta W - PAD_RIGHT'ta olsun diye genişlik PAD_X kadar uzatılır.
  const PLOT_W = W - PAD_RIGHT + PAD_X;
  const plotOpts: PlotOptions = { width: PLOT_W, height, max, padX: PAD_X, padTop: PAD_TOP, padBottom: PAD_BOTTOM };
  const xs = useMemo(() => xPositions(labels.length, PLOT_W, PAD_X), [labels.length, PLOT_W]);
  const baseline = height - PAD_BOTTOM;
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    xs.forEach((px, i) => {
      const d = Math.abs(px - x);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best);
  };

  const hoverX = hover !== null ? xs[hover] : null;

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full h-auto block select-none"
        role="img"
        aria-label={ariaLabel}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* Grid ve y etiketleri */}
        {gridSteps.map((g) => {
          const y = PAD_TOP + (height - PAD_TOP - PAD_BOTTOM) * (1 - g);
          return (
            <g key={g}>
              <line x1={PAD_X} x2={W - PAD_RIGHT} y1={y} y2={y} className="stroke-line" strokeWidth={1} strokeDasharray={g === 0 ? undefined : "3 3"} />
              <text x={PAD_X - 6} y={y + 3} textAnchor="end" className="fill-muted font-mono" fontSize={9}>
                {format(max * g)}
              </text>
            </g>
          );
        })}

        {/* Etki pencereleri ve işaretler */}
        {markers.map((m, i) => {
          if (m.index < 0 || m.index >= xs.length) return null;
          const x = xs[m.index];
          const endIdx = Math.min(xs.length - 1, m.index + (m.windowPoints ?? 0));
          const x2 = xs[endIdx];
          return (
            <g key={i}>
              {m.windowPoints ? <rect x={x} y={PAD_TOP} width={Math.max(0, x2 - x)} height={baseline - PAD_TOP} className="fill-warn" fillOpacity={0.06} /> : null}
              <line x1={x} x2={x} y1={PAD_TOP - 6} y2={baseline} className="stroke-warn" strokeWidth={1} strokeDasharray="3 3" />
              <text x={x + 4} y={PAD_TOP - 8} className="fill-warn font-mono" fontSize={9}>
                {m.label}
              </text>
            </g>
          );
        })}

        {/* Seriler */}
        {series.map((s, i) => (
          <g key={s.name}>
            {i === 0 && <path d={areaPath(s.values, plotOpts)} className={fillClass[s.tone]} fillOpacity={0.09} />}
            <path d={linePath(s.values, plotOpts)} fill="none" className={strokeClass[s.tone]} strokeWidth={2} strokeDasharray={s.dashed ? "6 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />
            {s.values.length > 0 && (
              <circle
                cx={xs[s.values.length - 1]}
                cy={PAD_TOP + (height - PAD_TOP - PAD_BOTTOM) * (1 - Math.min(s.values[s.values.length - 1], max) / max)}
                r={3.5}
                className={fillClass[s.tone]}
              />
            )}
          </g>
        ))}

        {/* Hover kılavuzu */}
        {hoverX !== null && <line x1={hoverX} x2={hoverX} y1={PAD_TOP} y2={baseline} className="stroke-line-strong" strokeWidth={1} />}
        {hover !== null &&
          series.map((s) =>
            s.values[hover] === undefined ? null : (
              <circle
                key={s.name}
                cx={xs[hover]}
                cy={PAD_TOP + (height - PAD_TOP - PAD_BOTTOM) * (1 - Math.min(s.values[hover], max) / max)}
                r={4}
                className={cn(fillClass[s.tone], "stroke-surface")}
                strokeWidth={2}
              />
            )
          )}

        {/* x etiketleri (sıkışmayı önlemek için en fazla 8) */}
        {labels.map((l, i) => {
          const every = Math.ceil(labels.length / 8);
          if (i % every !== 0 && i !== labels.length - 1) return null;
          return (
            <text key={i} x={xs[i]} y={height - 8} textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"} className="fill-muted font-mono" fontSize={9}>
              {l}
            </text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hover !== null && hoverX !== null && (
        <div
          className="absolute top-2 pointer-events-none bg-surface border border-line rounded-sm shadow-pop px-2.5 py-1.5 text-xs whitespace-nowrap"
          style={{ left: `${(hoverX / W) * 100}%`, transform: hoverX > W * 0.7 ? "translateX(-110%)" : "translateX(10px)" }}
        >
          <div className="font-mono text-2xs text-muted">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.name} className="flex items-center justify-between gap-4">
              <span className={cn("font-medium", textClass[s.tone])}>{s.name}</span>
              <span className="font-mono tabular-nums text-ink">{s.values[hover] === undefined ? "—" : format(s.values[hover])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChartLegend({ items }: { items: Array<{ label: React.ReactNode; tone: "accent" | "evidence" | "warn"; dashed?: boolean }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted mt-2">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn("inline-block w-3.5 border-t-2", it.tone === "accent" ? "border-accent" : it.tone === "evidence" ? "border-evidence" : "border-warn", it.dashed && "border-dashed")}
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
