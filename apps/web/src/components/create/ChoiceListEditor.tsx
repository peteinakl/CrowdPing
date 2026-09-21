import { Button } from '../common/Button';
import { OPTIONS_MAX, OPTIONS_MIN, validateChoice } from '../../lib/validation';

interface ChoiceListEditorProps {
  choices: string[];
  onChange: (choices: string[]) => void;
}

export function ChoiceListEditor({ choices, onChange }: ChoiceListEditorProps) {
  function updateChoice(index: number, value: string) {
    const next = [...choices];
    next[index] = value;
    onChange(next);
  }

  function addChoice() {
    if (choices.length >= OPTIONS_MAX) return;
    onChange([...choices, '']);
  }

  function removeChoice(index: number) {
    if (choices.length <= OPTIONS_MIN) return;
    onChange(choices.filter((_, i) => i !== index));
  }

  function moveChoice(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= choices.length) return;
    const next = [...choices];
    const temp = next[index];
    next[index] = next[target] as string;
    next[target] = temp as string;
    onChange(next);
  }

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-semibold text-ink-950">
        Answers ({choices.length}/{OPTIONS_MAX})
      </legend>
      {choices.map((choice, index) => {
        const error = choice.trim().length > 0 ? validateChoice(choice) : null;
        return (
          <div key={index} className="flex items-start gap-2">
            <span className="mt-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-100 text-sm font-semibold text-ink-700">
              {index + 1}
            </span>
            <div className="flex-1">
              <input
                type="text"
                value={choice}
                onChange={(e) => updateChoice(index, e.target.value)}
                placeholder={`Answer ${index + 1}`}
                aria-label={`Answer ${index + 1}`}
                className="min-h-12 w-full rounded-[var(--radius-md)] border-2 border-ink-100 px-4 py-2 text-base focus:border-accent-600 focus:outline-none"
              />
              {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => moveChoice(index, -1)}
                disabled={index === 0}
                aria-label={`Move answer ${index + 1} up`}
                className="flex h-6 w-8 items-center justify-center rounded text-ink-500 hover:bg-ink-100 disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveChoice(index, 1)}
                disabled={index === choices.length - 1}
                aria-label={`Move answer ${index + 1} down`}
                className="flex h-6 w-8 items-center justify-center rounded text-ink-500 hover:bg-ink-100 disabled:opacity-30"
              >
                ↓
              </button>
            </div>
            <button
              type="button"
              onClick={() => removeChoice(index)}
              disabled={choices.length <= OPTIONS_MIN}
              aria-label={`Remove answer ${index + 1}`}
              className="mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-30"
            >
              ✕
            </button>
          </div>
        );
      })}
      <Button type="button" variant="secondary" onClick={addChoice} disabled={choices.length >= OPTIONS_MAX}>
        + Add answer
      </Button>
    </fieldset>
  );
}
