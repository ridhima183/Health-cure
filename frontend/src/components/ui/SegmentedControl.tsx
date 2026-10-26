import { cn } from "../../lib/cn.ts";

type Option<T extends string> = {
  value: T;
  label: string;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-field bg-track p-0.5 text-sm"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-8 rounded-[calc(var(--radius-field)-2px)] px-3 font-medium capitalize outline-none transition-colors duration-200",
              "focus-visible:ring-2 focus-visible:ring-primary/30",
              selected ? "bg-card text-charcoal" : "text-muted hover:text-charcoal",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
