function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

/**
 * Enforces the canonical-origin rules from the PRD's "Canonical base URL and
 * environments" section: absolute origin, no userinfo/query/fragment/path
 * prefix, HTTPS except for explicitly configured localhost development.
 */
function assertCanonicalOrigin(name: string, value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL, got: "${value}"`);
  }

  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error(`${name} must not include a path, got: "${value}"`);
  }
  if (url.search || url.hash || url.username || url.password) {
    throw new Error(`${name} must not include a query string, fragment, or userinfo, got: "${value}"`);
  }

  const isLocalhost = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalhost)) {
    throw new Error(`${name} must use HTTPS (HTTP is only allowed for localhost development), got: "${value}"`);
  }

  return url.origin;
}

export const env = {
  appBaseUrl: assertCanonicalOrigin('VITE_APP_BASE_URL', required('VITE_APP_BASE_URL', import.meta.env.VITE_APP_BASE_URL)),
  supabaseUrl: required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  supabasePublishableKey: required(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ),
};
