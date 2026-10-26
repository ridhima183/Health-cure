import { useState } from "react";

import { toDataUrl } from "../api/client.ts";
import { HeatmapViewer } from "../components/HeatmapViewer.tsx";
import { RiskBadge } from "../components/RiskBadge.tsx";
import { ShapChart } from "../components/ShapChart.tsx";
import { WordHighlight } from "../components/WordHighlight.tsx";
import { Button, ButtonLink } from "../components/ui/Button.tsx";
import { Card, CardHeader } from "../components/ui/Card.tsx";
import { EmptyState } from "../components/ui/EmptyState.tsx";
import { ErrorState } from "../components/ui/ErrorState.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { StatusBadge } from "../components/ui/StatusBadge.tsx";
import { FileText } from "lucide-react";
import { formatCaseTime } from "../lib/cases.ts";
import { exportReportPdf } from "../lib/exportPdf.ts";
import { useSession } from "../state/SessionContext.tsx";

export function ReportPage() {
  const { session } = useSession();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  if (!session) {
    return (
      <div className="space-y-6">
        <PageHeader title="Report" description="Run an analysis to see badges, explanations, and next steps." />
        <EmptyState
          icon={FileText}
          title="No report yet"
          description="Analyze a case on Diagnose to open badges, Grad-CAM, SHAP, and next steps."
          action={<ButtonLink to="/">Go to Diagnose</ButtonLink>}
        />
      </div>
    );
  }

  const { report, image, textPrediction, risk, originalImageUrl, text } = session;
  const heatmapSrc = toDataUrl(image.gradcam_base64);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report"
        description={`${report.diagnosis} · ${session.patientId || "PT-1001"} · ${session.visitLabel || "Baseline (Week 0)"} · ${formatCaseTime(session.createdAt)}`}
        actions={
          <>
            <ButtonLink
              to={`/history?patientId=${encodeURIComponent(session.patientId || "")}`}
              variant="ghost"
            >
              Timeline
            </ButtonLink>
            <Button
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
            >
              {pdfBusy ? "Preparing PDF…" : "Export PDF"}
            </Button>
            <Button variant="ghost" className="no-print" onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
      />
      {pdfError ? <ErrorState message={pdfError} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge>{`Image: ${image.label}`}</StatusBadge>
        <StatusBadge>{`Notes: ${textPrediction.label}`}</StatusBadge>
        <RiskBadge level={risk.level} score={risk.risk_score} />
        <StatusBadge tone={report.agreement ? "success" : "danger"}>
          {report.agreement ? "Modalities agree" : "Modalities disagree"}
        </StatusBadge>
        {image.mock || textPrediction.mock || risk.mock ? <StatusBadge>Mock outputs</StatusBadge> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="X-ray with Grad-CAM"
            description={`Confidence ${(image.confidence * 100).toFixed(1)}%${Object.entries(image.probs)
              .map(([label, value]) => ` · ${label} ${(value * 100).toFixed(0)}%`)
              .join("")}`}
          />
          <HeatmapViewer originalSrc={originalImageUrl} heatmapSrc={heatmapSrc} />
        </Card>

        <Card>
          <CardHeader
            title="Highlighted words"
            description={`Predicted ${textPrediction.label} · ${(textPrediction.confidence * 100).toFixed(1)}%`}
          />
          <WordHighlight text={text} weights={textPrediction.lime_word_weights} />
          <ul className="mt-4 space-y-1 text-sm text-muted">
            {textPrediction.top_3.map((item) => (
              <li key={item.label}>
                {item.label} · {(item.confidence * 100).toFixed(1)}%
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="SHAP feature contributions"
          description={`Teal bars raise risk; terracotta bars lower it. Dataset: ${session.dataset}.`}
        />
        <ShapChart contributions={risk.shap_contributions} />
      </Card>

      <Card>
        <CardHeader title="Next step" />
        <p className="text-charcoal">{report.next_step}</p>
      </Card>

      <p className="text-sm text-muted">{report.disclaimer}</p>
    </div>
  );
}
