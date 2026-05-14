// app/akun-staff/page.tsx

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { CurrentUser } from '@/lib/types';
import type { StaffOnboardingResponse } from '@/lib/staff-onboarding';
import { StaffOnboardingClient } from './staff-onboarding-client';

export const dynamic = 'force-dynamic';

export default async function AkunStaffPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: me } = await supabase
    .from('v_current_user')
    .select('*')
    .maybeSingle<CurrentUser>();

  if (!me || !me.can_admin) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white border border-neutral-200 rounded-2xl p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-neutral-900 mb-2">
            Akses ditolak
          </h1>
          <p className="text-xs text-neutral-600 leading-relaxed mb-4">
            Halaman ini hanya untuk admin.
          </p>
          <Link
            href="/dashboard"
            className="inline-block text-xs text-blue-600 hover:underline"
          >
            ← Kembali ke dashboard
          </Link>
        </div>
      </main>
    );
  }

  const { data: result, error } = await supabase.rpc('get_staff_onboarding_list');

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white border border-neutral-200 rounded-2xl p-6 text-center shadow-sm">
          <h1 className="text-base font-semibold text-neutral-900 mb-2">
            Gagal memuat data staff
          </h1>
          <p className="text-xs text-neutral-600 leading-relaxed mb-4">
            {error.message}
          </p>
          <Link
            href="/dashboard"
            className="inline-block text-xs text-blue-600 hover:underline"
          >
            ← Kembali ke dashboard
          </Link>
        </div>
      </main>
    );
  }

  const data = result as StaffOnboardingResponse;
  const staff = data?.staff ?? [];

  return (
    <main className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <header className="mb-5">
        <Link
          href="/dashboard"
          className="text-[11px] text-neutral-500 hover:text-neutral-700 mb-2 inline-block"
        >
          ← Dashboard
        </Link>
        <h1 className="text-lg font-semibold text-neutral-900">Akun Staff</h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          Buat akun login dan kirim magic link ke staff.
        </p>
      </header>

      <StaffOnboardingClient initialStaff={staff} />
    </main>
  );
}
