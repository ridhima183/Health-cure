import { SAMPLE_CASES, type SampleCase } from "../lib/samples.ts";
import { Card, CardHeader } from "./ui/Card.tsx";

type SampleCasesProps = {
  onSelect: (sample: SampleCase) => void;
  loadingId: string | null;
};

export function SampleCases({ onSelect, loadingId }: SampleCasesProps) {
  return (
    <Card>
      <CardHeader
        title="Sample cases"
        description="Fills an X-ray, notes, and labs so you can run Analyze without your own files."
      />
      <div className="grid gap-3 md:grid-cols-3">
        {SAMPLE_CASES.map((sample) => (
          <button
            key={sample.id}
            type="button"
            onClick={() => onSelect(sample)}
            disabled={loadingId !== null}
            className="rounded-card border border-border bg-card p-4 text-left outline-none transition-colors duration-200 hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60"
          >
            <p className="font-medium text-charcoal">{sample.title}</p>
            <p className="mt-1 text-sm text-muted">{sample.summary}</p>
            <p className="mt-3 text-sm font-medium text-primary">
              {loadingId === sample.id ? "Loading…" : "Use this sample"}
            </p>
          </button>
        ))}
      </div>
    </Card>
  );
}
