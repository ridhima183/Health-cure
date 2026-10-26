import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

  const height = Math.max(240, data.length * 36);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
          <CartesianGrid stroke="#E8DFD3" strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fill: "#6F645C", fontSize: 12 }} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fill: "#2B2724", fontSize: 12 }} />
          <Tooltip
            formatter={(value) => (typeof value === "number" ? value.toFixed(4) : String(value ?? ""))}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.value >= 0 ? "#0F5F5C" : "#C2603E"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
