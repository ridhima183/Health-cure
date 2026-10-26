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
        const positive = weight >= 0;
        const background = positive
          ? `rgba(15, 95, 92, ${0.12 + intensity * 0.35})`
          : `rgba(194, 96, 62, ${0.12 + intensity * 0.35})`;
        return (
          <mark
            key={`${token}-${index}`}
            title={`${weight >= 0 ? "+" : ""}${weight.toFixed(3)}`}
            className="rounded px-0.5"
            style={{ backgroundColor: background, color: "#2B2724" }}
          >
            {token}
          </mark>
        );
      })}
    </p>
  );
}
