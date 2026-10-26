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

export function MetricsTable({ title, rows, columns }: MetricsTableProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="border-b border-border px-4 py-3">
        <h3 className="font-display text-lg text-charcoal">{title}</h3>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ivory text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-2 font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-2 text-charcoal">
                    {(column.format ?? defaultFormat)(row[column.key])}
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
