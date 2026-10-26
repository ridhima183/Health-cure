import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

export function ErrorState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div
      className="flex flex-wrap items-start justify-between gap-3 rounded-card border border-rose bg-card px-4 py-3 text-sm text-risk-high"
      role="alert"
    >
      <p className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        <span>{message}</span>
      </p>
      {action}
    </div>
  );
}
