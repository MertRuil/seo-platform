"use client";

import React from "react";
import { cn } from "@/lib/cn";
import { useDensity } from "@/context/DensityContext";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: "left" | "center" | "right";
  /** Yalnızca Uzman yoğunluğunda görünür */
  expertOnly?: boolean;
  className?: string;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  /** Ekran okuyucu için tablo açıklaması; görsel olarak gizli */
  caption: string;
  empty?: React.ReactNode;
  className?: string;
}

/** Yoğunluğa duyarlı tablo: Uzman modunda ek kolonlar açılır; her tablo kendi yatay kaydırma kabında. */
export function DataTable<T>({ columns, rows, rowKey, caption, empty, className }: DataTableProps<T>) {
  const { density } = useDensity();
  const visible = columns.filter((c) => !c.expertOnly || density === "expert");

  return (
    <div className={cn("overflow-x-auto custom-scrollbar", className)}>
      <table className="w-full text-left text-sm text-ink border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-surface-2 border-b border-line">
            {visible.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={c.width ? { width: c.width } : undefined}
                className={cn(
                  "px-4 py-2.5 text-2xs font-semibold uppercase tracking-wider text-muted whitespace-nowrap",
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center"
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={visible.length} className="px-4 py-10 text-center text-sm text-muted">
                {empty ?? "Kayıt yok."}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={rowKey(row, i)} className="hover:bg-surface-2 transition-colors">
                {visible.map((c) => (
                  <td
                    key={c.key}
                    className={cn("px-4 py-3 align-middle", c.align === "right" && "text-right tabular-nums", c.align === "center" && "text-center", c.className)}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
