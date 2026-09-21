import { useState } from 'react';
import * as RadioGroup from '@radix-ui/react-radio-group';
import { RadioCard } from '../common/RadioCard';
import { Button } from '../common/Button';
import { LiveRegion } from '../common/LiveRegion';
import { ConfettiBurst } from '../common/ConfettiBurst';
import { apiClient, ApiClientError } from '../../lib/apiClient';
import type { MyVote, PublicPoll } from '../../lib/types';

interface BallotFormProps {
  code: string;
  poll: PublicPoll;
  myVote: MyVote | null;
  onVoted: (vote: MyVote) => void;
}

type SubmitState = 'idle' | 'saving' | 'failed';

/**
 * Handles both the first-vote and change-vote flows. Never mutates on a mere
 * selection change while reviewing a saved answer — "Save change" is always
 * an explicit, separate action (PRD §4).
 */
export function BallotForm({ code, poll, myVote, onVoted }: BallotFormProps) {
  const [editing, setEditing] = useState(myVote === null);
  // Radix's RadioGroup treats `undefined` as "uncontrolled" — starting from `null`/`undefined`
  // and later setting a real value trips its controlled/uncontrolled switch warning. Empty
  // string keeps it controlled from the first render while still meaning "nothing selected".
  const [selected, setSelected] = useState<string>(myVote?.optionId ?? '');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [announcement, setAnnouncement] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);

  const isClosed = poll.status !== 'open';

  async function handleSubmit() {
    if (!selected) return;
    const isFirstVote = myVote === null;
    setSubmitState('saving');
    setErrorMessage(null);
    try {
      const expectedRevision = myVote ? myVote.revision : 0;
      const saved = await apiClient.submitVote(code, selected, expectedRevision);
      setSubmitState('idle');
      setEditing(false);
      setAnnouncement('Vote recorded.');
      // Only the first vote gets the celebration — a revote is routine, not an event.
      if (isFirstVote) setCelebrating(true);
      onVoted(saved);
    } catch (err) {
      setSubmitState('failed');
      if (err instanceof ApiClientError && err.code === 'REVISION_CONFLICT') {
        if (err.current) setSelected(err.current.optionId);
        setErrorMessage(
          'Your answer changed elsewhere. Showing the current saved answer — try again if you still want to change it.',
        );
      } else if (err instanceof ApiClientError && err.code === 'POLL_CLOSED') {
        setErrorMessage('Voting has just closed.');
      } else {
        setErrorMessage('Something went wrong. Your selection is kept — try again.');
      }
      setAnnouncement('Vote not saved. Please try again.');
    }
  }

  const confetti = celebrating && <ConfettiBurst onDone={() => setCelebrating(false)} />;

  if (!editing && myVote) {
    const votedLabel = poll.options.find((o) => o.id === myVote.optionId)?.label ?? '';
    return (
      <>
        {confetti}
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-success-600/10 px-4 py-3.5 text-sm font-medium text-success-600">
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5 shrink-0"
            >
              <path
                fillRule="evenodd"
                d="M16.704 5.29a1 1 0 010 1.415l-7.5 7.5a1 1 0 01-1.415 0l-3.5-3.5a1 1 0 111.415-1.415L8.5 12.086l6.79-6.79a1 1 0 011.415 0z"
                clipRule="evenodd"
              />
            </svg>
            <span>
              Vote recorded: <span className="font-semibold">{votedLabel}</span>
            </span>
          </div>
          {!isClosed && (
            <Button
              variant="secondary"
              onClick={() => {
                setSelected(myVote.optionId);
                setEditing(true);
              }}
            >
              Change my answer
            </Button>
          )}
          <LiveRegion message={announcement} />
        </div>
      </>
    );
  }

  return (
    <>
      {confetti}
      <div className="space-y-6">
        <RadioGroup.Root
          value={selected}
          onValueChange={setSelected}
          className="flex flex-col gap-3"
          aria-label={poll.question}
          disabled={isClosed || submitState === 'saving'}
        >
          {poll.options.map((option) => (
            <RadioCard key={option.id} value={option.id} label={option.label} />
          ))}
        </RadioGroup.Root>

        {errorMessage && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {errorMessage}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSubmit}
            disabled={!selected || isClosed || submitState === 'saving'}
            size="lg"
            className="w-full sm:w-auto"
          >
            {submitState === 'saving' ? 'Saving…' : myVote ? 'Save change' : 'Submit vote'}
          </Button>
          {myVote && (
            <Button
              variant="ghost"
              onClick={() => {
                setSelected(myVote.optionId);
                setEditing(false);
                setErrorMessage(null);
              }}
            >
              Cancel
            </Button>
          )}
        </div>

        <LiveRegion message={announcement} assertive={submitState === 'failed'} />
      </div>
    </>
  );
}
