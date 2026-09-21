import type { ReactNode } from 'react';
import { PrivacyLink } from './PrivacyLink';

interface FormActionBarProps {
  children: ReactNode;
}

/**
 * Pins its contents to the viewport bottom so form actions (Save/Publish/Delete) stay reachable
 * regardless of form length or scroll position — a freshly-created draft lands scrolled to the
 * top, and with up to 8 answer choices the form above these actions can run well past the fold.
 * z-30 stays below Dialog/Toast (z-40/z-50) so confirm dialogs and toasts always layer above it.
 */
export function FormActionBar({ children }: FormActionBarProps) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-100 bg-white [box-shadow:0_-1px_2px_rgba(21,20,23,0.04),0_-12px_28px_-8px_rgba(21,20,23,0.10)]"
    >
      <div
        className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-4 sm:px-6"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        {children}
        {/* This bar covers the whole viewport width, so AppShell's own footer copy of this
            link is permanently hidden behind it on pages that render one — this is the copy
            that's actually visible there. */}
        <PrivacyLink className="ml-auto" />
      </div>
    </div>
  );
}
