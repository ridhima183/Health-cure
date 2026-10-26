import { useState } from "react";

type HeatmapViewerProps = {
  originalSrc: string;
  heatmapSrc: string;
  alt?: string;
};

export function HeatmapViewer({ originalSrc, heatmapSrc, alt = "Chest X-ray" }: HeatmapViewerProps) {
  const [opacity, setOpacity] = useState(0.55);

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-card border border-border bg-card">
        <img src={originalSrc} alt={alt} className="block w-full object-contain" />
        <img
          src={heatmapSrc}
          alt="Grad-CAM heatmap overlay"
          className="pointer-events-none absolute inset-0 h-full w-full object-contain mix-blend-multiply"
          style={{ opacity }}
        />
      </div>
      <label className="flex items-center gap-3 text-sm text-muted">
        <span className="w-28 shrink-0">Heatmap opacity</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={opacity}
          onChange={(event) => setOpacity(Number(event.target.value))}
          className="w-full accent-primary"
        />
        <span className="w-10 text-right font-medium tabular-nums text-charcoal">{Math.round(opacity * 100)}</span>
      </label>
    </div>
  );
}
