import { useMemo, useState } from "react";

import { toDataUrl } from "../api/client.ts";
import { formatVisitDate } from "../lib/cases.ts";
import { cn } from "../lib/cn.ts";
import { fieldsFor } from "../lib/features.ts";
import type { DiagnoseSession } from "../state/types.ts";
import { HeatmapViewer } from "./HeatmapViewer.tsx";
import { RiskBadge } from "./RiskBadge.tsx";
import { Button } from "./ui/Button.tsx";
import { Card, CardHeader } from "./ui/Card.tsx";
import { controlClass } from "./ui/Field.tsx";
import { StatusBadge } from "./ui/StatusBadge.tsx";

type ScanComparisonProps = {
  cases: DiagnoseSession[];
  onOpenReport?: (session: DiagnoseSession) => void;
};

export function ScanComparison({ cases, onOpenReport }: ScanComparisonProps) {
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
    <Card className="space-y-6">
      <CardHeader
        title="Scan comparison"
        description="Baseline imaging and labs against a later visit."
        action={
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Scan A</span>
              <select value={idA} onChange={(e) => setIdA(e.target.value)} className={cn(controlClass, "w-52")}>
                {sorted.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    {c.visitLabel || `Visit ${i + 1}`} ({formatVisitDate(c.createdAt)})
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">Scan B</span>
              <select value={idB} onChange={(e) => setIdB(e.target.value)} className={cn(controlClass, "w-52")}>
                {sorted.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    {c.visitLabel || `Visit ${i + 1}`} ({formatVisitDate(c.createdAt)})
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-card border border-border p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Imaging</span>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge tone={scanA.image.label === "PNEUMONIA" ? "danger" : "success"}>{scanA.image.label}</StatusBadge>
            <span className="text-muted">→</span>
            <StatusBadge tone={scanB.image.label === "PNEUMONIA" ? "danger" : "success"}>{scanB.image.label}</StatusBadge>
          </div>
        </div>
        <div className="rounded-card border border-border p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Risk</span>
          <div className="mt-2 flex items-baseline gap-2 tabular-nums">
            <span className="font-display text-lg text-charcoal">{Math.round(scanA.risk.risk_score * 100)}%</span>
            <span className="text-muted">→</span>
            <span className="font-display text-lg text-charcoal">{Math.round(scanB.risk.risk_score * 100)}%</span>
            <StatusBadge tone={riskDelta < 0 ? "success" : riskDelta > 0 ? "danger" : "primary"}>
              {riskDelta < 0 ? `↓ ${Math.abs(riskDeltaPct)}%` : riskDelta > 0 ? `↑ +${riskDeltaPct}%` : "0%"}
            </StatusBadge>
          </div>
        </div>
        <div className="rounded-card border border-border p-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Concordance</span>
          <div className="mt-2">
            <StatusBadge tone={scanB.report.agreement ? "success" : "danger"}>
              {scanB.report.agreement ? "Modalities agree" : "Modalities diverge"}
            </StatusBadge>
          </div>
          <p className="mt-1.5 line-clamp-2 text-xs text-muted">{scanB.report.diagnosis}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {[
          { scan: scanA, heatmap: heatmapA, title: "Scan A", subtitle: scanA.visitLabel || "Baseline" },
          { scan: scanB, heatmap: heatmapB, title: "Scan B", subtitle: scanB.visitLabel || "Follow-up" },
        ].map(({ scan, heatmap, title, subtitle }) => (
          <div key={scan.id} className="rounded-card border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <StatusBadge>{title}</StatusBadge>
                <h4 className="mt-1 font-display text-lg text-charcoal">{subtitle}</h4>
                <p className="text-xs text-muted">{formatVisitDate(scan.createdAt)}</p>
              </div>
              <div className="text-right">
                <RiskBadge level={scan.risk.level} score={scan.risk.risk_score} />
                <p className="mt-1 text-xs text-muted">Confidence {(scan.image.confidence * 100).toFixed(1)}%</p>
              </div>
            </div>
            <HeatmapViewer originalSrc={scan.originalImageUrl} heatmapSrc={heatmap} alt={`${title} chest X-ray`} />
            <p className="mt-4 text-xs text-muted">{scan.text}</p>
            {onOpenReport ? (
              <Button className="mt-3 w-full" variant="ghost" onClick={() => onOpenReport(scan)}>
                Open report
              </Button>
            ) : null}
          </div>
        ))}
      </div>

      <div>
        <h4 className="font-display text-lg text-charcoal">Feature delta</h4>
        <p className="mt-0.5 text-xs text-muted">
          {scanA.visitLabel} vs {scanB.visitLabel}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-card text-muted">
              <tr>
                <th className="border-b border-border py-2 pr-4 font-medium">Parameter</th>
                <th className="border-b border-border px-4 py-2 text-right font-medium">Scan A</th>
                <th className="border-b border-border px-4 py-2 text-right font-medium">Scan B</th>
                <th className="border-b border-border py-2 pl-4 text-right font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => {
                const valA = scanA.features[f.name];
                const valB = scanB.features[f.name];
                if (typeof valA !== "number" || typeof valB !== "number") return null;
                const delta = valB - valA;
                return (
                  <tr key={f.name} className="border-t border-border hover:bg-ivory">
                    <td className="py-2 pr-4">
                      <span className="font-medium text-charcoal">{f.label}</span>
                      {f.unit ? <span className="ml-1.5 text-xs text-muted">{f.unit}</span> : null}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-charcoal">
                      {f.options ? f.options.find((o) => o.value === valA)?.label || valA : valA}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-charcoal">
                      {f.options ? f.options.find((o) => o.value === valB)?.label || valB : valB}
                    </td>
                    <td className="py-2 pl-4 text-right">
                      {delta !== 0 ? (
                        <StatusBadge tone={delta < 0 ? "success" : "danger"}>
                          {delta > 0 ? `+${delta.toFixed(delta % 1 ? 1 : 0)}` : delta.toFixed(delta % 1 ? 1 : 0)}
                        </StatusBadge>
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
    </Card>
  );
}
