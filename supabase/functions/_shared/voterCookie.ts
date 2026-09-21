// Signed, stateless voter credential (PRD §10). The cookie carries a random secret plus an
// HMAC signature; the poll-specific `voter_key_hash` stored in the database is a SEPARATE
// derivation so a leaked hash can never be used to reconstruct the cookie or vote as that
// browser elsewhere. Key rotation: VOTER_COOKIE_SIGNING_KEYS is an ordered list, current key
// first; verification tries each in turn so old cookies keep working during a rotation
// window without invalidating active ballots.

export const VOTER_COOKIE_NAME = 'cp_voter';
const SECRET_BYTES = 32;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacSha256(key: string, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(signature);
}

export function parseCookieHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) return rest.join('=');
  }
  return null;
}

/** Signs an existing secret under a given key, producing the cookie's wire value. */
export async function signSecret(secret: Uint8Array, signingKey: string): Promise<string> {
  const signature = await hmacSha256(signingKey, secret);
  return `${bytesToBase64Url(secret)}.${bytesToBase64Url(signature)}`;
}

/** Mints a fresh secret and signs it with the current (first) signing key. */
export async function mintVoterCookie(signingKeys: string[]): Promise<{ secret: Uint8Array; cookieValue: string }> {
  const secret = crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
  const cookieValue = await signSecret(secret, signingKeys[0]);
  return { secret, cookieValue };
}

/** Verifies against each signing key in order; returns the raw secret bytes, or null if invalid. */
export async function verifyVoterCookie(cookieValue: string, signingKeys: string[]): Promise<Uint8Array | null> {
  const parts = cookieValue.split('.');
  if (parts.length !== 2) return null;
  let secret: Uint8Array;
  let signature: Uint8Array;
  try {
    secret = base64UrlToBytes(parts[0]);
    signature = base64UrlToBytes(parts[1]);
  } catch {
    return null;
  }
  if (secret.length !== SECRET_BYTES) return null;

  for (const key of signingKeys) {
    const expected = await hmacSha256(key, secret);
    if (constantTimeEqual(expected, signature)) return secret;
  }
  return null;
}

/**
 * voter_key_hash = HMAC-SHA256(derivation_key, poll_public_code || secret), hex-encoded.
 * Uses the poll's public_code rather than its internal id as the per-poll domain separator:
 * both are unique and immutable once a poll is published, so the security property (a vote
 * on poll A can never be replayed as a vote on poll B) is identical either way, and keying on
 * the code avoids every voter-facing call needing a separate id lookup before it can compute
 * this hash (recorded in docs/DEVIATIONS.md as a refinement of the original poll_id wording).
 */
export async function deriveVoterKeyHash(pollPublicCode: string, secret: Uint8Array, derivationKey: string): Promise<string> {
  const codeBytes = new TextEncoder().encode(pollPublicCode);
  const combined = new Uint8Array(codeBytes.length + secret.length);
  combined.set(codeBytes, 0);
  combined.set(secret, codeBytes.length);
  const digest = await hmacSha256(derivationKey, combined);
  return bytesToHex(digest);
}

export function buildSetCookieHeader(cookieValue: string, secure: boolean): string {
  const attrs = [
    `${VOTER_COOKIE_NAME}=${cookieValue}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${MAX_AGE_SECONDS}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}
