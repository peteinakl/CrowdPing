import { Link } from 'react-router';
import { Logo } from '../components/common/Logo';
import { buttonClasses } from '../components/common/Button';

export function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-4 py-6 sm:px-6">
        <Logo className="h-8 w-auto" />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 text-center">
        <h1 className="max-w-xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink-950 sm:text-5xl">
          Ask a question. Project a QR code. Watch the room answer <span className="text-accent-600">live</span>.
        </h1>
        <p className="max-w-md text-lg text-ink-600">
          CrowdPing turns any room into an instant poll — no app and no sign-up for your audience, just a scan and a
          tap.
        </p>
        <Link to="/polls/new" className={buttonClasses('primary', 'lg')}>
          Create a poll
        </Link>
      </main>
      <footer className="px-4 py-6 text-center text-sm text-ink-300 sm:px-6">
        <Link to="/sign-in" className="hover:text-ink-500">
          Organiser sign in
        </Link>
      </footer>
    </div>
  );
}
