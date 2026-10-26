import type { ModelCardResponse } from "../api/client.ts";
import { ButtonLink } from "./ui/Button.tsx";
import { Card, CardHeader } from "./ui/Card.tsx";

export function formatEvaluated(iso: string | null): string {
  if (!iso) return "Not recorded";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function ModelCardMeta({
  card,
  compact = false,
}: {
  card: ModelCardResponse;
  compact?: boolean;
}) {
  return (
    <dl className={`grid gap-2 text-sm ${compact ? "" : "sm:grid-cols-2"}`}>
      <div className="rounded-field border border-border px-3 py-2">
        <dt className="text-xs uppercase tracking-wide text-muted">Version</dt>
        <dd className="font-medium text-charcoal">{card.version}</dd>
      </div>
      <div className="rounded-field border border-border px-3 py-2">
        <dt className="text-xs uppercase tracking-wide text-muted">Last evaluated</dt>
        <dd className="font-medium text-charcoal">{formatEvaluated(card.last_evaluated)}</dd>
      </div>
    </dl>
  );
}

export function ModelCardSummary({ card }: { card: ModelCardResponse }) {
  return (
    <aside className="min-w-64 max-w-sm rounded-card border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted">Model card</p>
      <p className="mt-1 font-display text-xl text-charcoal">{card.product}</p>
      <div className="mt-3">
        <ModelCardMeta card={card} compact />
      </div>
      <ButtonLink to="/model-card" variant="text" size="sm" className="mt-3 px-0">
        Training data and failure modes
      </ButtonLink>
    </aside>
  );
}

export function ModelCard({ card }: { card: ModelCardResponse }) {
  const modalities = card.modalities ?? [];

  return (
    <Card className="space-y-4">
      <CardHeader title={`${card.product} model card`} description={card.intended_use} badge={<ModelCardMeta card={card} />} />

      <div className="grid gap-4 lg:grid-cols-3">
        {modalities.map((modality) => (
          <article key={modality.id} className="rounded-card border border-border p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{modality.version}</p>
            <h3 className="font-display text-xl text-charcoal">{modality.name}</h3>
            <p className="mt-2 text-sm text-muted">{modality.architecture}</p>
            <p className="mt-3 text-sm">
              <span className="font-medium">Task. </span>
              {modality.task}
            </p>
            <p className="mt-3 text-sm">
              <span className="font-medium">Training data. </span>
              {modality.training_data}
            </p>
            <p className="mt-2 text-sm">
              <span className="font-medium">Evaluation. </span>
              {modality.evaluation_set}
            </p>
            <p className="mt-3 text-sm font-medium">Known failure modes</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
              {(modality.known_failure_modes ?? []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {(modality.out_of_scope ?? []).length > 0 ? (
              <>
                <p className="mt-3 text-sm font-medium">Out of scope</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
                  {modality.out_of_scope.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </article>
        ))}
      </div>
      {card.disclaimer ? <p className="text-sm text-muted">{card.disclaimer}</p> : null}
    </Card>
  );
}
