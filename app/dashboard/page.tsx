// app/dashboard/page.tsx
// Updated May 12, 2026 — merged /booking-list-mobile and /booking-list-confirmed
// into a single entry. Visible to anyone with can_view_mm OR can_view_tech_pages.

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { CurrentUser } from '@/lib/types';
import { LogoutButton } from './logout-button';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: me, error } = await supabase
    .from('v_current_user')
    .select('*')
    .maybeSingle<CurrentUser>();

  if (error) {
    return (
      <ErrorScreen
        title="Gagal memuat data pengguna"
        detail={error.message}
        email={user.email ?? null}
      />
    );
  }

  if (!me) {
    return (
      <ErrorScreen
        title="Akun belum terdaftar"
        detail="Email Anda terdaftar di sistem login, tetapi belum memiliki peran (role). Hubungi admin untuk diaktifkan."
        email={user.email ?? null}
      />
    );
  }

  // True if user can see the merged Daftar Booking page (MM staff + tech + admin/finance)
  const canViewBookings = Boolean(me.can_view_mm || me.can_view_tech_pages);

  return (
    <main className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-aeac-amber-500 text-black font-bold text-sm flex items-center justify-center">
            AEAC
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Kayon</h1>
            <p className="text-[11px] text-neutral-500">Portal Staf</p>
          </div>
        </div>
        <LogoutButton />
      </header>

      <section className="bg-white border border-neutral-200 rounded-2xl p-5 mb-4 shadow-sm">
        <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-1">
          Selamat datang
        </p>
        <h2 className="text-xl font-semibold text-neutral-900">
          {me.staff_name ?? me.technician_name ?? me.email}
        </h2>
        <p className="text-xs text-neutral-500 mt-0.5">{me.email}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <RoleBadge role={me.role} />
          {me.team_code ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
              Tim {me.team_code}
            </span>
          ) : null}
          {me.technician_name ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Teknisi: {me.technician_name}
            </span>
          ) : null}
        </div>
      </section>

      <section className="mb-4">
        <h3 className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-2 px-1">
          Halaman Tersedia
        </h3>
        <div className="space-y-2">
          {me.can_view_tech_pages && (
            <PageLink
              href="/komisi-teknisi"
              title="Rekap Komisi Teknisi"
              subtitle="Lihat komisi per teknisi & per kuartal"
            />
          )}
          {canViewBookings && (
            <PageLink
              href="/booking-list-confirmed"
              title="Daftar Booking"
              subtitle="Booking 3 hari terakhir & mendatang"
            />
          )}
          {me.can_view_finance && (
            <PageLink title="Invoice Admin" subtitle="Belum dibangun" disabled />
          )}
          {me.can_admin && (
            <PageLink title="Booking List & Cancel" subtitle="Belum dibangun" disabled />
          )}
          {me.role === 'technician' && (
            <PageLink title="Laporan Teknisi" subtitle="Belum dibangun" disabled />
          )}
        </div>
      </section>

      <section className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
        <h3 className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-2">
          Kemampuan (debug)
        </h3>
        <ul className="space-y-1 text-xs">
          <Cap label="can_admin" v={me.can_admin} />
          <Cap label="can_view_finance" v={me.can_view_finance} />
          <Cap label="can_view_mm" v={me.can_view_mm} />
          <Cap label="can_view_tech_pages" v={me.can_view_tech_pages} />
        </ul>
      </section>
    </main>
  );
}

function RoleBadge({ role }: { role: CurrentUser['role'] }) {
  const map: Record<CurrentUser['role'], { label: string; cls: string }> = {
    admin: { label: 'Admin', cls: 'bg-red-50 text-red-700 border-red-200' },
    finance: { label: 'Finance', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    marketing: { label: 'Marketing', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
    tro: { label: 'TRO', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    supervisor: { label: 'Supervisor', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    technician: { label: 'Teknisi', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  };
  const m = map[role];
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${m.cls}`}>
      {m.label}
    </span>
  );
}

function PageLink({
  href,
  title,
  subtitle,
  disabled,
}: {
  href?: string;
  title: string;
  subtitle: string;
  disabled?: boolean;
}) {
  const base = 'block bg-white border border-neutral-200 rounded-xl px-4 py-3 transition';
  if (disabled || !href) {
    return (
      <div className={`${base} opacity-50 cursor-not-allowed`}>
        <p className="text-sm font-medium text-neutral-900">{title}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
      </div>
    );
  }
  return (
    <Link href={href} className={`${base} hover:border-amber-300 hover:shadow-sm active:scale-[0.99]`}>
      <p className="text-sm font-medium text-neutral-900">{title}</p>
      <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
    </Link>
  );
}

function Cap({ label, v }: { label: string; v: boolean }) {
  return (
    <li className="flex items-center justify-between">
      <span className="font-mono text-neutral-600">{label}</span>
      <span className={v ? 'text-emerald-600 font-medium' : 'text-neutral-400'}>
        {v ? 'true' : 'false'}
      </span>
    </li>
  );
}

function ErrorScreen({
  title,
  detail,
  email,
}: {
  title: string;
  detail: string;
  email: string | null;
}) {
  return (
    <main className="min-h-screen px-4 py-6 max-w-2xl mx-auto flex items-center justify-center">
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm w-full">
        <h1 className="text-lg font-semibold text-neutral-900 mb-2">{title}</h1>
        <p className="text-sm text-neutral-700 mb-3">{detail}</p>
        {email && (
          <p className="text-xs text-neutral-500 mb-4">
            Anda masuk sebagai: <span className="font-mono">{email}</span>
          </p>
        )}
        <LogoutButton />
      </div>
    </main>
  );
}
