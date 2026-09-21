import { Link } from 'react-router';
import { Logo } from '../components/common/Logo';
import { PrivacyLink } from '../components/common/PrivacyLink';

export function NotFoundPage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo className="h-8 w-auto" />
      <p className="text-lg font-medium text-ink-950">Page not found.</p>
      <Link to="/" className="font-medium text-accent-600 underline">
        Back to CrowdPing
      </Link>
      <PrivacyLink className="absolute bottom-4 right-4" />
    </div>
  );
}
