import { useState } from "react";
import { Link } from "react-router-dom";

import { toDataUrl } from "../api/client.ts";
import { HeatmapViewer } from "../components/HeatmapViewer.tsx";
import { RiskBadge } from "../components/RiskBadge.tsx";
import { ShapChart } from "../components/ShapChart.tsx";
import { WordHighlight } from "../components/WordHighlight.tsx";
import { formatCaseTime } from "../lib/cases.ts";
import { exportReportPdf } from "../lib/exportPdf.ts";
import { useSession } from "../state/SessionContext.tsx";

function Badge({ children, tone = "teal" }: { children: string; tone?: "teal" | "rose" | "ivory" }) {
  const tones = {
    teal: "bg-teal-tint text-primary",
    rose: "bg-rose text-accent",
    ivory: "bg-ivory text-muted ring-1 ring-border",
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${tones[tone]}`}>{children}</span>
  );
}

export function ReportPage() {
  const { session } = useSession();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  if (!session) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8">
        <h1 className="font-display text-4xl">Report</h1>
        <p className="mt-3 text-muted">Run an analysis first to see badges, explanations, and next steps.</p>
        <Link to="/" className="mt-6 inline-block rounded-full bg-primary px-5 py-2 text-ivory">
          Go to Diagnose
        </Link>
      </div>
    );
  }

  const { report, image, textPrediction, risk, originalImageUrl, text } = session;
  const heatmapSrc = toDataUrl(image.gradcam_base64);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-charcoal">Report</h1>
          <p className="mt-2 font-display text-2xl">{report.diagnosis}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="font-semibold text-charcoal">
              Patient: {session.patientId || "PT-1001"}
            </span>
            <span className="rounded-full bg-teal-tint px-2.5 py-0.5 text-xs font-medium text-primary">
              {session.visitLabel || "Baseline (Week 0)"}
            </span>
            <span>·</span>
            <span className="font-medium text-primary">{session.id}</span>
            <span>·</span>
            <span>{formatCaseTime(session.createdAt)}</span>
          </div>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Link
            to={`/history?patientId=${encodeURIComponent(session.patientId || "")}`}
            className="rounded-full border border-primary/30 bg-card px-4 py-2 text-sm font-medium text-primary hover:bg-teal-tint"
          >
            Longitudinal Timeline ➔
          </Link>
          <button
            type="button"
            disabled={pdfBusy}
            onClick={async () => {
              setPdfError(null);
              setPdfBusy(true);
              try {
                await exportReportPdf(session);
              } catch (error) {
                setPdfError(error instanceof Error ? error.message : "Could not export PDF.");
              } finally {
                setPdfBusy(false);
              }
            }}
            className="rounded-full bg-primary px-4 py-2 text-sm text-ivory disabled:opacity-60"
          >
            {pdfBusy ? "Preparing PDF…" : "Export PDF"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm"
          >
            Print
          </button>
        </div>
      </div>
      {pdfError ? (
        <p className="rounded-xl border border-rose bg-rose/60 px-4 py-3 text-sm text-risk-high" role="alert">
          {pdfError}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Badge>{`Image: ${image.label}`}</Badge>
        <Badge>{`Notes: ${textPrediction.label}`}</Badge>
        <RiskBadge level={risk.level} score={risk.risk_score} />
        <Badge tone={report.agreement ? "teal" : "rose"}>
          {report.agreement ? "Modalities agree" : "Modalities disagree"}
        </Badge>
        {image.mock || textPrediction.mock || risk.mock ? <Badge tone="ivory">Mock outputs</Badge> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">X-ray with Grad-CAM</h2>
          <p className="mt-1 text-sm text-muted">
            Confidence {(image.confidence * 100).toFixed(1)}%
            {Object.entries(image.probs)
              .map(([label, value]) => ` · ${label} ${(value * 100).toFixed(0)}%`)
              .join("")}
          </p>
          <div className="mt-4">
            <HeatmapViewer originalSrc={originalImageUrl} heatmapSrc={heatmapSrc} />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">Highlighted words</h2>
          <p className="mt-1 text-sm text-muted">
            Predicted {textPrediction.label} · {(textPrediction.confidence * 100).toFixed(1)}%
          </p>
          <div className="mt-4">
            <WordHighlight text={text} weights={textPrediction.lime_word_weights} />
          </div>
          <ul className="mt-4 space-y-1 text-sm text-muted">
            {textPrediction.top_3.map((item) => (
              <li key={item.label}>
                {item.label} · {(item.confidence * 100).toFixed(1)}%
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">SHAP feature contributions</h2>
        <p className="mt-1 text-sm text-muted">
          Teal bars raise risk; terracotta bars lower it. Dataset: {session.dataset}.
        </p>
        <div className="mt-4">
          <ShapChart contributions={risk.shap_contributions} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">Next step</h2>
        <p className="mt-3 text-charcoal">{report.next_step}</p>
      </section>

      <p className="text-sm text-muted">{report.disclaimer}</p>
    </div>
  );
}
