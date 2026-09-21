import { useState } from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Logo } from '../components/common/Logo';
import { signInWithGoogle } from '../hooks/useAuthSession';
import { useReturnTo } from '../hooks/useReturnTo';

// Email OTP sign-in is implemented (see useAuthSession's sendEmailCode/verifyEmailCode) but
// deliberately not offered here right now — Google-only per an explicit, current-phase product
// decision. Re-add the email form if/when that changes; nothing else depends on hiding it.
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
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4">
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
    </div>
  );
}
