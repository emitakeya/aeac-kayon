// lib/supabase/admin.ts
//
// SERVICE-ROLE Supabase client. Uses SUPABASE_SERVICE_ROLE_KEY env var.
//
// **CRITICAL — server-side only.** Never imported by Client Components.
// This key bypasses RLS entirely. Used only for auth admin operations
// (auth.admin.createUser, auth.admin.generateLink) that the regular
// authenticated client cannot perform.
//
// All non-auth-admin operations should continue to use the standard
// `createClient` from `./server` which uses the user's JWT.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL belum di-set');
}
if (!SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY belum di-set');
}

/**
 * Returns a Supabase client with the service-role key.
 * This client has FULL DATABASE ACCESS — use only for auth admin operations.
 *
 * Do NOT export this from any module that could be imported by a Client
 * Component. Only use it inside Route Handlers (`app/api/.../route.ts`).
 */
export function createAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
