import type { RiskLevel } from "../api/client.ts";

const STYLES: Record<RiskLevel, { className: string; label: string }> = {
  low: { className: "bg-risk-low/15 text-risk-low ring-risk-low/30", label: "Low risk" },
  moderate: { className: "bg-risk-mid/20 text-charcoal ring-risk-mid/40", label: "Moderate risk" },
  high: { className: "bg-risk-high/15 text-risk-high ring-risk-high/30", label: "High risk" },
};

export function RiskBadge({ level, score }: { level: RiskLevel; score?: number }) {
  const style = STYLES[level];
  const scoreLabel =
    typeof score === "number" ? ` · ${(score * 100).toFixed(0)}%` : "";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ${style.className}`}
    >
      {style.label}
      {scoreLabel}
    </span>
  );
}
