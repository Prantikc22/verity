"use client";

function Spark({ values, color, label, fmt }: { values: number[]; color: string; label: string; fmt: (n: number) => string }) {
  const max = Math.max(...values, 1e-9);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const n = values.length;
  const pts = values.map((v, i) => `${(i / (n - 1)) * 100},${30 - ((v - min) / range) * 26 - 2}`).join(" ");
  const area = `0,32 ${pts} 100,32`;
  const last = values[values.length - 1];
  return (
    <div className="border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-neutral-500">{label}</span>
        <span className="text-lg font-semibold" style={{ color }}>{fmt(last)}</span>
      </div>
      <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="mt-2 h-12 w-full">
        <polygon points={area} fill={color} opacity="0.08" />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

export function ProjectTrend({ pass, flake, volume }: { pass: number[]; flake: number[]; volume: number[] }) {
  return (
    <div className="mt-3 grid gap-4 sm:grid-cols-3">
      <Spark values={pass} color="#10b981" label="Pass rate" fmt={(n) => `${Math.round(n * 100)}%`} />
      <Spark values={flake} color="#f59e0b" label="Flake rate" fmt={(n) => `${Math.round(n * 100)}%`} />
      <Spark values={volume} color="#6366f1" label="Tests / run" fmt={(n) => `${Math.round(n)}`} />
    </div>
  );
}
