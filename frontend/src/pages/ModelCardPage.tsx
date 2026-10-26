import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getModelCard } from "../api/client.ts";
import { ModelCard } from "../components/ModelCard.tsx";

export function ModelCardPage() {
  const cardQuery = useQuery({ queryKey: ["model-card"], queryFn: getModelCard });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Model card</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Version, training data, known failure modes, and when the models were last evaluated.
            Held-out metrics live on the Performance page.
          </p>
        </div>
        <Link
          to="/performance"
          className="rounded-full border border-border bg-card px-4 py-2 text-sm text-primary"
        >
          Open Performance
        </Link>
      </div>

      {cardQuery.isPending ? <p className="text-muted">Loading model card…</p> : null}
      {cardQuery.isError ? (
        <p className="rounded-xl border border-rose bg-rose/60 px-4 py-3 text-sm text-risk-high" role="alert">
          {cardQuery.error instanceof Error ? cardQuery.error.message : "Could not load the model card."}
        </p>
      ) : null}
      {cardQuery.data ? <ModelCard card={cardQuery.data} /> : null}
    </div>
  );
}
