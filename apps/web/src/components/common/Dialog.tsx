import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Small all-caps label above the title — the dialog's one moment of real voice. */
  eyebrow: string;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  variant?: 'primary' | 'danger';
  children?: ReactNode;
}

const ICON_PATHS: Record<'primary' | 'danger', string> = {
  // Rocket — going live.
  primary:
    'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2zM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
  // Bold stop octagon — this changes things for real.
  danger:
    'M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z',
};

function DialogIcon({ variant }: { variant: 'primary' | 'danger' }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-9 w-9"
    >
      <path d={ICON_PATHS[variant]} />
    </svg>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  eyebrow,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = 'primary',
  children,
}: ConfirmDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink-950/55 data-[state=open]:animate-[overlay-in_180ms_ease-out]" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[var(--radius-lg)] bg-white [box-shadow:var(--shadow-card-hover)] focus:outline-none data-[state=open]:animate-[dialog-in_260ms_var(--ease-spring)] data-[state=closed]:motion-safe:animate-[dialog-out_120ms_ease-in]">
          {/* The one bold graphic moment: a full-bleed colour block, not a polite grey box. */}
          <div
            className={`flex items-center gap-4 px-6 py-7 text-white ${
              variant === 'danger' ? 'bg-accent-600' : 'bg-ink-950'
            }`}
          >
            <DialogIcon variant={variant} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">{eyebrow}</p>
              <DialogPrimitive.Title className="font-display text-2xl font-bold leading-tight tracking-tight">
                {title}
              </DialogPrimitive.Title>
            </div>
          </div>
          <div className="p-6">
            <DialogPrimitive.Description className="text-base text-ink-700">{description}</DialogPrimitive.Description>
            {children}
            <div className="mt-6 flex justify-end gap-3">
              <DialogPrimitive.Close asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogPrimitive.Close>
              <Button variant={variant} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
