// app/lihat-semua-pesanan/page.tsx
// Server Component — auth gate + monthly summary fetch.
// Detail rows are loaded lazily per month by the client component.

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { CurrentUser } from '@/lib/types';
import { jakartaYear, type HistorySummaryRow } from '@/lib/orders-history';
import { OrdersHistoryClient } from './history-client';

export const dynamic = 'force-dynamic';

export default async function LihatSemuaPesananPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('v_current_user')
    .select('*')
    .maybeSingle<CurrentUser>();

  if (!me) redirect('/403');

  // admin, supervisor, finance, technician. Marketing and TRO excluded.
  if (!(me.can_admin || me.can_view_finance || me.can_view_tech_pages)) {
    redirect('/403');
  }

  const { data, error } = await supabase.rpc('get_orders_history_summary');

  if (error) {
    return (
      <main className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
        <Header />
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <p className="text-sm font-medium text-red-700">Gagal memuat riwayat pesanan</p>
          <p className="text-xs text-neutral-600 mt-1">{error.message}</p>
        </div>
      </main>
    );
  }

  const summary = (data ?? []) as HistorySummaryRow[];

  return (
    <main className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <Header />
      <OrdersHistoryClient summary={summary} currentYear={jakartaYear()} />
    </main>
  );
}

function Header() {
  return (
    <header className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-aeac-amber-500 text-black font-bold text-sm flex items-center justify-center">
          AEAC
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">Lihat Semua Pesanan</h1>
          <p className="text-[11px] text-neutral-500">Riwayat lengkap · termasuk dibatalkan</p>
        </div>
      </div>
      <Link
        href="/dashboard"
        className="text-xs px-3 py-1.5 border border-neutral-200 rounded-lg text-neutral-700 bg-white hover:bg-neutral-50"
      >
        ← Dashboard
      </Link>
    </header>
  );
}
