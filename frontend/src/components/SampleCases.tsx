import { SAMPLE_CASES, type SampleCase } from "../lib/samples.ts";

type SampleCasesProps = {
  onSelect: (sample: SampleCase) => void;
  loadingId: string | null;
};

export function SampleCases({ onSelect, loadingId }: SampleCasesProps) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-xl">Sample cases</h2>
      <p className="mt-1 text-sm text-muted">
        One click fills a chest X-ray, notes, and labs so you can run Analyze without your own files.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {SAMPLE_CASES.map((sample) => (
          <button
            key={sample.id}
            type="button"
            onClick={() => onSelect(sample)}
            disabled={loadingId !== null}
            className="rounded-2xl border border-border bg-ivory p-4 text-left transition hover:border-primary disabled:opacity-60"
          >
            <p className="font-display text-lg text-charcoal">{sample.title}</p>
            <p className="mt-1 text-sm text-muted">{sample.summary}</p>
            <p className="mt-3 text-sm font-medium text-primary">
              {loadingId === sample.id ? "Loading…" : "Use this sample"}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
