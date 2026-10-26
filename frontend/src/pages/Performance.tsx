import { useQuery } from "@tanstack/react-query";

import { getMetrics, getModelCard } from "../api/client.ts";
import { ConfusionMatrix, matrixMax, type BinaryConfusion } from "../components/ConfusionMatrix.tsx";
import { MetricsTable } from "../components/MetricsTable.tsx";
import { ModelCardSummary } from "../components/ModelCard.tsx";
import { ErrorState } from "../components/ui/ErrorState.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { PageSkeleton } from "../components/ui/Skeleton.tsx";
import { Card, CardHeader } from "../components/ui/Card.tsx";
import {
  asBinaryConfusion,
  asNumberMatrix,
  asRecord,
  asStringList,
  num,
  pct,
} from "../lib/metrics.ts";
import { friendlyModelName } from "../lib/modelNames.ts";

const TABULAR_COLUMNS = [
  { key: "model", label: "Model" },
  { key: "accuracy", label: "Accuracy", format: pct },
  { key: "precision", label: "Precision", format: pct },
  { key: "recall", label: "Recall", format: pct },
  { key: "specificity", label: "Specificity", format: pct },
  { key: "f1", label: "F1", format: pct },
  { key: "roc_auc", label: "ROC AUC", format: num },
];

const IMAGE_COLUMNS = [
  { key: "model", label: "Model" },
  { key: "accuracy", label: "Accuracy", format: pct },
  { key: "sensitivity", label: "Sensitivity", format: pct },
  { key: "specificity", label: "Specificity", format: pct },
  { key: "precision", label: "Precision", format: pct },
  { key: "f1", label: "F1", format: pct },
  { key: "roc_auc", label: "ROC AUC", format: num },
];

const TEXT_COLUMNS = [
  { key: "model", label: "Model" },
  { key: "accuracy", label: "Accuracy", format: pct },
  { key: "macro_f1", label: "Macro F1", format: pct },
  { key: "macro_precision", label: "Macro precision", format: pct },
  { key: "macro_recall", label: "Macro recall", format: pct },
];

function modelRows(models: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!models) return [];
  return Object.entries(models).map(([model, metrics]) => ({
    model: friendlyModelName(model),
    ...(asRecord(metrics) ?? {}),
  }));
}

function confusionFor(metrics: Record<string, unknown> | null, model: string): BinaryConfusion | number[][] | undefined {
  const rec = asRecord(metrics?.[model]);
  if (!rec) return undefined;
  return asBinaryConfusion(rec.confusion_matrix_dict) ?? asBinaryConfusion(rec.confusion_matrix) ?? asNumberMatrix(rec.confusion_matrix);
}

function scaleFor(models: Record<string, unknown> | null): number {
  if (!models) return 1;
  return Math.max(1, ...Object.keys(models).map((model) => matrixMax(confusionFor(models, model))));
}

export function PerformancePage() {
  const query = useQuery({ queryKey: ["metrics"], queryFn: getMetrics });
  const cardQuery = useQuery({ queryKey: ["model-card"], queryFn: getModelCard });

  const image = asRecord(query.data?.image);
  const text = asRecord(query.data?.text);
  const tabular = asRecord(query.data?.tabular);
  const imageModels = asRecord(image?.models);
  const textModels = asRecord(text?.models);
  const datasets = asRecord(tabular?.datasets);
  const heart = asRecord(datasets?.heart);
  const diabetes = asRecord(datasets?.diabetes);
  const imageCompare = asRecord(image?.baseline_comparison);
  const textCompare = asRecord(text?.baseline_comparison);
  const imageLabels = asStringList(image?.classes) ?? ["NORMAL", "PNEUMONIA"];
  const textLabels = asStringList(text?.labels);
  const imageScale = scaleFor(imageModels);
  const textScale = scaleFor(textModels);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Performance"
        description="Held-out metrics, confusion matrices, and baseline comparisons from training."
        actions={cardQuery.data ? <ModelCardSummary card={cardQuery.data} /> : null}
      />
      {cardQuery.isError ? <ErrorState message="Could not load the model card." /> : null}

      {query.isPending ? <PageSkeleton rows={4} /> : null}
      {query.isError ? (
        <ErrorState
          message={query.error instanceof Error ? query.error.message : "Failed to load metrics."}
        />
      ) : null}

      {query.data ? (
        <>
          <section className="space-y-4">
            <h2 className="font-display text-2xl">Image</h2>
            <MetricsTable title="Chest X-ray models" rows={modelRows(imageModels)} columns={IMAGE_COLUMNS} />
            <div className="grid gap-4 lg:grid-cols-2">
              {imageModels
                ? Object.keys(imageModels).map((model) => {
                    const matrix = confusionFor(imageModels, model);
                    if (!matrix) return null;
                    return (
                      <ConfusionMatrix
                        key={model}
                        title={friendlyModelName(model)}
                        labels={imageLabels}
                        matrix={matrix}
                        scaleMax={imageScale}
                      />
                    );
                  })
                : null}
            </div>
            {imageCompare ? (
              <Card>
                <CardHeader
                  title="Baseline comparison"
                  description="ResNet50 minus Baseline CNN (positive means ResNet is higher)."
                />
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(imageCompare).map(([key, value]) => (
                    <li key={key} className="rounded-field border border-border px-3 py-2 text-sm">
                      <span className="text-muted">{key.replaceAll("_", " ")}</span>
                      <div className="font-display text-xl tabular-nums">
                        {typeof value === "number" ? value.toFixed(3) : String(value)}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-2xl">Text</h2>
            <MetricsTable title="Symptom-text models" rows={modelRows(textModels)} columns={TEXT_COLUMNS} />
            <div className="grid gap-4">
              {textModels
                ? Object.keys(textModels).map((model) => {
                    const matrix = confusionFor(textModels, model);
                    if (!matrix) return null;
                    return (
                      <ConfusionMatrix
                        key={model}
                        title={friendlyModelName(model)}
                        labels={textLabels}
                        matrix={matrix}
                        scaleMax={textScale}
                      />
                    );
                  })
                : null}
            </div>
            {textCompare ? (
              <Card>
                <CardHeader title="Baseline comparison" />
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(textCompare).map(([key, value]) => (
                    <li key={key} className="rounded-field border border-border px-3 py-2 text-sm">
                      <span className="text-muted">{key.replaceAll("_", " ")}</span>
                      <div className="font-display text-xl tabular-nums">
                        {typeof value === "number" ? value.toFixed(3) : String(value)}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </section>

          {(["heart", "diabetes"] as const).map((name) => {
            const block = name === "heart" ? heart : diabetes;
            const models = asRecord(block?.models);
            const scale = scaleFor(models);
            return (
              <section key={name} className="space-y-4">
                <h2 className="font-display text-2xl capitalize">{name} tabular</h2>
                <MetricsTable
                  title={`${name === "heart" ? "Heart" : "Diabetes"} models`}
                  rows={modelRows(models)}
                  columns={TABULAR_COLUMNS}
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  {models
                    ? Object.keys(models).map((model) => {
                        const matrix = confusionFor(models, model);
                        if (!matrix) return null;
                        return (
                          <ConfusionMatrix
                            key={model}
                            title={friendlyModelName(model)}
                            labels={name === "heart" ? ["No disease", "Disease"] : ["No diabetes", "Diabetes"]}
                            matrix={matrix}
                            scaleMax={scale}
                          />
                        );
                      })
                    : null}
                </div>
              </section>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
