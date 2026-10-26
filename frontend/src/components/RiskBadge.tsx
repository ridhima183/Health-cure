import type { RiskLevel } from "../api/client.ts";
import { StatusBadge } from "./ui/StatusBadge.tsx";

const TONE: Record<RiskLevel, "success" | "warning" | "danger"> = {
  low: "success",
  moderate: "warning",
  high: "danger",
};

const LABEL: Record<RiskLevel, string> = {
  low: "Low risk",
  moderate: "Moderate risk",
  high: "High risk",
};

export function RiskBadge({ level, score }: { level: RiskLevel; score?: number }) {
  const scoreLabel = typeof score === "number" ? ` · ${(score * 100).toFixed(0)}%` : "";
  return <StatusBadge tone={TONE[level]}>{`${LABEL[level]}${scoreLabel}`}</StatusBadge>;
}
