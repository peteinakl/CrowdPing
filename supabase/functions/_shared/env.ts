// Fail-fast environment validation for both Edge Functions. Supabase auto-injects
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY for every function; everything
// else here is a project secret set via `supabase secrets set` (local: supabase/.env or
// `supabase start` defaults — see docs/ENVIRONMENT.md).

export interface BackendEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  allowedOrigins: string[];
  voterCookieSigningKeys: string[]; // current key first, for rotation
  voterKeyDerivationKey: string;
  cookieSecure: boolean;
}

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

let cached: BackendEnv | undefined;

export function loadEnv(): BackendEnv {
  if (cached) return cached;

  const allowedOrigins = splitList(required('ALLOWED_APP_ORIGINS'));
  if (allowedOrigins.length === 0) {
    throw new Error('ALLOWED_APP_ORIGINS must list at least one origin');
  }

  const voterCookieSigningKeys = splitList(required('VOTER_COOKIE_SIGNING_KEYS'));
  if (voterCookieSigningKeys.length === 0) {
    throw new Error('VOTER_COOKIE_SIGNING_KEYS must list at least one key (current first)');
  }

  const cookieSecure = (Deno.env.get('COOKIE_SECURE') ?? 'true').toLowerCase() !== 'false';
  if (!cookieSecure) {
    const nonLocalOrigin = allowedOrigins.find(
      (origin) => !origin.includes('127.0.0.1') && !origin.includes('localhost'),
    );
    if (nonLocalOrigin) {
      throw new Error(
        `COOKIE_SECURE=false is only allowed for localhost development, but ALLOWED_APP_ORIGINS includes ${nonLocalOrigin}`,
      );
    }
  }

  cached = {
    supabaseUrl: required('SUPABASE_URL'),
    supabaseAnonKey: required('SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    allowedOrigins,
    voterCookieSigningKeys,
    voterKeyDerivationKey: required('VOTER_KEY_DERIVATION_KEY'),
    cookieSecure,
  };
  return cached;
}
