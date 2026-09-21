import type { ResultsMode } from '../../lib/types';

interface ResultsTimingSelectorProps {
  value: ResultsMode;
  onChange: (mode: ResultsMode) => void;
}

export function ResultsTimingSelector({ value, onChange }: ResultsTimingSelectorProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink-950">Participant results</legend>
      <div className="space-y-2">
        <label className="flex items-start gap-3 rounded-[var(--radius-md)] border-2 border-ink-100 p-4 has-[:checked]:border-accent-600">
          <input
            type="radio"
            name="resultsTiming"
            checked={value === 'after_vote'}
            onChange={() => onChange('after_vote')}
            className="mt-1"
          />
          <span>
            <span className="block font-medium text-ink-950">Show after voting</span>
            <span className="block text-sm text-ink-500">Voters see live results as soon as they submit.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-[var(--radius-md)] border-2 border-ink-100 p-4 has-[:checked]:border-accent-600">
          <input
            type="radio"
            name="resultsTiming"
            checked={value === 'after_close'}
            onChange={() => onChange('after_close')}
            className="mt-1"
          />
          <span>
            <span className="block font-medium text-ink-950">Show only after voting closes</span>
            <span className="block text-sm text-ink-500">
              Voters see "Results will be available when voting closes."
            </span>
          </span>
        </label>
      </div>
      <p className="mt-1 text-xs text-ink-500">Locked once you publish.</p>
    </fieldset>
  );
}
