import { ResultsBar } from './ResultsBar';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import type { ParticipantResultOption, PollOption } from '../../lib/types';

interface ResultsBarChartProps {
  options: PollOption[];
  percentages: ParticipantResultOption[] | null;
  size?: 'default' | 'large';
}

/**
 * Fixed option order (never re-sorted by popularity), one decimal place,
 * shared 0–100% scale, and an explicit zero-response state instead of NaN
 * or a fabricated distribution (PRD §4 "Audience results").
 */
export function ResultsBarChart({ options, percentages, size = 'default' }: ResultsBarChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const hasData = percentages !== null && percentages.some((p) => p.percentage > 0);
  const byId = new Map((percentages ?? []).map((p) => [p.optionId, p.percentage]));

  return (
    <div className={size === 'large' ? 'space-y-6' : 'space-y-4'} role="group" aria-label="Results">
      {!hasData && (
        <p className={size === 'large' ? 'text-xl text-ink-500' : 'text-sm text-ink-500'}>Waiting for responses…</p>
      )}
      {options.map((option) => (
        <ResultsBar
          key={option.id}
          label={option.label}
          percentage={byId.get(option.id) ?? 0}
          reducedMotion={reducedMotion}
          size={size}
        />
      ))}
    </div>
  );
}
