import { cn } from "../../lib/cn.ts";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-field bg-track", className)} />;
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-card border border-border bg-card p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-24 w-full" />
        </div>
      ))}
    </div>
  );
}
