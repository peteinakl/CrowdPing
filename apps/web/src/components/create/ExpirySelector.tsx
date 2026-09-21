const OPTIONS = [7, 14, 30];

interface ExpirySelectorProps {
  value: number;
  onChange: (days: number) => void;
}

export function ExpirySelector({ value, onChange }: ExpirySelectorProps) {
  return (
    <div>
      <label htmlFor="expiry" className="mb-1 block text-sm font-semibold text-ink-950">
        Expires after
      </label>
      <select
        id="expiry"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-h-12 w-full rounded-[var(--radius-md)] border-2 border-ink-100 px-4 py-2 text-base focus:border-accent-600 focus:outline-none"
      >
        {OPTIONS.map((days) => (
          <option key={days} value={days}>
            {days} days
          </option>
        ))}
      </select>
      <p className="mt-1 text-xs text-ink-500">Locked once you publish.</p>
    </div>
  );
}
