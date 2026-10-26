import { useQuery } from "@tanstack/react-query";

import { getMetrics, getModelCard } from "../api/client.ts";
import { ConfusionMatrix, type BinaryConfusion } from "../components/ConfusionMatrix.tsx";
import { MetricsTable } from "../components/MetricsTable.tsx";
import { ModelCardSummary } from "../components/ModelCard.tsx";
import {
  asBinaryConfusion,
  asNumberMatrix,
  asRecord,
  asStringList,
  num,
  pct,
} from "../lib/metrics.ts";

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
    model,
    ...(asRecord(metrics) ?? {}),
  }));
}

function confusionFor(metrics: Record<string, unknown> | null, model: string): BinaryConfusion | number[][] | undefined {
  const rec = asRecord(metrics?.[model]);
  if (!rec) return undefined;
  return asBinaryConfusion(rec.confusion_matrix_dict) ?? asBinaryConfusion(rec.confusion_matrix) ?? asNumberMatrix(rec.confusion_matrix);
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h1 className="font-display text-4xl">Performance</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Held-out metrics, confusion matrices, and baseline comparisons from training.
          </p>
        </div>
        {cardQuery.data ? <ModelCardSummary card={cardQuery.data} /> : null}
      </div>
      {cardQuery.isError ? (
        <p className="rounded-xl border border-rose bg-rose/60 px-4 py-3 text-sm text-risk-high" role="alert">
          Could not load the model card.
        </p>
      ) : null}

      {query.isPending ? <p className="text-muted">Loading evaluation metrics…</p> : null}
      {query.isError ? (
        <p className="rounded-xl border border-rose bg-rose/60 px-4 py-3 text-sm text-risk-high" role="alert">
          {query.error instanceof Error ? query.error.message : "Failed to load metrics."}
        </p>
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
                    title={`${model} confusion`}
                    labels={imageLabels}
                    matrix={matrix}
                  />
                );
              })
            : null}
        </div>
        {imageCompare ? (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-display text-lg">Baseline comparison</h3>
            <p className="mt-2 text-sm text-muted">ResNet50 minus tiny CNN (positive means ResNet is higher).</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(imageCompare).map(([key, value]) => (
                <li key={key} className="rounded-xl bg-ivory px-3 py-2 text-sm">
                  <span className="text-muted">{key.replaceAll("_", " ")}</span>
                  <div className="font-display text-xl">{typeof value === "number" ? value.toFixed(3) : String(value)}</div>
                </li>
              ))}
            </ul>
          </div>
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
                    title={`${model} confusion`}
                    labels={textLabels}
                    matrix={matrix}
                  />
                );
              })
            : null}
        </div>
        {textCompare ? (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-display text-lg">Baseline comparison</h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(textCompare).map(([key, value]) => (
                <li key={key} className="rounded-xl bg-ivory px-3 py-2 text-sm">
                  <span className="text-muted">{key.replaceAll("_", " ")}</span>
                  <div className="font-display text-xl">
                    {typeof value === "number" ? value.toFixed(3) : String(value)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {(["heart", "diabetes"] as const).map((name) => {
        const block = name === "heart" ? heart : diabetes;
        const models = asRecord(block?.models);
        return (
          <section key={name} className="space-y-4">
            <h2 className="font-display text-2xl capitalize">{name} tabular</h2>
            <MetricsTable title={`${name} models`} rows={modelRows(models)} columns={TABULAR_COLUMNS} />
            <div className="grid gap-4 lg:grid-cols-2">
              {models
                ? Object.keys(models).map((model) => {
                    const matrix = confusionFor(models, model);
                    if (!matrix) return null;
                    return (
                      <ConfusionMatrix
                        key={model}
                        title={`${model} confusion`}
                        labels={name === "heart" ? ["No disease", "Disease"] : ["No diabetes", "Diabetes"]}
                        matrix={matrix}
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
