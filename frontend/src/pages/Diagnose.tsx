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
import { compressDataUrl, listDistinctPatientIds } from "../lib/cases.ts";
import { defaultFeatures, fieldsFor } from "../lib/features.ts";
import { sampleFile, type SampleCase } from "../lib/samples.ts";
import { useSession } from "../state/SessionContext.tsx";

type AnalyzeStep = "idle" | "models" | "report";

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

  const existingPatients = useMemo(() => listDistinctPatientIds(), []);
  const fields = useMemo(() => fieldsFor(dataset), [dataset]);

  function switchDataset(next: DatasetName) {
    setDataset(next);
    setFeatures(defaultFeatures(next));
  }

  function onFile(next: File | null) {
    setFile(next);
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

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  const errorMessage =
    mutation.error instanceof ApiError || mutation.error instanceof Error
      ? mutation.error.message
      : mutation.error
        ? "Something went wrong."
        : null;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <h1 className="font-display text-4xl text-charcoal">Diagnose</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Provide a chest X-ray, symptom notes, and clinical features. Analyze runs the image, text, and
          risk models, then builds a fused report. Cases with the same Patient ID are grouped in
          History for longitudinal tracking and baseline vs. follow-up comparisons.
        </p>
      </div>

      <SampleCases onSelect={loadSample} loadingId={sampleLoading} />
      {sampleError ? (
        <p className="rounded-xl border border-rose bg-rose/60 px-4 py-3 text-sm text-risk-high" role="alert">
          {sampleError}
        </p>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl">Patient & Longitudinal Tracking</h2>
            <p className="mt-1 text-sm text-muted">
              Assign this encounter to a patient record for timeline progression and comparative scanning.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              const randNum = Math.floor(1000 + Math.random() * 9000);
              setPatientId(`PT-${randNum}`);
              setVisitLabel("Baseline (Week 0)");
            }}
            className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-primary hover:bg-teal-tint"
          >
            + Generate New Patient ID
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-charcoal">
              Patient ID / Medical Record #
              <input
                type="text"
                required
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                placeholder="e.g. PT-1001"
                className="mt-1 w-full rounded-xl border border-border bg-ivory px-3 py-2 text-charcoal outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            {existingPatients.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span>Existing patients:</span>
                {existingPatients.slice(0, 4).map((pid) => (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => setPatientId(pid)}
                    className={`rounded-md px-2 py-0.5 ${
                      patientId === pid ? "bg-primary text-ivory" : "bg-ivory hover:text-primary"
                    }`}
                  >
                    {pid}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal">
              Visit Stage / Label
              <input
                type="text"
                required
                value={visitLabel}
                onChange={(e) => setVisitLabel(e.target.value)}
                placeholder="e.g. Baseline (Week 0) or Follow-up (Week 4)"
                className="mt-1 w-full rounded-xl border border-border bg-ivory px-3 py-2 text-charcoal outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted">
              {["Baseline (Week 0)", "Follow-up (Week 2)", "Follow-up (Week 4)", "Follow-up (Week 8)"].map(
                (stage) => (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setVisitLabel(stage)}
                    className={`rounded-md px-2 py-0.5 ${
                      visitLabel === stage ? "bg-primary text-ivory" : "bg-ivory hover:text-primary"
                    }`}
                  >
                    {stage}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">1. Chest X-ray</h2>
        <div className="mt-4">
          <ImageUpload file={file} previewUrl={previewUrl} onFile={onFile} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">2. Symptom notes</h2>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={5}
          required
          minLength={1}
          placeholder="e.g. cough, fever, and shortness of breath for three days"
          className="mt-4 w-full rounded-xl border border-border bg-ivory px-3 py-2 text-charcoal outline-none focus:ring-2 focus:ring-primary"
        />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl">3. Clinical features</h2>
          <div className="inline-flex rounded-full bg-teal-tint p-1 text-sm">
            {(["heart", "diabetes"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => switchDataset(option)}
                className={`rounded-full px-4 py-1.5 capitalize ${
                  dataset === option ? "bg-primary text-ivory" : "text-primary"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((field) => (
            <label key={field.name} className="block text-sm">
              <span className="font-medium text-charcoal">{field.label}</span>
              <span className="ml-2 text-muted">{field.hint}</span>
              {field.kind === "select" && field.options ? (
                <select
                  value={features[field.name]}
                  onChange={(event) =>
                    setFeatures((current) => ({ ...current, [field.name]: Number(event.target.value) }))
                  }
                  className="mt-1 w-full rounded-xl border border-border bg-ivory px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                >
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  required
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={features[field.name]}
                  onChange={(event) =>
                    setFeatures((current) => ({ ...current, [field.name]: Number(event.target.value) }))
                  }
                  className="mt-1 w-full rounded-xl border border-border bg-ivory px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                />
              )}
              <span className="mt-1 block text-xs text-muted">
                Range {field.min}–{field.max}
              </span>
            </label>
          ))}
        </div>
      </section>

      {errorMessage ? (
        <p className="rounded-xl border border-rose bg-rose/60 px-4 py-3 text-sm text-risk-high" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {mutation.isPending ? (
        <p className="text-sm text-muted" aria-live="polite">
          {step === "report" ? "Building fused report…" : "Running image, text, and risk models…"}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-full bg-primary px-6 py-3 font-medium text-ivory disabled:opacity-60"
      >
        {mutation.isPending ? "Analyzing…" : "Analyze"}
      </button>
    </form>
  );
}
