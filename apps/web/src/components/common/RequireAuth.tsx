import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuthSession } from '../../hooks/useAuthSession';

/** Redirects unauthenticated visitors to sign-in and back to the original destination (PRD O1). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuthSession();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-ink-500">Loading…</p>
      </div>
    );
  }

  if (!session) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/sign-in?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
}
