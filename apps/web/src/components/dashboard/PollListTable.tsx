import { Link } from 'react-router';
import type { OwnerPollSummary } from '../../lib/types';
import { PollStatusBadge } from './PollStatusBadge';

interface PollListTableProps {
  polls: OwnerPollSummary[];
}

export function PollListTable({ polls }: PollListTableProps) {
  if (polls.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-display text-xl font-bold tracking-tight text-ink-950">Nothing here yet.</p>
        <p className="mt-1 text-ink-500">Ask the room something — it takes about a minute.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-ink-100">
      {polls.map((poll) => (
        <li key={poll.id}>
          <Link
            to={`/polls/${poll.id}`}
            className="-mx-3 flex items-center justify-between gap-4 rounded-[var(--radius-md)] px-3 py-4 transition-colors hover:bg-ink-100/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          >
            <div className="min-w-0">
              <p className="truncate font-display text-base font-medium tracking-tight text-ink-950">
                {poll.question}
              </p>
              <p className="text-sm text-ink-500">
                {new Date(poll.createdAt).toLocaleDateString()} ·{' '}
                <span className="font-mono">{poll.responseCount}</span> response
                {poll.responseCount === 1 ? '' : 's'}
              </p>
            </div>
            <PollStatusBadge status={poll.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
