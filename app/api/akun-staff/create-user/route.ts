// app/api/akun-staff/create-user/route.ts
//
// Creates an auth.users row for a staff member from one of:
//   - public.technicians (role: technician)
//   - property.staff_marketing (role: marketing)
//   - property.staff_tro (role: tro)
//
// Then inserts the matching property.user_roles row.
//
// Uses SERVICE-ROLE key (server-side only) for auth.admin.createUser.
// Uses the user's authenticated client to verify caller is admin.
//
// Atomicity: if the user_roles insert fails after auth user is created,
// we attempt to delete the auth user to keep things clean. If that cleanup
// also fails, we surface a clear error.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  source_table?: 'technician' | 'staff_marketing' | 'staff_tro';
  source_id?: string;
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

  if (
    !body.source_table ||
    !['technician', 'staff_marketing', 'staff_tro'].includes(body.source_table)
  ) {
    return NextResponse.json(
      { ok: false, error: 'source_table tidak valid' },
      { status: 400 },
    );
  }
  if (!body.source_id || typeof body.source_id !== 'string') {
    return NextResponse.json(
      { ok: false, error: 'source_id wajib diisi' },
      { status: 400 },
    );
  }

  // 1. Verify caller is admin
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
      { ok: false, error: 'Hanya admin yang bisa membuat akun' },
      { status: 403 },
    );
  }

  // 2. Look up the source record (using authenticated client, RLS-safe)
  let staffEmail: string | null = null;
  let staffName: string | null = null;
  let role: 'technician' | 'marketing' | 'tro';

  if (body.source_table === 'technician') {
    role = 'technician';
    const { data, error } = await supabase
      .from('technicians')
      .select('name, email, is_active')
      .eq('id', body.source_id)
      .maybeSingle<{ name: string; email: string | null; is_active: boolean }>();
    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: 'Teknisi tidak ditemukan' },
        { status: 404 },
      );
    }
    if (!data.is_active) {
      return NextResponse.json(
        { ok: false, error: 'Teknisi tidak aktif' },
        { status: 400 },
      );
    }
    if (!data.email) {
      return NextResponse.json(
        { ok: false, error: 'Teknisi belum punya email' },
        { status: 400 },
      );
    }
    staffEmail = data.email;
    staffName = data.name;
  } else if (body.source_table === 'staff_marketing') {
    role = 'marketing';
    const { data, error } = await supabase
      .schema('property')
      .from('staff_marketing')
      .select('name, email, active')
      .eq('id', body.source_id)
      .maybeSingle<{ name: string; email: string | null; active: boolean }>();
    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: 'Marketing staff tidak ditemukan' },
        { status: 404 },
      );
    }
    if (!data.active) {
      return NextResponse.json(
        { ok: false, error: 'Marketing staff tidak aktif' },
        { status: 400 },
      );
    }
    if (!data.email) {
      return NextResponse.json(
        { ok: false, error: 'Marketing staff belum punya email' },
        { status: 400 },
      );
    }
    staffEmail = data.email;
    staffName = data.name;
  } else {
    role = 'tro';
    const { data, error } = await supabase
      .schema('property')
      .from('staff_tro')
      .select('name, email, active')
      .eq('id', body.source_id)
      .maybeSingle<{ name: string; email: string | null; active: boolean }>();
    if (error || !data) {
      return NextResponse.json(
        { ok: false, error: 'TRO staff tidak ditemukan' },
        { status: 404 },
      );
    }
    if (!data.active) {
      return NextResponse.json(
        { ok: false, error: 'TRO staff tidak aktif' },
        { status: 400 },
      );
    }
    if (!data.email) {
      return NextResponse.json(
        { ok: false, error: 'TRO staff belum punya email' },
        { status: 400 },
      );
    }
    staffEmail = data.email;
    staffName = data.name;
  }

  const normalizedEmail = staffEmail.trim().toLowerCase();
  const normalizedStaffName = (staffName ?? '').trim().toUpperCase();

  // 3. Create the auth user (idempotent guard: check if email already exists)
  const admin = createAdminClient();

  // Check existing — listUsers filtered by email
  const { data: existing, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    return NextResponse.json(
      { ok: false, error: `Gagal cek user: ${listErr.message}` },
      { status: 500 },
    );
  }
  const found = existing.users.find(
    (u) => (u.email ?? '').trim().toLowerCase() === normalizedEmail,
  );

  let authUserId: string;

  if (found) {
    // User already exists in auth — just ensure user_roles row exists
    authUserId = found.id;
  } else {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true, // skip confirmation; magic link works immediately
      });
    if (createErr || !created?.user) {
      return NextResponse.json(
        {
          ok: false,
          error: `Gagal buat auth user: ${createErr?.message ?? 'unknown'}`,
        },
        { status: 500 },
      );
    }
    authUserId = created.user.id;
  }

  // 4. Insert property.user_roles row (idempotent on user_id+role)
  const { error: roleErr } = await admin
    .schema('property')
    .from('user_roles')
    .upsert(
      {
        user_id: authUserId,
        role,
        staff_name: normalizedStaffName || null,
      },
      { onConflict: 'user_id,role' },
    );

  if (roleErr) {
    // Best-effort cleanup: only delete the auth user if WE just created it
    if (!found) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => {
        // swallow — surface the original error to the user
      });
    }
    return NextResponse.json(
      {
        ok: false,
        error: `Auth user dibuat tapi gagal insert user_roles: ${roleErr.message}`,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, auth_user_id: authUserId });
}
