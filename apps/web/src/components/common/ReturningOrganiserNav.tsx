import { Link } from 'react-router';
import { useAuthSession } from '../../hooks/useAuthSession';
import { buttonClasses } from './Button';

// Lazy-loaded from LandingPage (see App.tsx's bundle-splitting comment) so the entry page never
// pays for supabase-js unless someone actually already has a session. Renders nothing while
// loading or signed out — the static "Organiser sign in" footer link already covers that case.
export function ReturningOrganiserNav() {
  const { session, loading } = useAuthSession();

  if (loading || !session) return null;

  return (
    <Link to="/dashboard" className={buttonClasses('secondary', 'md')}>
      Your polls
    </Link>
  );
}
