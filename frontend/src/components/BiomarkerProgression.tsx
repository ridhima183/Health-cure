import type { DiagnoseSession } from "../state/types.ts";

type BiomarkerConfig = {
  key: string;
  label: string;
  unit: string;
  target: string;
  lowerIsBetter: boolean;
};

const HEART_BIOMARKERS: BiomarkerConfig[] = [
  { key: "trestbps", label: "Resting Blood Pressure", unit: "mmHg", target: "< 120", lowerIsBetter: true },
  { key: "chol", label: "Serum Cholesterol", unit: "mg/dL", target: "< 200", lowerIsBetter: true },
  { key: "thalach", label: "Max Heart Rate", unit: "bpm", target: "140–170", lowerIsBetter: false },
  { key: "oldpeak", label: "ST Depression", unit: "mm", target: "< 1.0", lowerIsBetter: true },
];

const DIABETES_BIOMARKERS: BiomarkerConfig[] = [
  { key: "Glucose", label: "Fasting Glucose", unit: "mg/dL", target: "< 100", lowerIsBetter: true },
  { key: "BloodPressure", label: "Diastolic BP", unit: "mmHg", target: "< 80", lowerIsBetter: true },
  { key: "BMI", label: "Body Mass Index", unit: "kg/m²", target: "18.5–24.9", lowerIsBetter: true },
  { key: "Insulin", label: "Serum Insulin", unit: "µU/mL", target: "16–166", lowerIsBetter: true },
];

export function BiomarkerProgression({ cases }: { cases: DiagnoseSession[] }) {
  if (cases.length === 0) return null;

  // Chronological
  const sorted = [...cases].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const dataset = sorted[0].dataset;
  const biomarkers = dataset === "diabetes" ? DIABETES_BIOMARKERS : HEART_BIOMARKERS;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-xl text-charcoal">Biomarker Trajectories & Clinical Vitals</h3>
          <p className="mt-0.5 text-xs text-muted">
            Directional changes across {sorted.length} recorded {sorted.length === 1 ? "encounter" : "encounters"}.
          </p>
        </div>
        <span className="rounded-full bg-teal-tint px-3 py-1 text-xs font-semibold text-primary capitalize">
          {dataset} Panel
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {biomarkers.map((b) => {
          const values = sorted.map((c) => c.features[b.key]).filter((v) => typeof v === "number");
          if (values.length === 0) return null;

          const baseline = values[0];
          const latest = values[values.length - 1];
          const delta = latest - baseline;
          const hasMultiple = values.length > 1;

          const isImprovement = b.lowerIsBetter ? delta < 0 : delta > 0;
          const isDeterioration = b.lowerIsBetter ? delta > 0 : delta < 0;

          // Mini sparkline SVG
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
            <div
              key={b.key}
              className="flex flex-col justify-between rounded-xl border border-border bg-ivory p-4 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-1">
                  <span className="text-xs font-medium text-muted">{b.label}</span>
                  <span className="rounded bg-card px-1.5 py-0.5 text-[10px] text-muted ring-1 ring-border">
                    {b.target}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-2xl text-charcoal">
                    {Number.isInteger(latest) ? latest : latest.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted">{b.unit}</span>
                </div>

                {hasMultiple ? (
                  <div className="mt-1 flex items-center gap-1.5 text-xs">
                    <span className="text-muted">Start: {baseline}</span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isImprovement
                          ? "bg-risk-low/15 text-risk-low"
                          : isDeterioration
                            ? "bg-risk-high/15 text-risk-high"
                            : "bg-teal-tint text-primary"
                      }`}
                    >
                      {delta > 0 ? `+${delta.toFixed(delta % 1 ? 1 : 0)}` : delta.toFixed(delta % 1 ? 1 : 0)}
                    </span>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted">Baseline reading</p>
                )}
              </div>

              {/* Sparkline */}
              {hasMultiple ? (
                <div className="mt-3 pt-2 border-t border-border/60">
                  <svg width={w} height={h} className="w-full overflow-visible">
                    <polyline
                      fill="none"
                      stroke={isImprovement ? "#0f5f5c" : isDeterioration ? "#c2603e" : "#6f645c"}
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
                          fill={i === values.length - 1 ? "#0f5f5c" : "#6f645c"}
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
    </section>
  );
}
