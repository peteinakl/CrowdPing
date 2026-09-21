import { QrCodeDisplay } from './QrCodeDisplay';
import { displayVoteUrl } from '../../lib/urlBuilder';

interface PresentationJoinViewProps {
  question: string;
  code: string;
  voteUrl: string;
}

// No header logo here — the brand mark now lives inside the QR code itself (QrCodeDisplay /
// lib/qr.ts), so the join screen's header stays dedicated to the question per PRD §4's
// "prioritise the question, a very large QR code and its URL".
export function PresentationJoinView({ question, code, voteUrl }: PresentationJoinViewProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-white px-8 py-12 text-center">
      <h1
        className="max-w-5xl font-display font-bold tracking-tight text-ink-950"
        style={{ fontSize: 'clamp(2rem, 5vw, 4.5rem)', lineHeight: 1.1 }}
      >
        {question}
      </h1>
      {/* The signature broadcast moment — a real beacon, not a hint. A soft glow plus two bold
          rings, radiating outward from the code, echoing the brand mark's own arcs. Purely
          ambient (aria-hidden). Everything here starts at 130% of the QR's own size — a large,
          unambiguous gap at every point of the cycle, so it never touches the QR's quiet zone
          (a tighter version was tried and rejected: it visibly intersected the quiet zone and
          broke a real decode test — verify with a fresh decode test after touching these
          numbers, don't just eyeball it). Inert under reduced-motion. */}
      <div className="relative flex items-center justify-center">
        <div
          aria-hidden
          className="motion-safe:absolute motion-safe:inset-0 motion-safe:m-auto motion-safe:aspect-square motion-safe:w-[130%] motion-safe:rounded-[3rem] motion-safe:bg-accent-600/25 motion-safe:blur-3xl motion-safe:[animation:broadcast-glow_3s_ease-out_infinite]"
        />
        <div
          aria-hidden
          className="motion-safe:absolute motion-safe:inset-0 motion-safe:m-auto motion-safe:aspect-square motion-safe:w-[130%] motion-safe:rounded-[3rem] motion-safe:border-[3px] motion-safe:border-accent-600/70 motion-safe:[animation:broadcast-ring_3s_ease-out_infinite]"
        />
        <div
          aria-hidden
          className="motion-safe:absolute motion-safe:inset-0 motion-safe:m-auto motion-safe:aspect-square motion-safe:w-[130%] motion-safe:rounded-[3rem] motion-safe:border-[3px] motion-safe:border-accent-600/70 motion-safe:[animation:broadcast-ring_3s_ease-out_1.5s_infinite]"
        />
        <QrCodeDisplay url={voteUrl} className="relative" />
      </div>
      <p className="font-mono text-2xl font-semibold text-ink-700 sm:text-3xl">{displayVoteUrl(code)}</p>
    </div>
  );
}
