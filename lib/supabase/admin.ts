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
//
// NOTE: env vars are read LAZILY inside createAdminClient(), not at module
// top level. Reading them at import time made `next build` fail while
// collecting page data on machines where SUPABASE_SERVICE_ROLE_KEY isn't in
// .env.local (it's intentionally kept only in Vercel). Lazy reads keep the
// import side-effect-free so the build can analyze the route without the key.

import { createClient } from '@supabase/supabase-js';

/**
 * Returns a Supabase client with the service-role key.
 * This client has FULL DATABASE ACCESS — use only for auth admin operations.
 *
 * Do NOT export this from any module that could be imported by a Client
 * Component. Only use it inside Route Handlers (`app/api/.../route.ts`).
 *
 * The required env vars are validated here, at call time, so a missing key
 * only errors when the function actually runs — not when the module is
 * imported during the build.
 */
export function createAdminClient() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL belum di-set');
  }
  if (!SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY belum di-set');
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
