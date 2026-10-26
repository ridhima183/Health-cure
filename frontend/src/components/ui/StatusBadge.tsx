import { cn } from "../../lib/cn.ts";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "border-border bg-card text-muted",
  primary: "border-border bg-card text-primary",
  success: "border-border bg-card text-risk-low",
  warning: "border-border bg-card text-charcoal",
  danger: "border-border bg-card text-risk-high",
};

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: string;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-field border px-2 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
