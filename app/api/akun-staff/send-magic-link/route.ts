// app/api/akun-staff/send-magic-link/route.ts
//
// Sends a passwordless magic link email to an existing auth user.
// Admin only. Uses the service-role admin client to call signInWithOtp
// without rate-limiting through the user's own session.
//
// IMPORTANT: AEAC magic links must ALWAYS return to Kayon. The Supabase
// project is shared with MM Property / BBMAX, whose Site URL is
// bbmax.maisonmap.com. The redirect base is hardcoded to Kayon here so a
// stray NEXT_PUBLIC_SITE_URL env value cannot send technicians to the wrong
// app. (`https://kayon.aeac-service.id/**` is on the Supabase redirect
// allow-list, so this redirect is permitted.)

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// AEAC's own origin — do NOT read this from NEXT_PUBLIC_SITE_URL, which is a
// shared/ambiguous value across projects.
const KAYON_BASE = 'https://kayon.aeac-service.id';

interface Body {
  email?: string;
}

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Body harus JSON yang valid' },
      { status: 400 },
    );
  }

  if (!body.email || typeof body.email !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'email wajib diisi' },
      { status: 400 },
    );
  }

  const email = body.email.trim().toLowerCase();
  if (!email.includes('@')) {
    return NextResponse.json(
      { ok: false, error: 'Format email tidak valid' },
      { status: 400 },
    );
  }

  // Verify caller is admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Tidak terautentikasi' },
      { status: 401 },
    );
  }

  const { data: me, error: meErr } = await supabase
    .from('v_current_user')
    .select('can_admin')
    .maybeSingle<{ can_admin: boolean }>();

  if (meErr || !me?.can_admin) {
    return NextResponse.json(
      { ok: false, error: 'Hanya admin yang bisa kirim magic link' },
      { status: 403 },
    );
  }

  // Send the magic link via the admin client. We use signInWithOtp with
  // shouldCreateUser=false so this can ONLY be used to log in existing users
  // (not as a backdoor to create new ones). emailRedirectTo is pinned to
  // Kayon so the link always returns to this app.
  const admin = createAdminClient();

  const { error } = await admin.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${KAYON_BASE}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.json(
      { ok: false, error: `Gagal kirim magic link: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
