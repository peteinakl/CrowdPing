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
      {/* Deliberately plain: at a real event people need to scan this quickly and accurately —
          ambient motion around the code competes with that rather than helping. A prior version
          had a pulsing glow/ring here; removed after live testing (see docs/DEVIATIONS.md). */}
      <QrCodeDisplay url={voteUrl} />
      <p className="font-mono text-2xl font-semibold text-ink-700 sm:text-3xl">{displayVoteUrl(code)}</p>
    </div>
  );
}
