import * as RadioGroup from '@radix-ui/react-radio-group';

interface RadioCardProps {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Full-width answer card. Selection is shown via border weight + fill tint +
 * a filled/empty indicator dot — never colour alone (WCAG 2.2 AA, PRD §5).
 */
export function RadioCard({ value, label, disabled }: RadioCardProps) {
  return (
    <RadioGroup.Item
      value={value}
      disabled={disabled}
      className="group flex min-h-14 w-full items-center gap-4 rounded-[var(--radius-md)] border-2 border-ink-100 bg-white px-5 py-4 text-left text-base font-medium text-ink-950 transition-[border-color,background-color,box-shadow,transform] duration-150 motion-safe:active:scale-[0.985] hover:border-ink-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 data-[state=checked]:border-accent-600 data-[state=checked]:bg-accent-50 data-[state=checked]:[box-shadow:var(--shadow-raised)]"
    >
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink-300 transition-[border-color,transform] duration-150 group-data-[state=checked]:scale-110 group-data-[state=checked]:border-accent-600"
      >
        <RadioGroup.Indicator className="h-3 w-3 rounded-full bg-accent-600" />
      </span>
      <span>{label}</span>
    </RadioGroup.Item>
  );
}
