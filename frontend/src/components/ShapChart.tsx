import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { chartTheme, chartTooltipStyle } from "../lib/chartTheme.ts";

type ShapChartProps = {
  contributions: Record<string, number>;
};

export function ShapChart({ contributions }: ShapChartProps) {
  const data = Object.entries(contributions)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  if (data.length === 0) {
    return <p className="text-sm text-muted">No SHAP contributions returned.</p>;
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis type="number" tick={{ fill: chartTheme.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={112}
            tick={{ fill: chartTheme.ink, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--color-ivory)" }}
            contentStyle={chartTooltipStyle}
            formatter={(value) => (typeof value === "number" ? value.toFixed(4) : String(value ?? ""))}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.value >= 0 ? chartTheme.primary : chartTheme.accent} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
