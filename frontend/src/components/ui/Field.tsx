import { Info } from "lucide-react";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

import { cn } from "../../lib/cn.ts";

export const controlClass = cn(
  "h-10 w-full rounded-field border border-border bg-card px-3 text-sm text-charcoal",
  "outline-none transition-[border-color,box-shadow] duration-200",
  "placeholder:text-muted",
  "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
  "disabled:opacity-60",
);

export const textareaClass = cn(
  "min-h-32 w-full rounded-field border border-border bg-card px-3 py-2 text-sm text-charcoal",
  "outline-none transition-[border-color,box-shadow] duration-200",
  "placeholder:text-muted",
  "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
);

type FieldProps = {
  id: string;
  label: string;
  unit?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({ id, label, unit, hint, error, children }: FieldProps) {
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ className?: string; id?: string }>, {
        id,
        className: cn(
          (children as ReactElement<{ className?: string }>).props.className,
          unit && "pr-10",
        ),
        "aria-invalid": Boolean(error) || undefined,
        "aria-describedby": error ? `${id}-error` : undefined,
      } as never)
    : children;

  return (
    <div className="flex min-h-20 flex-col gap-1.5">
      <div className="flex h-5 items-center gap-1.5">
        <label htmlFor={id} className="text-label font-medium text-charcoal">
          {label}
        </label>
        {hint ? <HintTooltip label={label} text={hint} /> : null}
      </div>
      <div className="relative">
        {control}
        {unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted">
            {unit}
          </span>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-xs text-risk-high" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function HintTooltip({ label, text }: { label: string; text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex size-4 items-center justify-center rounded-sm text-muted outline-none hover:text-charcoal focus-visible:ring-2 focus-visible:ring-primary/30"
        aria-label={`${label} details`}
      >
        <Info className="size-3.5" strokeWidth={1.75} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-52 -translate-x-1/2 rounded-field border border-border bg-card px-2.5 py-2 text-xs leading-snug text-muted opacity-0 shadow-none transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 mt-5 border-b border-border pb-2 text-xs font-medium uppercase tracking-wide text-muted first:mt-0">
      {children}
    </h3>
  );
}
