// Matching PRD §6/§8's two auth surfaces, plus a service-role client for the voter RPCs that
// can't be safely anon-grantable (see the lock_down_voter_rpc_and_internal_tables migration:
// PostgREST exposes any anon-granted SECURITY DEFINER function at /rest/v1/rpc/<fn> to anyone
// holding the public anon key, completely bypassing this function's own cookie verification).
// The service-role key stays server-side inside this Edge Function; it is never forwarded to
// or reachable from the browser, which is what PRD §6's "never add a service-role credential
// to proxied browser requests" actually prohibits.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';
import type { BackendEnv } from './env.ts';

/** Anon-key client. Only used for calls that are safe to leave anon-grantable (get_public_poll). */
export function createAnonClient(env: BackendEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false },
  });
}

/**
 * Service-role client for voter-api's identity-sensitive RPCs (submit_vote, get_my_vote,
 * get_participant_results, report_poll, check_rate_limit). Bypasses RLS/grants entirely —
 * every one of these functions performs its own internal authorization (voter_key_hash
 * equality, poll state checks), so this is safe; it is not a substitute for those checks.
 */
export function createServiceRoleClient(env: BackendEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}

/**
 * Anon-key client that forwards the caller's own Authorization header, so RLS policies and
 * auth.uid() inside SECURITY DEFINER functions resolve to the real signed-in organiser —
 * never the service role. Used exclusively by organiser-api.
 */
export function createForwardedJwtClient(env: BackendEnv, req: Request): SupabaseClient {
  const authorization = req.headers.get('Authorization');
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
    },
  });
}
