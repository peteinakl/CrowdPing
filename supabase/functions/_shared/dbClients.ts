// Two client shapes, matching PRD §6/§8's two auth surfaces. Neither ever uses the
// service-role key — that key is not read anywhere in this directory.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0';
import type { BackendEnv } from './env.ts';

/** Anon-key client for voter-api. Voter identity comes from the cookie, not a JWT. */
export function createAnonClient(env: BackendEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
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
