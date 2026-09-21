import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AppShell } from '../components/common/AppShell';
import { buttonClasses } from '../components/common/Button';
import { PollListTable } from '../components/dashboard/PollListTable';
import { Pagination } from '../components/dashboard/Pagination';
import { apiClient } from '../lib/apiClient';
import type { OwnerPollSummary } from '../lib/types';

export function DashboardPage() {
  const [page, setPage] = useState(0);
  const [polls, setPolls] = useState<OwnerPollSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiClient.organiser
      .listPolls(page)
      .then((result) => {
        if (!active) return;
        setPolls(result.items);
        setHasMore(result.hasMore);
        setError(null);
      })
      .catch(() => {
        if (active) setError('Could not load your polls.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page]);

  return (
    <AppShell
      action={
        <Link to="/polls/new" className={buttonClasses('primary', 'md')}>
          Create a poll
        </Link>
      }
    >
      <h1 className="mb-6 font-display text-3xl font-bold tracking-tight text-ink-950">My polls</h1>
      {loading && <p className="text-ink-500">Loading…</p>}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!loading && !error && (
        <>
          <PollListTable polls={polls} />
          <Pagination page={page} hasMore={hasMore} onPageChange={setPage} />
        </>
      )}
    </AppShell>
  );
}
