import { useState } from "react";
import type { DiagnoseSession } from "../state/types.ts";
import { formatVisitDate } from "../lib/cases.ts";

type RiskProgressionChartProps = {
  cases: DiagnoseSession[];
  selectedCaseId?: string;
  onSelectCase?: (id: string) => void;
};

export function RiskProgressionChart({
  cases,
  selectedCaseId,
  onSelectCase,
}: RiskProgressionChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (cases.length === 0) return null;

  // Ensure chronological order
  const sorted = [...cases].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const points = sorted.map((c, i) => ({
    session: c,
    index: i,
    label: c.visitLabel || `Visit ${i + 1}`,
    score: c.risk.risk_score,
    level: c.risk.level,
    date: formatVisitDate(c.createdAt),
    diagnosis: c.report.diagnosis,
  }));

  const earliest = points[0];
  const latest = points[points.length - 1];
  const delta = latest.score - earliest.score;
  const deltaPercent = Math.round(delta * 100);

  // SVG dimensions
  const width = 640;
  const height = 240;
  const padding = { top: 30, right: 35, bottom: 45, left: 55 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Coordinates mapping
  const getX = (idx: number) => {
    if (points.length <= 1) return padding.left + chartW / 2;
    return padding.left + (idx / (points.length - 1)) * chartW;
  };

  const getY = (score: number) => {
    // 0 is bottom (padding.top + chartH), 1 is top (padding.top)
    const clamped = Math.max(0, Math.min(1, score));
    return padding.top + chartH - clamped * chartH;
  };

  // Build SVG path
  const pathD = points
    .map((pt, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(pt.score).toFixed(1)}`)
    .join(" ");

  const areaD =
    points.length > 1
      ? `${pathD} L ${getX(points.length - 1).toFixed(1)} ${(padding.top + chartH).toFixed(
          1,
        )} L ${getX(0).toFixed(1)} ${(padding.top + chartH).toFixed(1)} Z`
      : "";

  const activeIdx = hoveredIdx !== null ? hoveredIdx : points.findIndex((p) => p.session.id === selectedCaseId);
  const activePoint = activeIdx >= 0 ? points[activeIdx] : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-xl text-charcoal">Cardiovascular & Metabolic Risk Trajectory</h3>
          <p className="mt-0.5 text-xs text-muted">
            Track tabulated risk progression over clinical encounters (0% to 100%).
          </p>
        </div>
        <div className="flex items-center gap-2">
          {points.length > 1 ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                delta < 0
                  ? "bg-risk-low/15 text-risk-low ring-1 ring-risk-low/30"
                  : delta > 0
                    ? "bg-risk-high/15 text-risk-high ring-1 ring-risk-high/30"
                    : "bg-teal-tint text-primary"
              }`}
            >
              {delta < 0 ? `↓ ${Math.abs(deltaPercent)}% Net Improvement` : delta > 0 ? `↑ +${deltaPercent}% Risk Increase` : "Stable Risk"}
            </span>
          ) : (
            <span className="rounded-full bg-teal-tint px-3 py-1 text-xs font-medium text-primary">
              Baseline Scan
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 relative overflow-hidden rounded-xl border border-border bg-ivory/50">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none overflow-visible"
        >
          <defs>
            <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f5f5c" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#0f5f5c" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#c2603e" />
              <stop offset="100%" stopColor="#0f5f5c" />
            </linearGradient>
          </defs>

          {/* Risk threshold background zones */}
          {/* High risk zone (70% - 100%) */}
          <rect
            x={padding.left}
            y={getY(1.0)}
            width={chartW}
            height={getY(0.7) - getY(1.0)}
            fill="#7a2e3a"
            fillOpacity="0.06"
          />
          {/* Moderate risk zone (40% - 70%) */}
          <rect
            x={padding.left}
            y={getY(0.7)}
            width={chartW}
            height={getY(0.4) - getY(0.7)}
            fill="#e0a93b"
            fillOpacity="0.06"
          />
          {/* Low risk zone (0% - 40%) */}
          <rect
            x={padding.left}
            y={getY(0.4)}
            width={chartW}
            height={getY(0.0) - getY(0.4)}
            fill="#5e8c6a"
            fillOpacity="0.06"
          />

          {/* Grid lines & Y-axis labels */}
          {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((level) => {
            const y = getY(level);
            return (
              <g key={level}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartW}
                  y2={y}
                  stroke="#e8dfd3"
                  strokeDasharray={level === 0 || level === 1 ? undefined : "3 3"}
                  strokeWidth={1}
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted font-sans text-[10px]"
                >
                  {Math.round(level * 100)}%
                </text>
              </g>
            );
          })}

          {/* Risk Level Zone Labels on Right */}
          <text
            x={padding.left + chartW - 6}
            y={getY(0.85)}
            textAnchor="end"
            className="fill-risk-high text-[9px] font-semibold uppercase tracking-wider"
            opacity="0.7"
          >
            High Risk (&gt;70%)
          </text>
          <text
            x={padding.left + chartW - 6}
            y={getY(0.55)}
            textAnchor="end"
            className="fill-charcoal text-[9px] font-semibold uppercase tracking-wider"
            opacity="0.6"
          >
            Moderate (40–70%)
          </text>
          <text
            x={padding.left + chartW - 6}
            y={getY(0.2)}
            textAnchor="end"
            className="fill-risk-low text-[9px] font-semibold uppercase tracking-wider"
            opacity="0.7"
          >
            Low Risk (&lt;40%)
          </text>

          {/* Area fill */}
          {areaD ? <path d={areaD} fill="url(#riskGrad)" /> : null}

          {/* Progression Line */}
          {points.length > 1 ? (
            <path
              d={pathD}
              fill="none"
              stroke="#0f5f5c"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {/* Data Points */}
          {points.map((pt) => {
            const cx = getX(pt.index);
            const cy = getY(pt.score);
            const isSelected = selectedCaseId === pt.session.id;
            const isHovered = hoveredIdx === pt.index;

            return (
              <g
                key={pt.session.id}
                className="cursor-pointer transition-transform"
                onClick={() => onSelectCase?.(pt.session.id)}
                onMouseEnter={() => setHoveredIdx(pt.index)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                {/* Hit area */}
                <circle cx={cx} cy={cy} r={16} fill="transparent" />

                {/* Outer highlight ring on hover/select */}
                {(isSelected || isHovered) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={10}
                    fill="none"
                    stroke="#0f5f5c"
                    strokeWidth={2}
                    opacity="0.4"
                  />
                )}

                {/* Data point circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected || isHovered ? 6 : 4.5}
                  fill={pt.score >= 0.7 ? "#7a2e3a" : pt.score >= 0.4 ? "#e0a93b" : "#0f5f5c"}
                  stroke="#ffffff"
                  strokeWidth={2}
                />

                {/* X-axis label */}
                <text
                  x={cx}
                  y={height - 24}
                  textAnchor="middle"
                  className={`font-sans text-[11px] ${
                    isSelected ? "font-bold fill-primary" : "fill-charcoal"
                  }`}
                >
                  {pt.label}
                </text>
                <text
                  x={cx}
                  y={height - 10}
                  textAnchor="middle"
                  className="font-sans text-[9px] fill-muted"
                >
                  {pt.date}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip if active */}
        {activePoint ? (
          <div className="border-t border-border bg-card/90 px-4 py-2.5 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-charcoal">{activePoint.label}:</span>
              <span className="font-medium text-primary">{activePoint.diagnosis}</span>
              <span className="text-muted">({activePoint.date})</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-muted">
                Tabular Risk:{" "}
                <strong className="text-charcoal font-display text-sm">
                  {Math.round(activePoint.score * 100)}%
                </strong>{" "}
                ({activePoint.level})
              </span>
              <span className="text-muted">
                X-Ray:{" "}
                <strong className="text-charcoal font-display text-sm">
                  {activePoint.session.image.label}
                </strong>
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
