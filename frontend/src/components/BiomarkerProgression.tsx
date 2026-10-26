import type { DiagnoseSession } from "../state/types.ts";
import { chartTheme } from "../lib/chartTheme.ts";
import { Card, CardHeader } from "./ui/Card.tsx";
import { StatusBadge } from "./ui/StatusBadge.tsx";

type BiomarkerConfig = {
  key: string;
  label: string;
  unit: string;
  target: string;
  lowerIsBetter: boolean;
};

const HEART_BIOMARKERS: BiomarkerConfig[] = [
  { key: "trestbps", label: "Resting BP", unit: "mmHg", target: "< 120", lowerIsBetter: true },
  { key: "chol", label: "Cholesterol", unit: "mg/dL", target: "< 200", lowerIsBetter: true },
  { key: "thalach", label: "Max heart rate", unit: "bpm", target: "140–170", lowerIsBetter: false },
  { key: "oldpeak", label: "ST depression", unit: "mm", target: "< 1.0", lowerIsBetter: true },
];

const DIABETES_BIOMARKERS: BiomarkerConfig[] = [
  { key: "Glucose", label: "Glucose", unit: "mg/dL", target: "< 100", lowerIsBetter: true },
  { key: "BloodPressure", label: "Diastolic BP", unit: "mmHg", target: "< 80", lowerIsBetter: true },
  { key: "BMI", label: "BMI", unit: "kg/m²", target: "18.5–24.9", lowerIsBetter: true },
  { key: "Insulin", label: "Insulin", unit: "µU/mL", target: "16–166", lowerIsBetter: true },
];

export function BiomarkerProgression({ cases }: { cases: DiagnoseSession[] }) {
  if (cases.length === 0) return null;

  const sorted = [...cases].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const dataset = sorted[0].dataset;
  const biomarkers = dataset === "diabetes" ? DIABETES_BIOMARKERS : HEART_BIOMARKERS;

  return (
    <Card>
      <CardHeader
        title="Biomarker trajectories"
        description={`Directional change across ${sorted.length} ${sorted.length === 1 ? "encounter" : "encounters"}.`}
        badge={<StatusBadge tone="primary">{dataset === "heart" ? "Heart" : "Diabetes"}</StatusBadge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {biomarkers.map((b) => {
          const values = sorted.map((c) => c.features[b.key]).filter((v) => typeof v === "number");
          if (values.length === 0) return null;

          const baseline = values[0];
          const latest = values[values.length - 1];
          const delta = latest - baseline;
          const hasMultiple = values.length > 1;
          const isImprovement = b.lowerIsBetter ? delta < 0 : delta > 0;
          const isDeterioration = b.lowerIsBetter ? delta > 0 : delta < 0;

          const min = Math.min(...values);
          const max = Math.max(...values);
          const range = max - min || 1;
          const w = 110;
          const h = 32;

          const sparkPoints = values
            .map((v, i) => {
              const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * (w - 12) + 6;
              const y = h - 6 - ((v - min) / range) * (h - 12);
              return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");

          return (
            <div key={b.key} className="flex flex-col justify-between rounded-card border border-border bg-card p-4">
              <div>
                <div className="flex items-start justify-between gap-1">
                  <span className="text-xs font-medium text-muted">{b.label}</span>
                  <span className="text-[10px] text-muted">{b.target}</span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-2xl tabular-nums text-charcoal">
                    {Number.isInteger(latest) ? latest : latest.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted">{b.unit}</span>
                </div>
                {hasMultiple ? (
                  <div className="mt-1 flex items-center gap-1.5 text-xs">
                    <span className="text-muted">Start {baseline}</span>
                    <StatusBadge tone={isImprovement ? "success" : isDeterioration ? "danger" : "primary"}>
                      {delta > 0 ? `+${delta.toFixed(delta % 1 ? 1 : 0)}` : delta.toFixed(delta % 1 ? 1 : 0)}
                    </StatusBadge>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted">Baseline reading</p>
                )}
              </div>
              {hasMultiple ? (
                <div className="mt-3 border-t border-border pt-2">
                  <svg width={w} height={h} className="w-full overflow-visible">
                    <polyline
                      fill="none"
                      stroke={isImprovement ? chartTheme.primary : isDeterioration ? chartTheme.accent : chartTheme.tick}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={sparkPoints}
                    />
                    {values.map((v, i) => {
                      const x = (i / (values.length - 1)) * (w - 12) + 6;
                      const y = h - 6 - ((v - min) / range) * (h - 12);
                      return (
                        <circle
                          key={i}
                          cx={x}
                          cy={y}
                          r={i === values.length - 1 ? 3.5 : 2.5}
                          fill={i === values.length - 1 ? chartTheme.primary : chartTheme.tick}
                        />
                      );
                    })}
                  </svg>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
