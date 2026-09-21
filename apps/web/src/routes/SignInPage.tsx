import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Logo } from '../components/common/Logo';
import { sendEmailCode, verifyEmailCode, signInWithGoogle } from '../hooks/useAuthSession';
import { useReturnTo } from '../hooks/useReturnTo';
import { useToast } from '../components/common/Toast';

type Stage = 'start' | 'code-sent';

export function SignInPage() {
  const returnTo = useReturnTo();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<Stage>('start');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    try {
      await signInWithGoogle(returnTo);
    } catch {
      setError('Could not start Google sign-in. Please try again.');
    }
  }

  async function handleSendCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sendEmailCode(email);
      setStage('code-sent');
    } catch {
      setError('Could not send a code to that address. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await verifyEmailCode(email, code);
      showToast("You're in.");
      navigate(returnTo, { replace: true });
    } catch {
      setError("That code didn't work. It may have expired — request a new one.");
    } finally {
      setBusy(false);
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

        <div className="flex items-center gap-3 text-xs uppercase text-ink-300">
          <span className="h-px flex-1 bg-ink-100" />
          or
          <span className="h-px flex-1 bg-ink-100" />
        </div>

        {stage === 'start' && (
          <form className="space-y-3" onSubmit={handleSendCode}>
            <label htmlFor="email" className="block text-sm font-medium text-ink-950">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-12 w-full rounded-[var(--radius-md)] border-2 border-ink-100 px-4 py-2 text-base focus:border-accent-600 focus:outline-none"
              placeholder="you@example.com"
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Sending…' : 'Continue with email'}
            </Button>
          </form>
        )}

        {stage === 'code-sent' && (
          <form className="space-y-3" onSubmit={handleVerifyCode}>
            <p className="text-sm text-ink-500">Enter the 6-digit code we sent to {email}.</p>
            <label htmlFor="code" className="block text-sm font-medium text-ink-950">
              Code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="min-h-12 w-full rounded-[var(--radius-md)] border-2 border-ink-100 px-4 py-2 text-base tracking-widest focus:border-accent-600 focus:outline-none"
              placeholder="123456"
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Verifying…' : 'Verify code'}
            </Button>
            <button
              type="button"
              onClick={() => setStage('start')}
              className="w-full text-center text-sm text-ink-500 underline"
            >
              Use a different email
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
