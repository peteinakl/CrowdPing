import { Link } from 'react-router';

/**
 * Required exact link text (PRD §4/§9). Visually secondary but with a
 * generous tap area — "small means unobtrusive, not inaccessible."
 */
export function CreatePollInviteLink() {
  return (
    <Link
      to="/polls/new"
      className="inline-flex min-h-12 items-center justify-center rounded-full px-2 py-3 text-sm font-medium text-ink-500 underline decoration-ink-300 underline-offset-4 transition-colors hover:text-accent-600 hover:decoration-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600"
    >
      Create your own CrowdPing poll →
    </Link>
  );
}
