import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { CurrentUser } from '@/lib/types';
import { LogoutButton } from './logout-button';
import { OrderFormLottie } from './order-form-lottie';

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

  // Admin, supervisor, finance, technician. Marketing and TRO excluded.
  const canViewHistory = me.can_admin || me.can_view_finance || me.can_view_tech_pages;

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
          {/* 1. Booking / Order Baru — MM staff + admin/supervisor.
              NOT technicians: create_staff_order requires the order to be
              attributed to a marketing/TRO teammate, which a technician has no
              valid value for. Also the target of the 3-month reminder deep
              links (?ref=<order>). */}
          {(me.can_view_mm || me.can_admin) && (
            <PageLink
              href="/booking-staff"
              title="Booking / Order Baru"
              subtitle="Buat pesanan baru atas nama tim (tanpa OTP)"
              icon={<OrderFormLottie />}
            />
          )}

          {/* 2. Booking list — MM viewers OR technicians.
              The RPC (get_bookings_confirmed) and the page gate both already
              accept can_view_mm OR can_view_tech_pages, so techs land fine. */}
          {(me.can_view_mm || me.can_view_tech_pages) && (
            <PageLink
              href="/booking-list-confirmed"
              title="Booking List (Confirmed)"
              subtitle="Lihat pesanan terkonfirmasi yang akan datang"
            />
          )}

          {/* 3. Cancel — admin + supervisor + finance. Never technicians. */}
          {(me.can_view_finance || me.can_admin) && (
            <PageLink
              href="/cancel"
              title="Cancel"
              subtitle="Batalkan pesanan yang masih pending atau confirmed"
            />
          )}

          {/* 4. Lihat Semua Pesanan — full archive incl. cancellations.
              admin + supervisor + finance + technician. */}
          {canViewHistory && (
            <PageLink
              href="/lihat-semua-pesanan"
              title="Lihat Semua Pesanan"
              subtitle="Riwayat lengkap semua pesanan, termasuk yang dibatalkan"
            />
          )}

          {/* 5. Laporan Teknisi — techs + admin/supervisor (admin/finance for
              testing). The RPC enforces the real check. */}
          {(me.can_view_tech_pages || me.can_admin) && (
            <PageLink
              href="/laporan-teknisi"
              title="Laporan Teknisi"
              subtitle="Buat laporan setelah selesai pengerjaan"
            />
          )}

          {/* 6. Invoice Admin — admin/supervisor + finance (full),
              technician (read-only). Technicians can view invoices but the page
              renders without any create / mark-paid / resend controls, and the
              write RPCs reject them at the DB regardless. */}
          {(me.can_view_finance || me.can_admin || me.role === 'technician') && (
            <PageLink
              href="/invoice-admin"
              title="Invoice Admin"
              subtitle={
                me.can_view_finance || me.can_admin
                  ? 'Kelola dan kirim invoice ke customer'
                  : 'Lihat daftar invoice (hanya-baca)'
              }
            />
          )}

          {/* 7. Rekap Komisi Teknisi — techs see their own;
              admin/supervisor/finance see all. */}
          {me.can_view_tech_pages && (
            <PageLink
              href="/komisi-teknisi"
              title="Rekap Komisi Teknisi"
              subtitle="Lihat komisi per teknisi & per kuartal"
            />
          )}

          {/* 8. Rekap Komisi Marketing — every role.
              get_marketing_commission_recap scopes marketing/TRO callers to
              their own team_code; admin, supervisor, finance and technician see
              all five teams. */}
          <PageLink
            href="/komisi-marketing"
            title="Rekap Komisi Marketing"
            subtitle={
              me.role === 'marketing' || me.role === 'tro'
                ? 'Lihat komisi tim Anda'
                : 'Lihat komisi per pasangan marketing'
            }
          />
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
  icon,
}: {
  href?: string;
  title: string;
  subtitle: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const base = 'block bg-white border border-neutral-200 rounded-xl px-4 py-3 transition';

  const body = (
    <div className={icon ? 'flex items-center gap-3' : undefined}>
      {icon}
      <div>
        <div className={`text-sm font-medium ${disabled ? 'text-neutral-700' : 'text-neutral-900'}`}>
          {title}
        </div>
        <div className="text-[11px] text-neutral-500 mt-0.5">{subtitle}</div>
      </div>
    </div>
  );

  if (disabled || !href) {
    return <div className={`${base} opacity-60 cursor-not-allowed`}>{body}</div>;
  }
  return (
    <Link href={href} className={`${base} hover:bg-amber-50 hover:border-amber-200`}>
      {body}
    </Link>
  );
}

function Cap({ label, v }: { label: string; v: boolean }) {
  return (
    <li className="flex items-center justify-between">
      <code className="text-neutral-600">{label}</code>
      <span
        className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
          v ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-200 text-neutral-500'
        }`}
      >
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
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white border border-neutral-200 rounded-2xl p-6 text-center shadow-sm">
        <h1 className="text-base font-semibold text-neutral-900 mb-2">{title}</h1>
        <p className="text-xs text-neutral-600 leading-relaxed mb-4">{detail}</p>
        {email ? <p className="text-[11px] text-neutral-400 mb-4">Email: {email}</p> : null}
        <LogoutButton />
      </div>
    </main>
  );
}
