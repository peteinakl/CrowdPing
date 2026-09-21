export type BallotBannerState = 'loading' | 'closed' | 'unavailable';

const COPY: Record<BallotBannerState, string> = {
  loading: 'Loading poll…',
  closed: 'Voting has closed.',
  unavailable: 'Poll unavailable.',
};

/** Coarse page-level states. Submit-level saving/saved/failed feedback lives in BallotForm. */
export function BallotStateBanner({ state }: { state: BallotBannerState }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-ink-100 px-4 py-3 text-sm font-medium text-ink-700">
      {COPY[state]}
    </div>
  );
}
