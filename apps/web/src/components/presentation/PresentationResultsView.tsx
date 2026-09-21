import { QrCodeDisplay } from './QrCodeDisplay';
import { ResultsBarChart } from '../results/ResultsBarChart';
import { displayVoteUrl } from '../../lib/urlBuilder';
import type { ParticipantResultOption, PollOption } from '../../lib/types';

interface PresentationResultsViewProps {
  question: string;
  code: string;
  voteUrl: string;
  options: PollOption[];
  percentages: ParticipantResultOption[] | null;
}

/** QR and URL stay visible alongside results so late arrivals can still join (PRD §4). */
export function PresentationResultsView({
  question,
  code,
  voteUrl,
  options,
  percentages,
}: PresentationResultsViewProps) {
  return (
    <div className="flex min-h-dvh flex-col gap-8 bg-white px-8 py-10">
      <h1
        className="text-center font-display font-bold tracking-tight text-ink-950"
        style={{ fontSize: 'clamp(1.75rem, 4vw, 3.25rem)' }}
      >
        {question}
      </h1>
      <div className="grid flex-1 grid-cols-1 items-center gap-10 lg:grid-cols-[2fr_1fr]">
        <div className="mx-auto w-full max-w-3xl">
          <ResultsBarChart options={options} percentages={percentages} size="large" />
        </div>
        <div className="flex flex-col items-center justify-self-center gap-4">
          <QrCodeDisplay url={voteUrl} className="max-w-full" />
          <p className="font-mono text-lg font-semibold text-ink-700">{displayVoteUrl(code)}</p>
        </div>
      </div>
    </div>
  );
}
