import { cn } from "../lib/cn.ts";

type WordHighlightProps = {
  text: string;
  weights: Record<string, number>;
};

function weightFor(token: string, weights: Record<string, number>): number | undefined {
  const cleaned = token.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!cleaned) return undefined;
  const direct = weights[cleaned] ?? weights[token] ?? weights[token.toLowerCase()];
  if (typeof direct === "number") return direct;
  for (const [key, value] of Object.entries(weights)) {
    if (key.toLowerCase().replace(/[^a-z0-9]+/g, "") === cleaned) return value;
  }
  return undefined;
}

const POSITIVE = ["bg-primary/10", "bg-primary/20", "bg-primary/35"];
const NEGATIVE = ["bg-accent/10", "bg-accent/20", "bg-accent/35"];

export function WordHighlight({ text, weights }: WordHighlightProps) {
  const tokens = text.split(/(\s+)/);
  const magnitudes = Object.values(weights).map((value) => Math.abs(value));
  const maxAbs = Math.max(0.001, ...magnitudes);

  return (
    <p className="leading-8 text-charcoal">
      {tokens.map((token, index) => {
        if (/^\s+$/.test(token)) return <span key={`${token}-${index}`}>{token}</span>;
        const weight = weightFor(token, weights);
        if (weight === undefined) return <span key={`${token}-${index}`}>{token}</span>;
        const intensity = Math.min(1, Math.abs(weight) / maxAbs);
        const bucket = intensity > 0.66 ? 2 : intensity > 0.33 ? 1 : 0;
        const tone = weight >= 0 ? POSITIVE[bucket] : NEGATIVE[bucket];
        return (
          <mark
            key={`${token}-${index}`}
            title={`${weight >= 0 ? "+" : ""}${weight.toFixed(3)}`}
            className={cn("rounded-sm px-0.5 text-charcoal", tone)}
          >
            {token}
          </mark>
        );
      })}
    </p>
  );
}
