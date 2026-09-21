import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { ToastProvider } from './components/common/Toast';
import { LandingPage } from './routes/LandingPage';
import { ParticipatePage } from './routes/ParticipatePage';
import { NotFoundPage } from './routes/NotFoundPage';

// Organiser/auth routes are lazy-loaded: they pull in @supabase/supabase-js and the Radix
// dialog/toast primitives, which the voter-only ballot path (the PRD's strict mobile LCP
// target, §13) shouldn't have to download. Landing/Participate/NotFound stay eager since
// they're the links people actually scan a QR code into. RequireAuth itself imports the auth
// hook (→ supabase-js), so it must be lazy too — importing it eagerly here would pull
// supabase-js back into the shared/voter bundle regardless of the page-level splitting below.
const RequireAuth = lazy(() =>
  import('./components/common/RequireAuth').then((m) => ({ default: m.RequireAuth })),
);
const SignInPage = lazy(() => import('./routes/SignInPage').then((m) => ({ default: m.SignInPage })));
const AuthCallbackPage = lazy(() =>
  import('./routes/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage })),
);
const DashboardPage = lazy(() => import('./routes/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const PollCreatePage = lazy(() => import('./routes/PollCreatePage').then((m) => ({ default: m.PollCreatePage })));
const PollManagePage = lazy(() => import('./routes/PollManagePage').then((m) => ({ default: m.PollManagePage })));
const PollPresentPage = lazy(() =>
  import('./routes/PollPresentPage').then((m) => ({ default: m.PollPresentPage })),
);

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/sign-in" element={<SignInPage />} />
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <DashboardPage />
                </RequireAuth>
              }
            />
            <Route
              path="/polls/new"
              element={
                <RequireAuth>
                  <PollCreatePage />
                </RequireAuth>
              }
            />
            <Route
              path="/polls/:id"
              element={
                <RequireAuth>
                  <PollManagePage />
                </RequireAuth>
              }
            />
            <Route
              path="/polls/:id/present"
              element={
                <RequireAuth>
                  <PollPresentPage />
                </RequireAuth>
              }
            />
            <Route path="/p/:code" element={<ParticipatePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ToastProvider>
  );
}
