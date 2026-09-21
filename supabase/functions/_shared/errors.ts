// Typed error envelope. Postgres functions raise `exception 'CODE: message'` (see the
// comment at the top of supabase/migrations/20260921031056_draft_crud_functions.sql for the
// convention); this turns that into the JSON shape apps/web/src/lib/apiClient.ts expects and
// the matching HTTP status.

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORISED'
  | 'POLL_NOT_FOUND'
  | 'POLL_CLOSED'
  | 'INVALID_OPTION'
  | 'ILLEGAL_TRANSITION'
  | 'ORIGIN_FORBIDDEN'
  | 'RATE_LIMITED'
  | 'NO_SESSION'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORISED: 403,
  POLL_NOT_FOUND: 404,
  POLL_CLOSED: 409,
  INVALID_OPTION: 400,
  ILLEGAL_TRANSITION: 409,
  ORIGIN_FORBIDDEN: 403,
  RATE_LIMITED: 429,
  // Client-flow ordering issue (no voter cookie yet), not a DB-raised code — the client must
  // call POST /polls/:code/session first and round-trip the cookie before voting (PRD §10:
  // "If cookies are blocked, explain the issue; do not silently accept untrackable repeated
  // votes" — so this is never silently recovered from server-side by minting a fresh cookie).
  NO_SESSION: 400,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const KNOWN_CODES = new Set<string>(Object.keys(STATUS_BY_CODE));

/** Parses a Postgres error's `message` field of the form "CODE: human text". */
export function fromPostgresError(pgMessage: string): ApiError {
  const separatorIndex = pgMessage.indexOf(':');
  if (separatorIndex > 0) {
    const code = pgMessage.slice(0, separatorIndex).trim();
    const rest = pgMessage.slice(separatorIndex + 1).trim();
    if (KNOWN_CODES.has(code)) {
      return new ApiError(code as ErrorCode, rest);
    }
  }
  // Not one of our raised codes (a genuine unexpected DB error) — never leak internals.
  return new ApiError('INTERNAL_ERROR', 'Something went wrong. Please try again.');
}

export function errorResponse(error: ApiError, corsHeaders: Record<string, string> = {}): Response {
  const status = STATUS_BY_CODE[error.code];
  if (error.code === 'INTERNAL_ERROR') {
    console.error('Unhandled backend error:', error.message);
  }
  return new Response(
    JSON.stringify({ error: { code: error.code, message: error.message } }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...corsHeaders,
      },
    },
  );
}

export function jsonResponse(body: unknown, init: ResponseInit = {}, corsHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders,
      ...init.headers,
    },
  });
}
