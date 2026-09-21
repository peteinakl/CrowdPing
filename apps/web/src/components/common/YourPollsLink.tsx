import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuthSession } from '../../hooks/useAuthSession';
import { apiClient } from '../../lib/apiClient';
import { buttonClasses } from './Button';

// Used on the landing page (lazy-loaded there, see LandingPage.tsx) and directly in AppShell's
// action slot on the create/manage screens, for consistent navigation back to the dashboard.
// Shows only once the signed-in organiser actually has a poll to go back to — an empty
// dashboard isn't a useful destination, and on the create screen specifically it would be
// pointing a brand-new organiser at nothing.
export function YourPollsLink() {
  const { session, loading } = useAuthSession();
  const [hasPolls, setHasPolls] = useState(false);

  useEffect(() => {
    if (loading || !session) {
      setHasPolls(false);
      return;
    }
    let active = true;
    apiClient.organiser
      .listPolls(0)
      .then((result) => {
        if (active) setHasPolls(result.items.length > 0);
      })
      .catch(() => {
        if (active) setHasPolls(false);
      });
    return () => {
      active = false;
    };
  }, [loading, session]);

  if (loading || !session || !hasPolls) return null;

  return (
    <Link to="/dashboard" className={buttonClasses('secondary', 'md')}>
      Your polls
    </Link>
  );
}
