import { createClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Organiser identity (Auth) only. Never used for direct table/RPC access —
 * all poll data flows through /api/* per the PRD's deployment boundary.
 */
export const supabase = createClient(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
