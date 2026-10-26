import { useMemo, useState } from "react";
import { toDataUrl } from "../api/client.ts";
import { formatVisitDate } from "../lib/cases.ts";
import { fieldsFor } from "../lib/features.ts";
import type { DiagnoseSession } from "../state/types.ts";
import { HeatmapViewer } from "./HeatmapViewer.tsx";
import { RiskBadge } from "./RiskBadge.tsx";

type ScanComparisonProps = {
  cases: DiagnoseSession[];
  onOpenReport?: (session: DiagnoseSession) => void;
};

export function ScanComparison({ cases, onOpenReport }: ScanComparisonProps) {
  // Sort chronological
  const sorted = useMemo(
    () => [...cases].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [cases],
  );

  const [idA, setIdA] = useState(() => (sorted.length >= 2 ? sorted[0].id : sorted[0]?.id || ""));
  const [idB, setIdB] = useState(() =>
    sorted.length >= 2 ? sorted[sorted.length - 1].id : sorted[0]?.id || "",
  );

  const scanA = sorted.find((c) => c.id === idA) ?? sorted[0];
  const scanB = sorted.find((c) => c.id === idB) ?? sorted[sorted.length - 1];

  if (!scanA || !scanB) return null;

  const heatmapA = toDataUrl(scanA.image.gradcam_base64);
  const heatmapB = toDataUrl(scanB.image.gradcam_base64);

  const riskDelta = scanB.risk.risk_score - scanA.risk.risk_score;
  const riskDeltaPct = Math.round(riskDelta * 100);

  const fields = fieldsFor(scanB.dataset);

  return (
    <section className="space-y-6 rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h3 className="font-display text-2xl text-charcoal">
            Side-by-Side Scan & Clinical Comparison
          </h3>
          <p className="mt-1 text-sm text-muted">
            Compare baseline imaging and lab findings directly against subsequent follow-up scans.
          </p>
        </div>

        {/* Visit selector pickers */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-primary">Scan A (Baseline):</span>
            <select
              value={idA}
              onChange={(e) => setIdA(e.target.value)}
              className="rounded-xl border border-border bg-ivory px-3 py-1.5 text-xs font-medium text-charcoal outline-none focus:ring-2 focus:ring-primary"
            >
              {sorted.map((c, i) => (
                <option key={c.id} value={c.id}>
                  {c.visitLabel || `Visit ${i + 1}`} ({formatVisitDate(c.createdAt)})
                </option>
              ))}
            </select>
          </div>

          <span className="font-display text-muted text-lg">vs</span>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-accent">Scan B (Follow-up):</span>
            <select
              value={idB}
              onChange={(e) => setIdB(e.target.value)}
              className="rounded-xl border border-border bg-ivory px-3 py-1.5 text-xs font-medium text-charcoal outline-none focus:ring-2 focus:ring-primary"
            >
              {sorted.map((c, i) => (
                <option key={c.id} value={c.id}>
                  {c.visitLabel || `Visit ${i + 1}`} ({formatVisitDate(c.createdAt)})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Trajectory Delta Highlights Banner */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-ivory p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">
            Radiology Evolution
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${
                scanA.image.label === "PNEUMONIA" ? "bg-rose text-accent" : "bg-teal-tint text-primary"
              }`}
            >
              {scanA.image.label}
            </span>
            <span className="text-muted">➔</span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${
                scanB.image.label === "PNEUMONIA" ? "bg-rose text-accent" : "bg-teal-tint text-primary"
              }`}
            >
              {scanB.image.label}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {scanA.image.label !== scanB.image.label
              ? scanB.image.label === "NORMAL"
                ? "Significant resolution of pulmonary opacities"
                : "New infiltration detected"
              : "Stable imaging findings across visits"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-ivory p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">
            Clinical Risk Shift
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-lg text-charcoal">
              {Math.round(scanA.risk.risk_score * 100)}%
            </span>
            <span className="text-muted">➔</span>
            <span className="font-display text-lg text-charcoal">
              {Math.round(scanB.risk.risk_score * 100)}%
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                riskDelta < 0
                  ? "bg-risk-low/15 text-risk-low"
                  : riskDelta > 0
                    ? "bg-risk-high/15 text-risk-high"
                    : "bg-teal-tint text-primary"
              }`}
            >
              {riskDelta < 0 ? `↓ ${Math.abs(riskDeltaPct)}%` : riskDelta > 0 ? `↑ +${riskDeltaPct}%` : "0%"}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted">
            Level moved from <strong className="capitalize">{scanA.risk.level}</strong> to{" "}
            <strong className="capitalize">{scanB.risk.level}</strong>.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-ivory p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">
            Multi-modal Concordance
          </span>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                scanB.report.agreement ? "bg-teal-tint text-primary" : "bg-rose text-accent"
              }`}
            >
              {scanB.report.agreement ? "Modalities Agree" : "Modalities Diverge"}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted line-clamp-2">
            Current: {scanB.report.diagnosis}
          </p>
        </div>
      </div>

      {/* Side-by-side Scans with Grad-CAM */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Scan A */}
        <div className="rounded-2xl border border-primary/20 bg-card p-4 ring-1 ring-primary/10">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-ivory">
                Scan A
              </span>
              <h4 className="mt-1 font-display text-lg text-charcoal">
                {scanA.visitLabel || "Baseline"}
              </h4>
              <p className="text-xs text-muted">{formatVisitDate(scanA.createdAt)}</p>
            </div>
            <div className="text-right">
              <RiskBadge level={scanA.risk.level} score={scanA.risk.risk_score} />
              <p className="mt-1 text-xs text-muted">
                Confidence {(scanA.image.confidence * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="mt-4">
            <HeatmapViewer
              originalSrc={scanA.originalImageUrl}
              heatmapSrc={heatmapA}
              alt="Scan A Chest X-ray"
            />
          </div>

          <div className="mt-4 rounded-xl bg-ivory p-3 text-xs">
            <span className="font-semibold text-charcoal">Clinical Notes:</span>
            <p className="mt-1 text-muted italic">"{scanA.text}"</p>
          </div>

          {onOpenReport ? (
            <button
              type="button"
              onClick={() => onOpenReport(scanA)}
              className="mt-3 w-full rounded-xl border border-border bg-ivory py-2 text-xs font-medium text-primary hover:bg-teal-tint"
            >
              Open Full Scan A Report ➔
            </button>
          ) : null}
        </div>

        {/* Right Scan B */}
        <div className="rounded-2xl border border-accent/20 bg-card p-4 ring-1 ring-accent/10">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-ivory">
                Scan B
              </span>
              <h4 className="mt-1 font-display text-lg text-charcoal">
                {scanB.visitLabel || "Follow-up"}
              </h4>
              <p className="text-xs text-muted">{formatVisitDate(scanB.createdAt)}</p>
            </div>
            <div className="text-right">
              <RiskBadge level={scanB.risk.level} score={scanB.risk.risk_score} />
              <p className="mt-1 text-xs text-muted">
                Confidence {(scanB.image.confidence * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="mt-4">
            <HeatmapViewer
              originalSrc={scanB.originalImageUrl}
              heatmapSrc={heatmapB}
              alt="Scan B Chest X-ray"
            />
          </div>

          <div className="mt-4 rounded-xl bg-ivory p-3 text-xs">
            <span className="font-semibold text-charcoal">Clinical Notes:</span>
            <p className="mt-1 text-muted italic">"{scanB.text}"</p>
          </div>

          {onOpenReport ? (
            <button
              type="button"
              onClick={() => onOpenReport(scanB)}
              className="mt-3 w-full rounded-xl border border-border bg-ivory py-2 text-xs font-medium text-primary hover:bg-teal-tint"
            >
              Open Full Scan B Report ➔
            </button>
          ) : null}
        </div>
      </div>

      {/* Feature & Biomarker Comparison Table */}
      <div className="rounded-2xl border border-border bg-ivory p-4">
        <h4 className="font-display text-lg text-charcoal">
          Biomarker & Clinical Feature Delta Table
        </h4>
        <p className="mt-0.5 text-xs text-muted">
          Detailed numeric comparison between Scan A ({scanA.visitLabel}) and Scan B ({scanB.visitLabel}).
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 pr-4 font-semibold">Parameter</th>
                <th className="py-2 px-4 font-semibold">Scan A ({scanA.visitLabel})</th>
                <th className="py-2 px-4 font-semibold">Scan B ({scanB.visitLabel})</th>
                <th className="py-2 pl-4 font-semibold text-right">Net Change (Δ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {fields.map((f) => {
                const valA = scanA.features[f.name];
                const valB = scanB.features[f.name];
                if (typeof valA !== "number" || typeof valB !== "number") return null;

                const delta = valB - valA;
                const hasChanged = delta !== 0;

                return (
                  <tr key={f.name} className="hover:bg-card/50">
                    <td className="py-2.5 pr-4">
                      <span className="font-medium text-charcoal">{f.label}</span>
                      <span className="ml-1.5 text-[11px] text-muted">({f.hint})</span>
                    </td>
                    <td className="py-2.5 px-4 font-display text-sm text-charcoal">
                      {f.options
                        ? f.options.find((o) => o.value === valA)?.label || valA
                        : valA}
                    </td>
                    <td className="py-2.5 px-4 font-display text-sm text-charcoal">
                      {f.options
                        ? f.options.find((o) => o.value === valB)?.label || valB
                        : valB}
                    </td>
                    <td className="py-2.5 pl-4 text-right">
                      {hasChanged ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            delta < 0
                              ? "bg-risk-low/15 text-risk-low"
                              : "bg-risk-high/15 text-risk-high"
                          }`}
                        >
                          {delta > 0 ? `+${delta.toFixed(delta % 1 ? 1 : 0)}` : delta.toFixed(delta % 1 ? 1 : 0)}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
