import { Logo } from '../common/Logo';

interface MobilePreviewPaneProps {
  question: string;
  choices: string[];
}

/** A non-interactive preview — never records a vote (PRD O3). */
export function MobilePreviewPane({ question, choices }: MobilePreviewPaneProps) {
  const visibleChoices = choices.filter((c) => c.trim().length > 0);
  return (
    <div className="mx-auto w-[280px] rounded-[2rem] border-8 border-ink-950 bg-white p-4 shadow-lg">
      <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-ink-100" />
      <div className="space-y-4 px-1">
        <Logo className="h-5 w-auto" />
        <p className="text-sm font-semibold text-ink-950">{question || 'Your question will appear here'}</p>
        <div className="space-y-2">
          {visibleChoices.length === 0 && <p className="text-xs text-ink-300">Add answers to preview them.</p>}
          {visibleChoices.map((choice, i) => (
            <div key={i} className="rounded-[var(--radius-md)] border-2 border-ink-100 px-3 py-2 text-xs font-medium text-ink-950">
              {choice}
            </div>
          ))}
        </div>
        <div className="rounded-full bg-accent-600 py-2 text-center text-xs font-semibold text-white">
          Submit vote
        </div>
      </div>
    </div>
  );
}
