// app/b2b/ringkasan/page.tsx — pilot summary (counts, funnel, breakdowns).
// Period + origin live in the URL (?range=&origin=) so the server fetches once
// per choice; the Area/Kategori toggle is client-side (both come back together).
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { addDays, fmtDate, jakartaToday, type Summary } from '@/lib/b2b';
import RingkasanView from './ringkasan-view';

export const dynamic = 'force-dynamic';

const RANGES: [string, string][] = [
  ['week', 'Minggu ini'],
  ['month', 'Bulan ini'],
  ['d30', '30 hari'],
  ['pilot', 'Sejak awal pilot'],
];
const ORIGINS: [string, string][] = [
  ['all', 'Semua'],
  ['outbound', 'Kami (hunting)'],
  ['inbound', 'Mereka (inbound)'],
];

function rangeFrom(range: string, today: string): string | null {
  if (range === 'week') {
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
    return addDays(today, -((dow + 6) % 7)); // Monday
  }
  if (range === 'month') return `${today.slice(0, 8)}01`;
  if (range === 'd30') return addDays(today, -29);
  return null; // since the first prospect
}

export default async function RingkasanPage({
  searchParams,
}: { searchParams: Promise<{ range?: string; origin?: string }> }) {
  const sp = await searchParams;
  const range = RANGES.some(([k]) => k === sp.range) ? sp.range! : 'pilot';
  const origin = ORIGINS.some(([k]) => k === sp.origin) ? sp.origin! : 'all';
  const today = jakartaToday();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('b2b_summary', {
    p_from: rangeFrom(range, today),
    p_to: today,
    p_origin: origin,
  });

  const href = (r: string, o: string) => `/b2b/ringkasan?range=${r}&origin=${o}`;
  const seg = (on: boolean) =>
    'h-9 px-3 rounded-lg text-[13px] font-semibold whitespace-nowrap flex items-center ' +
    (on ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600 hover:text-neutral-900');

  const s = data as Summary | null;
  const rangeText = !s
    ? ''
    : range === 'pilot'
      ? s.first
        ? `Sejak awal pilot (${fmtDate(s.first)}) – hari ini`
        : 'Belum ada data'
      : `${fmtDate(s.from)} – hari ini`;

  return (
    <main className="px-4 py-6 md:px-10 md:py-8 flex flex-col gap-6 max-w-[1400px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold tracking-tight">Ringkasan</h1>
          <p className="mt-1 text-sm text-neutral-600">{rangeText}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <nav aria-label="Periode" className="flex gap-1 rounded-xl bg-neutral-200 p-1">
            {RANGES.map(([k, l]) => (
              <Link key={k} href={href(k, origin)} aria-current={range === k ? 'true' : undefined} className={seg(range === k)}>
                {l}
              </Link>
            ))}
          </nav>
          <nav aria-label="Asal prospek" className="flex gap-1 rounded-xl bg-neutral-200 p-1">
            {ORIGINS.map(([k, l]) => (
              <Link key={k} href={href(range, k)} aria-current={origin === k ? 'true' : undefined} className={seg(origin === k)}>
                {l}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {error || !s ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Gagal memuat ringkasan: {error?.message ?? 'tidak ada data'}
        </p>
      ) : (
        <RingkasanView s={s} />
      )}
    </main>
  );
}
