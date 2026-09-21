import { Button } from '../common/Button';

interface PresentationControlsProps {
  revealed: boolean;
  onToggleReveal: () => void;
  onExit: () => void;
}

/**
 * Kept in the DOM/tab order at all times (never display:none) so keyboard
 * and screen-reader users can reach it, but visually recedes until
 * hover/focus so it doesn't clutter the projected room view (PRD §4).
 */
export function PresentationControls({ revealed, onToggleReveal, onExit }: PresentationControlsProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex gap-2 opacity-30 transition-opacity hover:opacity-100 focus-within:opacity-100">
      <Button variant="secondary" onClick={onToggleReveal}>
        {revealed ? 'Hide results' : 'Reveal results'}
      </Button>
      <Button variant="ghost" onClick={onExit}>
        Exit
      </Button>
    </div>
  );
}
