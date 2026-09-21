import { useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Logo } from '../components/common/Logo';
import { PrivacyLink } from '../components/common/PrivacyLink';
import { signInWithGoogle } from '../hooks/useAuthSession';
import { useReturnTo } from '../hooks/useReturnTo';

// Email OTP sign-in is implemented (see useAuthSession's sendEmailCode/verifyEmailCode) but
// not offered here — the cloud project's default Supabase email sender is rate-limited hard
// (a handful of emails/hour) and not meant for production volume; re-add once real SMTP is
// configured (Dashboard → Authentication → Emails → SMTP Settings) and the magic-link email
// template is swapped for the code-focused one already in supabase/templates/magic_link.html.
export function SignInPage() {
  const returnTo = useReturnTo();
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    try {
      await signInWithGoogle(returnTo);
    } catch {
      setError('Could not start Google sign-in. Please try again.');
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
      <Logo className="h-8 w-auto" />
      <Card className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-ink-950">Sign in</h1>
          <p className="mt-1 text-sm text-ink-500">Sign in to create and manage your polls.</p>
        </div>

        <Button type="button" variant="secondary" className="w-full" onClick={handleGoogle}>
          Continue with Google
        </Button>

        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </Card>
      <PrivacyLink className="absolute bottom-4 right-4" />
    </div>
  );
}
