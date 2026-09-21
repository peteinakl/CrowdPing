interface ResultsBarProps {
  label: string;
  percentage: number;
  reducedMotion: boolean;
  size?: 'default' | 'large';
}

export function ResultsBar({ label, percentage, reducedMotion, size = 'default' }: ResultsBarProps) {
  const displayValue = percentage.toFixed(1);
  const isLarge = size === 'large';

  return (
    <div className="space-y-2">
      <div className={`flex items-baseline justify-between gap-4 ${isLarge ? 'text-2xl' : 'text-sm'}`}>
        <span className="font-medium text-ink-950">{label}</span>
        {/* Mono marks this as a live-measured number, not authored text. */}
        <span className="font-mono tabular-nums font-semibold text-ink-700">{displayValue}%</span>
      </div>
      <div className={`w-full overflow-hidden rounded-full bg-ink-100 ${isLarge ? 'h-6' : 'h-3'}`}>
        <div
          className={`h-full rounded-full bg-accent-600 ${reducedMotion ? '' : 'transition-[width] duration-700 [transition-timing-function:var(--ease-spring)]'}`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>
    </div>
  );
}
