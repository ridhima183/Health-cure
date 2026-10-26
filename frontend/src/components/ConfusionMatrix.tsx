import { cn } from "../lib/cn.ts";

export type BinaryConfusion = {
  tn: number;
  fp: number;
  fn: number;
  tp: number;
};

type ConfusionMatrixProps = {
  title: string;
  labels?: string[];
  matrix: number[][] | BinaryConfusion;
  scaleMax?: number;
};

function toGrid(matrix: number[][] | BinaryConfusion): number[][] {
  if (Array.isArray(matrix)) return matrix;
  return [
    [matrix.tn, matrix.fp],
    [matrix.fn, matrix.tp],
  ];
}

export function matrixMax(matrix: number[][] | BinaryConfusion | undefined): number {
  if (!matrix) return 0;
  return Math.max(0, ...toGrid(matrix).flat());
}

const FILLS = [
  "bg-primary/5 text-charcoal",
  "bg-primary/15 text-charcoal",
  "bg-primary/25 text-charcoal",
  "bg-primary/40 text-charcoal",
  "bg-primary/60 text-ivory",
  "bg-primary/80 text-ivory",
];

function fillFor(value: number, max: number): string {
  if (max <= 0 || value <= 0) return FILLS[0];
  const index = Math.min(FILLS.length - 1, Math.round((value / max) * (FILLS.length - 1)));
  return FILLS[index];
}

export function ConfusionMatrix({ title, labels, matrix, scaleMax }: ConfusionMatrixProps) {
  const grid = toGrid(matrix);
  const max = Math.max(1, scaleMax ?? Math.max(1, ...grid.flat()));
  const total = Math.max(1, grid.flat().reduce((sum, value) => sum + value, 0));
  const rowLabels = labels ?? (grid.length === 2 ? ["Negative", "Positive"] : grid.map((_, i) => String(i)));
  const colLabels = rowLabels;
  const compact = grid.length > 8;
  const cell = compact ? "size-10 text-[10px]" : "size-16 text-xs";

  return (
    <section className="rounded-card border border-border bg-card p-4">
      <h3 className="font-display text-lg text-charcoal">{title}</h3>
      <div className="mt-3 overflow-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="p-1 text-left text-xs font-medium text-muted">
                Actual \ predicted
              </th>
              {colLabels.map((label) => (
                <th
                  key={label}
                  className={cn("p-1 text-center text-xs font-medium text-muted", compact && "max-w-10 truncate")}
                  title={label}
                >
                  {compact ? label.slice(0, 3) : label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => (
              <tr key={rowLabels[r] ?? r}>
                <th
                  className={cn("p-1 text-left text-xs font-medium text-muted", compact && "max-w-16 truncate")}
                  title={rowLabels[r]}
                >
                  {compact ? (rowLabels[r] ?? "").slice(0, 8) : rowLabels[r]}
                </th>
                {row.map((value, c) => (
                  <td key={`${r}-${c}`} className="p-0.5">
                    <div
                      className={cn(
                        "flex flex-col items-center justify-center rounded-sm tabular-nums",
                        cell,
                        fillFor(value, max),
                      )}
                    >
                      <span className="font-medium">{value}</span>
                      <span className="opacity-80">{Math.round((value / total) * 100)}%</span>
                    </div>
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
