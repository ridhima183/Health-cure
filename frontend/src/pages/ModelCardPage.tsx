import { useQuery } from "@tanstack/react-query";

import { getModelCard } from "../api/client.ts";
import { ModelCard } from "../components/ModelCard.tsx";
import { ButtonLink } from "../components/ui/Button.tsx";
import { ErrorState } from "../components/ui/ErrorState.tsx";
import { PageHeader } from "../components/ui/PageHeader.tsx";
import { PageSkeleton } from "../components/ui/Skeleton.tsx";

export function ModelCardPage() {
  const cardQuery = useQuery({ queryKey: ["model-card"], queryFn: getModelCard });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Model card"
        description="Version, training data, known failure modes, and when the models were last evaluated."
        actions={
          <ButtonLink to="/performance" variant="ghost">
            Open Performance
          </ButtonLink>
        }
      />

      {cardQuery.isPending ? <PageSkeleton rows={2} /> : null}
      {cardQuery.isError ? (
        <ErrorState
          message={cardQuery.error instanceof Error ? cardQuery.error.message : "Could not load the model card."}
        />
      ) : null}
      {cardQuery.data ? <ModelCard card={cardQuery.data} /> : null}
    </div>
  );
}
