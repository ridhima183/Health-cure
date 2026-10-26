export const chartTheme = {
  grid: "var(--color-border)",
  tick: "var(--color-muted)",
  ink: "var(--color-charcoal)",
  primary: "var(--color-primary)",
  accent: "var(--color-accent)",
  card: "var(--color-card)",
  ivory: "var(--color-ivory)",
  riskHigh: "var(--color-risk-high)",
  riskMid: "var(--color-risk-mid)",
  riskLow: "var(--color-risk-low)",
  radius: "var(--radius-field)",
} as const;

export const chartTooltipStyle = {
  background: chartTheme.card,
  border: "1px solid var(--color-border)",
  borderRadius: chartTheme.radius,
  boxShadow: "none",
  color: chartTheme.ink,
  fontSize: "var(--text-label)",
} as const;
