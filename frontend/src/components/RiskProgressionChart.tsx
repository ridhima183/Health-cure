import { useState } from "react";

import type { DiagnoseSession } from "../state/types.ts";
import { formatVisitDate } from "../lib/cases.ts";
import { chartTheme } from "../lib/chartTheme.ts";
import { Card, CardHeader } from "./ui/Card.tsx";
import { StatusBadge } from "./ui/StatusBadge.tsx";

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

  const width = 640;
  const height = 240;
  const padding = { top: 30, right: 35, bottom: 45, left: 55 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const getX = (idx: number) => {
    if (points.length <= 1) return padding.left + chartW / 2;
    return padding.left + (idx / (points.length - 1)) * chartW;
  };

  const getY = (score: number) => {
    const clamped = Math.max(0, Math.min(1, score));
    return padding.top + chartH - clamped * chartH;
  };

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

  const deltaTone = delta < 0 ? "success" : delta > 0 ? "danger" : "primary";
  const deltaLabel =
    delta < 0 ? `${Math.abs(deltaPercent)}% improvement` : delta > 0 ? `+${deltaPercent}% risk` : "Stable";

  return (
    <Card>
      <CardHeader
        title="Risk trajectory"
        description="Tabulated risk from 0% to 100% across encounters."
        badge={<StatusBadge tone={points.length > 1 ? deltaTone : "primary"}>{deltaLabel}</StatusBadge>}
      />

      <div className="relative overflow-hidden rounded-card bg-card">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-60 w-full select-none">
          <defs>
            <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartTheme.primary} stopOpacity="0.2" />
              <stop offset="100%" stopColor={chartTheme.primary} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((level) => {
            const y = getY(level);
            return (
              <g key={level}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartW}
                  y2={y}
                  stroke={chartTheme.grid}
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

          {areaD ? <path d={areaD} fill="url(#riskGrad)" /> : null}

          {points.length > 1 ? (
            <path
              d={pathD}
              fill="none"
              stroke={chartTheme.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {points.map((pt) => {
            const cx = getX(pt.index);
            const cy = getY(pt.score);
            const isSelected = selectedCaseId === pt.session.id;
            const isHovered = hoveredIdx === pt.index;
            const fill =
              pt.score >= 0.7 ? chartTheme.riskHigh : pt.score >= 0.4 ? chartTheme.riskMid : chartTheme.primary;

            return (
              <g
                key={pt.session.id}
                className="cursor-pointer"
                onClick={() => onSelectCase?.(pt.session.id)}
                onMouseEnter={() => setHoveredIdx(pt.index)}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <circle cx={cx} cy={cy} r={16} fill="transparent" />
                {(isSelected || isHovered) && (
                  <circle cx={cx} cy={cy} r={10} fill="none" stroke={chartTheme.primary} strokeWidth={2} opacity="0.4" />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected || isHovered ? 6 : 4.5}
                  fill={fill}
                  stroke={chartTheme.card}
                  strokeWidth={2}
                />
                <text
                  x={cx}
                  y={height - 24}
                  textAnchor="middle"
                  className={`font-sans text-[11px] ${isSelected ? "fill-primary font-medium" : "fill-charcoal"}`}
                >
                  {pt.label}
                </text>
                <text x={cx} y={height - 10} textAnchor="middle" className="fill-muted font-sans text-[9px]">
                  {pt.date}
                </text>
              </g>
            );
          })}
        </svg>

        {activePoint ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-4 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-charcoal">{activePoint.label}</span>
              <span className="text-muted">{activePoint.diagnosis}</span>
              <span className="text-muted">{activePoint.date}</span>
            </div>
            <div className="flex items-center gap-3 tabular-nums">
              <span className="text-muted">
                Risk <strong className="font-medium text-charcoal">{Math.round(activePoint.score * 100)}%</strong>
              </span>
              <span className="text-muted">
                X-ray <strong className="font-medium text-charcoal">{activePoint.session.image.label}</strong>
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
