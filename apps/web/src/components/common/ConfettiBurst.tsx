import { useEffect, useMemo } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface ConfettiBurstProps {
  onDone: () => void;
}

const PIECE_COUNT = 22;
// Brand palette, not generic rainbow confetti — the "one strong accent" system extends here too.
const COLORS = ['var(--color-accent-600)', 'var(--color-accent-700)', 'var(--color-ink-950)'];

interface Piece {
  tx: number;
  ty: number;
  rot: number;
  duration: number;
  delay: number;
  color: string;
  left: number;
}

/** A brief celebratory burst for the two moments that deserve one: going live, and a first vote. */
export function ConfettiBurst({ onDone }: ConfettiBurstProps) {
  const reducedMotion = usePrefersReducedMotion();

  const pieces = useMemo<Piece[]>(() => {
    return Array.from({ length: PIECE_COUNT }, (_, i) => {
      const angle = (i / PIECE_COUNT) * Math.PI + Math.random() * 0.4;
      const spread = 70 + Math.random() * 90;
      return {
        tx: Math.cos(angle) * spread,
        ty: Math.abs(Math.sin(angle)) * spread + 60 + Math.random() * 60,
        rot: 180 + Math.random() * 540,
        duration: 0.9 + Math.random() * 0.5,
        delay: Math.random() * 0.12,
        color: COLORS[i % COLORS.length] as string,
        left: 50 + (Math.random() - 0.5) * 30,
      };
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(onDone, reducedMotion ? 0 : 1500);
    return () => clearTimeout(timer);
  }, [onDone, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0 overflow-visible">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 h-2.5 w-1.5 rounded-[1px]"
          style={
            {
              left: `${p.left}%`,
              backgroundColor: p.color,
              '--tx': `${p.tx}px`,
              '--ty': `${p.ty}px`,
              '--rot': `${p.rot}deg`,
              animation: `confetti-fall ${p.duration}s cubic-bezier(0.25,0.6,0.4,1) ${p.delay}s forwards`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
