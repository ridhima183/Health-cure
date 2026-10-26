import { useMemo, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  ApiError,
  fileToBase64,
  predictImage,
  predictReport,
  predictRisk,
  predictText,
  type DatasetName,
} from "../api/client.ts";
import { ImageUpload } from "../components/ImageUpload.tsx";
import { SampleCases } from "../components/SampleCases.tsx";
import { Button } from "../components/ui/Button.tsx";
import { Card, CardHeader } from "../components/ui/Card.tsx";
import { controlClass, Field, SectionHeading, textareaClass } from "../components/ui/Field.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { SegmentedControl } from "../components/ui/SegmentedControl.tsx";
import { StickyBar } from "../components/ui/StickyBar.tsx";
import { ErrorState } from "../components/ui/ErrorState.tsx";
import { compressDataUrl, listDistinctPatientIds } from "../lib/cases.ts";
import { cn } from "../lib/cn.ts";
import { encounterSchema, featuresSchema } from "../lib/featureSchema.ts";
import { defaultFeatures, groupedFields } from "../lib/features.ts";
import { sampleFile, type SampleCase } from "../lib/samples.ts";
import { useSession } from "../state/SessionContext.tsx";

type AnalyzeStep = "idle" | "models" | "report";

const VISIT_PRESETS = [
  "Baseline (Week 0)",
  "Follow-up (Week 2)",
  "Follow-up (Week 4)",
  "Follow-up (Week 8)",
];

export function DiagnosePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setSession } = useSession();

  const [patientId, setPatientId] = useState(() => searchParams.get("patientId") || "PT-1001");
  const [visitLabel, setVisitLabel] = useState(() => searchParams.get("visitLabel") || "Baseline (Week 0)");

  const [dataset, setDataset] = useState<DatasetName>(() => {
    const ds = searchParams.get("dataset");
    return ds === "diabetes" || ds === "heart" ? ds : "heart";
  });
  const [features, setFeatures] = useState<Record<string, number>>(() => defaultFeatures(dataset));
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [step, setStep] = useState<AnalyzeStep>("idle");
  const [sampleLoading, setSampleLoading] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const existingPatients = useMemo(() => listDistinctPatientIds(), []);
  const groups = useMemo(() => groupedFields(dataset), [dataset]);

  function switchDataset(next: DatasetName) {
    setDataset(next);
    setFeatures(defaultFeatures(next));
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors.features;
      for (const key of Object.keys(nextErrors)) {
        if (key.startsWith("feat:")) delete nextErrors[key];
      }
      return nextErrors;
    });
  }

  function onFile(next: File | null) {
    setFile(next);
    if (next) {
      setErrors((current) => {
        const nextErrors = { ...current };
        delete nextErrors.file;
        return nextErrors;
      });
    }
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return next ? URL.createObjectURL(next) : null;
    });
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Upload a chest X-ray before analyzing.");
      if (!notes.trim()) throw new Error("Describe symptoms in the notes field.");
      setStep("models");
      const imageB64 = await fileToBase64(file);
      const [image, textPrediction, risk] = await Promise.all([
        predictImage(file),
        predictText({ text: notes.trim() }),
        predictRisk({ dataset, features }),
      ]);
      setStep("report");
      const report = await predictReport({
        text: notes.trim(),
        dataset,
        features,
        image_base64: imageB64,
      });
      const rawImageUrl = `data:${file.type};base64,${imageB64}`;
      const originalImageUrl = await compressDataUrl(rawImageUrl).catch(() => rawImageUrl);
      return {
        patientId: patientId.trim() || undefined,
        visitLabel: visitLabel.trim() || undefined,
        originalImageUrl,
        text: notes.trim(),
        dataset,
        features,
        image,
        textPrediction,
        risk,
        report,
      };
    },
    onSuccess: (session) => {
      setStep("idle");
      setSession(session);
      navigate("/report");
    },
    onError: () => setStep("idle"),
  });

  async function loadSample(sample: SampleCase) {
    setSampleError(null);
    setSampleLoading(sample.id);
    setErrors({});
    try {
      const nextFile = await sampleFile(sample);
      if (sample.patientId) setPatientId(sample.patientId);
      if (sample.visitLabel) setVisitLabel(sample.visitLabel);
      switchDataset(sample.dataset);
      setFeatures(sample.features);
      setNotes(sample.notes);
      onFile(nextFile);
    } catch (error) {
      setSampleError(error instanceof Error ? error.message : "Could not load the sample case.");
    } finally {
      setSampleLoading(null);
    }
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    const encounter = encounterSchema.safeParse({ patientId, visitLabel, notes });
    if (!encounter.success) {
      for (const issue of encounter.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
    }
    if (!file) nextErrors.file = "Upload a chest X-ray before analyzing.";
    const fields = groups.flatMap((group) => group.fields);
    const feat = featuresSchema(fields).safeParse(features);
    if (!feat.success) {
      for (const issue of feat.error.issues) {
        const key = String(issue.path[0] ?? "features");
        if (!nextErrors[`feat:${key}`]) nextErrors[`feat:${key}`] = issue.message;
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    mutation.mutate();
  }

  function onReset() {
    setFeatures(defaultFeatures(dataset));
    setNotes("");
    onFile(null);
    setErrors({});
    setSampleError(null);
  }

  const errorMessage =
    mutation.error instanceof ApiError || mutation.error instanceof Error
      ? mutation.error.message
      : mutation.error
        ? "Something went wrong."
        : null;

  return (
    <form onSubmit={onSubmit} className="space-y-6 pb-4">
      <PageHeader
        title="Diagnose"
        description="Chest X-ray, symptom notes, and labs run through the image, text, and risk models into one report."
      />

      <SampleCases onSelect={loadSample} loadingId={sampleLoading} />
      {sampleError ? <ErrorState message={sampleError} /> : null}

      <Card>
        <CardHeader
          title="Patient"
          description="Same ID groups visits in History for baseline vs follow-up comparison."
          action={
            <Button
              variant="text"
              size="sm"
              onClick={() => {
                const randNum = Math.floor(1000 + Math.random() * 9000);
                setPatientId(`PT-${randNum}`);
                setVisitLabel("Baseline (Week 0)");
              }}
            >
              New patient ID
            </Button>
          }
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="patientId" label="Patient ID" error={errors.patientId}>
            <input
              id="patientId"
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="PT-1001"
              aria-invalid={Boolean(errors.patientId)}
              aria-describedby={errors.patientId ? "patientId-error" : undefined}
              className={controlClass}
            />
          </Field>
          <Field id="visitLabel" label="Visit" error={errors.visitLabel}>
            <input
              id="visitLabel"
              type="text"
              value={visitLabel}
              onChange={(e) => setVisitLabel(e.target.value)}
              placeholder="Baseline (Week 0)"
              aria-invalid={Boolean(errors.visitLabel)}
              aria-describedby={errors.visitLabel ? "visitLabel-error" : undefined}
              className={controlClass}
            />
          </Field>
        </div>
        {existingPatients.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span>Patients</span>
            {existingPatients.slice(0, 4).map((pid) => (
              <button
                key={pid}
                type="button"
                onClick={() => setPatientId(pid)}
                className={cn(
                  "rounded-field border px-2 py-1 outline-none transition-colors duration-200",
                  "focus-visible:ring-2 focus-visible:ring-primary/30",
                  patientId === pid
                    ? "border-primary bg-card text-charcoal"
                    : "border-border bg-card hover:text-charcoal",
                )}
              >
                {pid}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted">
          {VISIT_PRESETS.map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => setVisitLabel(stage)}
              className={cn(
                "rounded-field border px-2 py-1 outline-none transition-colors duration-200",
                "focus-visible:ring-2 focus-visible:ring-primary/30",
                visitLabel === stage
                  ? "border-primary bg-card text-charcoal"
                  : "border-border bg-card hover:text-charcoal",
              )}
            >
              {stage}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Chest X-ray" />
          <ImageUpload file={file} previewUrl={previewUrl} onFile={onFile} />
          {errors.file ? (
            <p className="mt-2 text-xs text-risk-high" role="alert">
              {errors.file}
            </p>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Symptom notes" />
          <Field id="notes" label="Notes" error={errors.notes}>
            <textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={8}
              placeholder="Cough, fever, and shortness of breath for three days"
              aria-invalid={Boolean(errors.notes)}
              aria-describedby={errors.notes ? "notes-error" : undefined}
              className={textareaClass}
            />
          </Field>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Clinical features"
          action={
            <SegmentedControl
              ariaLabel="Risk dataset"
              value={dataset}
              onChange={switchDataset}
              options={[
                { value: "heart", label: "Heart" },
                { value: "diabetes", label: "Diabetes" },
              ]}
            />
          }
        />
        {groups.map((group) => (
          <div key={group.title}>
            <SectionHeading>{group.title}</SectionHeading>
            <div className="grid items-start gap-4 md:grid-cols-2">
              {group.fields.map((field) => {
                const error = errors[`feat:${field.name}`];
                const range = `${field.min}–${field.max}`;
                return (
                  <Field
                    key={field.name}
                    id={field.name}
                    label={field.label}
                    unit={field.kind === "number" ? field.unit : undefined}
                    hint={field.hint}
                    error={error}
                  >
                    {field.kind === "select" && field.options ? (
                      <select
                        id={field.name}
                        value={features[field.name]}
                        onChange={(event) =>
                          setFeatures((current) => ({
                            ...current,
                            [field.name]: Number(event.target.value),
                          }))
                        }
                        aria-invalid={Boolean(error)}
                        className={controlClass}
                      >
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={field.name}
                        type="number"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={features[field.name]}
                        placeholder={range}
                        onChange={(event) =>
                          setFeatures((current) => ({
                            ...current,
                            [field.name]: Number(event.target.value),
                          }))
                        }
                        aria-invalid={Boolean(error)}
                        className={cn(controlClass, field.unit ? "pr-12" : undefined)}
                      />
                    )}
                  </Field>
                );
              })}
            </div>
          </div>
        ))}
      </Card>

      {errorMessage ? <ErrorState message={errorMessage} /> : null}

      <StickyBar
        status={
          mutation.isPending
            ? step === "report"
              ? "Building fused report…"
              : "Running image, text, and risk models…"
            : null
        }
      >
        <Button variant="ghost" onClick={onReset} disabled={mutation.isPending}>
          Reset
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Analyzing…" : "Analyze"}
        </Button>
      </StickyBar>
    </form>
  );
}
