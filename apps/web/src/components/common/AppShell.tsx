import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Logo } from './Logo';
import { PrivacyLink } from './PrivacyLink';
import { signOut } from '../../hooks/useAuthSession';

interface AppShellProps {
  children: ReactNode;
  action?: ReactNode;
}

// Used on every authenticated organiser route (Dashboard/Create/Manage) — the one place a
// sign-out control needs to live so it's available everywhere without each page wiring it up.
export function AppShell({ children, action }: AppShellProps) {
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <div className="min-h-dvh bg-ink-100/40">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            to="/dashboard"
            className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
          >
            <Logo className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            {action}
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded px-2 py-1 text-sm font-medium text-ink-500 hover:text-ink-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      {/* Hidden behind FormActionBar on pages that render one (Create, Manage-draft) — those
          pages get their own copy via FormActionBar's own PrivacyLink instead. */}
      <footer className="mx-auto max-w-5xl px-4 pb-6 text-right sm:px-6">
        <PrivacyLink />
      </footer>
    </div>
  );
}
