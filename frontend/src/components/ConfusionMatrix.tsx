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
};

function toGrid(matrix: number[][] | BinaryConfusion): number[][] {
  if (Array.isArray(matrix)) return matrix;
  return [
    [matrix.tn, matrix.fp],
    [matrix.fn, matrix.tp],
  ];
}

function isBinary(value: number[][] | BinaryConfusion): value is BinaryConfusion {
  return !Array.isArray(value);
}

export function ConfusionMatrix({ title, labels, matrix }: ConfusionMatrixProps) {
  const grid = toGrid(matrix);
  const max = Math.max(1, ...grid.flat());
  const rowLabels = labels ?? (grid.length === 2 ? ["Negative", "Positive"] : grid.map((_, i) => String(i)));
  const colLabels = rowLabels;
  const compact = grid.length > 8;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="font-display text-lg text-charcoal">{title}</h3>
      {isBinary(matrix) ? (
        <p className="mt-1 text-sm text-muted">
          TN {matrix.tn} · FP {matrix.fp} · FN {matrix.fn} · TP {matrix.tp}
        </p>
      ) : null}
      <div className="mt-3 overflow-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="p-1 text-xs font-medium text-muted">actual \ pred</th>
              {colLabels.map((label) => (
                <th
                  key={label}
                  className={`p-1 text-xs font-medium text-muted ${compact ? "max-w-6 truncate" : ""}`}
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
                  className={`p-1 text-left text-xs font-medium text-muted ${compact ? "max-w-16 truncate" : ""}`}
                  title={rowLabels[r]}
                >
                  {compact ? (rowLabels[r] ?? "").slice(0, 8) : rowLabels[r]}
                </th>
                {row.map((value, c) => {
                  const intensity = value / max;
                  const background = `rgba(15, 95, 92, ${0.08 + intensity * 0.55})`;
                  return (
                    <td
                      key={`${r}-${c}`}
                      className={`text-center ${compact ? "h-5 w-5 text-[9px]" : "h-10 w-10 text-xs"}`}
                      style={{ backgroundColor: background, color: intensity > 0.65 ? "#FBF6EF" : "#2B2724" }}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
