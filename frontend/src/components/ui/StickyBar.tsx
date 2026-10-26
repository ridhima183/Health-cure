import type { ReactNode } from "react";

export function StickyBar({ children, status }: { children: ReactNode; status?: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-border bg-ivory/95 px-4 py-3 backdrop-blur-sm md:-mx-6 md:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="min-h-5 text-sm text-muted">{status}</div>
        <div className="flex items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
