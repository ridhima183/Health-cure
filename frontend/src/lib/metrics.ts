import type { BinaryConfusion } from "../components/ConfusionMatrix.tsx";

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function asNumberMatrix(value: unknown): number[][] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows: number[][] = [];
  for (const row of value) {
    if (!Array.isArray(row)) return undefined;
    rows.push(row.map((cell) => (typeof cell === "number" ? cell : Number(cell))));
  }
  return rows;
}

export function asBinaryConfusion(value: unknown): BinaryConfusion | undefined {
  const rec = asRecord(value);
  if (!rec) return undefined;
  const tn = asNumber(rec.tn);
  const fp = asNumber(rec.fp);
  const fn = asNumber(rec.fn);
  const tp = asNumber(rec.tp);
  if (tn === undefined || fp === undefined || fn === undefined || tp === undefined) return undefined;
  return { tn, fp, fn, tp };
}

export function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => String(item));
}

export function pct(value: unknown): string {
  const n = asNumber(value);
  if (n === undefined) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function num(value: unknown, digits = 3): string {
  const n = asNumber(value);
  if (n === undefined) return "—";
  return n.toFixed(digits);
}
