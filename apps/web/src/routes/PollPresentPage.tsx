import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PresentationJoinView } from '../components/presentation/PresentationJoinView';
import { PresentationResultsView } from '../components/presentation/PresentationResultsView';
import { PresentationControls } from '../components/presentation/PresentationControls';
import { apiClient } from '../lib/apiClient';
import { buildVoteUrl } from '../lib/urlBuilder';
import type { OwnerPollDetail, ParticipantResultOption } from '../lib/types';

const POLL_INTERVAL_MS = 2000;

function revealKey(id: string) {
  return `crowdping:reveal:${id}`;
}

/**
 * Reveal/hide is presenter-local display state only (localStorage), never
 * sent to the server — it must never change what a participant is allowed
 * to fetch (PRD A12).
 */
export function PollPresentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [poll, setPoll] = useState<OwnerPollDetail | null>(null);
  const [percentages, setPercentages] = useState<ParticipantResultOption[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    try {
      setRevealed(localStorage.getItem(revealKey(id)) === '1');
    } catch {
      // localStorage unavailable — default to hidden, non-fatal.
    }
    apiClient.organiser
      .getPoll(id)
      .then(setPoll)
      .catch(() => setError('Could not load this poll.'));
  }, [id]);

  const toggleReveal = useCallback(() => {
    if (!id) return;
    setRevealed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(revealKey(id), next ? '1' : '0');
      } catch {
        // Non-fatal — reveal state just won't survive a refresh.
      }
      return next;
    });
  }, [id]);

  useEffect(() => {
    if (!id || !revealed || !poll) return;
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    async function fetchResults() {
      try {
        const ownerResults = await apiClient.organiser.getResults(id as string);
        if (!active) return;
        setPercentages(ownerResults.options.map((o) => ({ optionId: o.optionId, percentage: o.percentage })));
        if (ownerResults.status !== 'closed' && document.visibilityState === 'visible') {
          timeoutId = setTimeout(fetchResults, POLL_INTERVAL_MS);
        }
      } catch {
        if (active) timeoutId = setTimeout(fetchResults, POLL_INTERVAL_MS);
      }
    }

    fetchResults();
    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [id, revealed, poll]);

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p role="alert" className="text-red-700">
          {error}
        </p>
      </div>
    );
  }

  if (!poll || !id) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-ink-500">Loading…</p>
      </div>
    );
  }

  const voteUrl = poll.code ? buildVoteUrl(poll.code) : '';

  return (
    <div className="relative">
      {revealed ? (
        <PresentationResultsView
          question={poll.question}
          code={poll.code ?? ''}
          voteUrl={voteUrl}
          options={poll.options}
          percentages={percentages}
        />
      ) : (
        <PresentationJoinView question={poll.question} code={poll.code ?? ''} voteUrl={voteUrl} />
      )}
      {poll.status === 'closed' && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-ink-950 px-4 py-1.5 text-sm font-medium text-white">
          Voting has closed — final results
        </div>
      )}
      <PresentationControls
        revealed={revealed}
        onToggleReveal={toggleReveal}
        onExit={() => navigate(`/polls/${id}`)}
      />
    </div>
  );
}
