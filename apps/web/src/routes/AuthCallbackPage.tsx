import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuthSession } from '../hooks/useAuthSession';
import { useReturnTo } from '../hooks/useReturnTo';

/** Google OAuth lands here; returnTo is validated by useReturnTo (rejects open redirects, PRD A21). */
export function AuthCallbackPage() {
  const { session, loading } = useAuthSession();
  const returnTo = useReturnTo();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) {
      navigate(returnTo, { replace: true });
    }
  }, [loading, session, returnTo, navigate]);

  if (!loading && !session) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="font-medium text-ink-950">Sign-in didn't complete.</p>
        <Link to="/sign-in" className="font-medium text-accent-600 underline">
          Try again
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <p className="text-ink-500">Signing you in…</p>
    </div>
  );
}
