import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { Logo } from '../components/common/Logo';
import { BallotForm } from '../components/ballot/BallotForm';
import { BallotStateBanner } from '../components/ballot/BallotStateBanner';
import { ResultsBarChart } from '../components/results/ResultsBarChart';
import { LastUpdatedIndicator } from '../components/results/LastUpdatedIndicator';
import { StaleBadge } from '../components/results/StaleBadge';
import { CreatePollInviteLink } from '../components/common/CreatePollInviteLink';
import { useVoterSession } from '../hooks/useVoterSession';
import { useMyVote } from '../hooks/useMyVote';
import { useResultsPolling } from '../hooks/useResultsPolling';
import { apiClient } from '../lib/apiClient';
import type { MyVote, PublicPoll } from '../lib/types';

export function ParticipatePage() {
  const { code } = useParams<{ code: string }>();
  const safeCode = code ?? '';

  const session = useVoterSession(safeCode);
  const [poll, setPoll] = useState<PublicPoll | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!session.ready) return;
    let active = true;
    apiClient
      .getPoll(safeCode)
      .then((result) => {
        if (active) setPoll(result);
      })
      .catch(() => {
        if (active) setUnavailable(true);
      });
    return () => {
      active = false;
    };
  }, [safeCode, session.ready]);

  const myVote = useMyVote(safeCode, session.ready && poll !== null);

  const resultsEligible =
    poll !== null &&
    myVote.vote !== null &&
    (poll.participantResultsMode === 'after_vote' || poll.status !== 'open');
  const resultsPolling = useResultsPolling(safeCode, resultsEligible);

  function handleVoted(vote: MyVote) {
    myVote.setVote(vote);
  }

  let content: ReactNode;

  if (session.error || unavailable) {
    content = <BallotStateBanner state="unavailable" />;
  } else if (!session.ready || !poll || myVote.loading) {
    content = <BallotStateBanner state="loading" />;
  } else if (poll.status !== 'open' && myVote.vote === null) {
    content = <BallotStateBanner state="closed" />;
  } else {
    const pendingResults = poll.participantResultsMode === 'after_close' && poll.status === 'open';
    content = (
      <div className="space-y-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-950 sm:text-[1.75rem]">
          {poll.question}
        </h1>
        <BallotForm code={safeCode} poll={poll} myVote={myVote.vote} onVoted={handleVoted} />

        {myVote.vote && (
          <div className="space-y-3 border-t border-ink-100 pt-6">
            {pendingResults ? (
              <p className="text-sm text-ink-500">Results will be available when voting closes.</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-sm font-semibold tracking-tight text-ink-950">Results</h2>
                  <StaleBadge stale={resultsPolling.stale} />
                </div>
                <ResultsBarChart options={poll.options} percentages={resultsPolling.results?.options ?? null} />
                <LastUpdatedIndicator lastUpdated={resultsPolling.lastUpdated} />
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white">
      <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-8 px-4 py-10">
        <Logo className="h-7 w-auto" />
        {content}
        <div className="mt-auto pt-8 text-center">
          <CreatePollInviteLink />
        </div>
      </div>
    </div>
  );
}
