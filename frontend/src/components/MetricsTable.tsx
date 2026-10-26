import { StatusBadge } from "./ui/StatusBadge.tsx";
import { cn } from "../lib/cn.ts";

export type MetricColumn = {
  key: string;
  label: string;
  format?: (value: unknown) => string;
};

type MetricsTableProps = {
  title: string;
  rows: Record<string, unknown>[];
  columns: MetricColumn[];
};

function defaultFormat(value: unknown): string {
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(3);
  }
  if (value === null || value === undefined) return "—";
  return String(value);
}

function bestRowIndex(rows: Record<string, unknown>[], columns: MetricColumn[]): number {
  const scoreKey =
    columns.find((column) => column.key === "roc_auc")?.key ??
    columns.find((column) => column.key === "f1")?.key ??
    columns.find((column) => column.key === "macro_f1")?.key ??
    columns.find((column) => column.key === "accuracy")?.key;
  if (!scoreKey) return -1;
  let best = -1;
  let bestValue = -Infinity;
  rows.forEach((row, index) => {
    const value = row[scoreKey];
    if (typeof value === "number" && value > bestValue) {
      bestValue = value;
      best = index;
    }
  });
  return best;
}

export function MetricsTable({ title, rows, columns }: MetricsTableProps) {
  const best = bestRowIndex(rows, columns);

  return (
    <section className="overflow-hidden rounded-card border border-border bg-card">
      <header className="border-b border-border px-4 py-3">
        <h3 className="font-display text-lg text-charcoal">{title}</h3>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-card text-muted">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  className={cn(
                    "border-b border-border px-4 py-2 font-medium",
                    index === 0 ? "text-left" : "text-right",
                  )}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-border transition-colors duration-200 hover:bg-ivory">
                {columns.map((column, colIndex) => (
                  <td
                    key={column.key}
                    className={cn(
                      "px-4 py-2 text-charcoal",
                      colIndex === 0 ? "text-left" : "text-right tabular-nums",
                    )}
                  >
                    <span className="inline-flex items-center gap-2">
                      {(column.format ?? defaultFormat)(row[column.key])}
                      {colIndex === 0 && index === best ? <StatusBadge tone="primary">Best</StatusBadge> : null}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
