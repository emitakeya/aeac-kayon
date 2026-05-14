// app/api/akun-staff/send-magic-link/route.ts
//
// Sends a passwordless magic link email to an existing auth user.
// Admin only. Uses the service-role admin client to call signInWithOtp
// without rate-limiting through the user's own session.
//
// Note: this uses the standard `signInWithOtp` flow which sends Supabase's
// configured email template. Make sure the redirect URL in the Supabase
// dashboard's email template includes kayon.aeac-service.id.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  // (not as a backdoor to create new ones).
  const admin = createAdminClient();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kayon.aeac-service.id';

  const { error } = await admin.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl}/auth/callback`,
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
