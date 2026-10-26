import type { ReactNode } from "react";

import { cn } from "../../lib/cn.ts";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-card border border-border bg-card p-5", className)}>{children}</section>
  );
}

export function CardHeader({
  title,
  description,
  badge,
  action,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-xl text-charcoal">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {badge}
        {action}
      </div>
    </div>
  );
}
