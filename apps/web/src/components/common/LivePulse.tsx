/**
 * The one deliberate motion signature (see frontend design notes) — a small radiating ring
 * echoing the brand mark's own broadcast-arc glyph. Used sparingly, only on genuinely "this is
 * happening right now" states (an open poll, live results) — never decorative. Fully inert
 * under prefers-reduced-motion via the motion-safe: variant.
 */
export function LivePulse({ className = '' }: { className?: string }) {
  return (
    <span className={`relative inline-flex h-2.5 w-2.5 shrink-0 ${className}`} aria-hidden>
      <span className="motion-safe:absolute motion-safe:inset-0 motion-safe:inline-flex motion-safe:h-full motion-safe:w-full motion-safe:rounded-full motion-safe:bg-accent-600 motion-safe:[animation:ping-ring_1.8s_cubic-bezier(0,0,0.2,1)_infinite]" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-600" />
    </span>
  );
}
