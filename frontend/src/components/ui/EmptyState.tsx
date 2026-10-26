import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="rounded-card border border-border bg-card px-6 py-12 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-field border border-border text-primary">
        <Icon className="size-5" strokeWidth={1.75} />
      </div>
      <h2 className="mt-4 font-display text-2xl text-charcoal">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{description}</p>
      <div className="mt-6 flex justify-center">{action}</div>
    </div>
  );
}
