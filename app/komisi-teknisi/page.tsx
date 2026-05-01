import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { CurrentUser } from '@/lib/types';
import {
  aggregate,
  fmtRp,
  yearOptions,
  type RecapPayload,
} from '@/lib/komisi';
import TechCard from './tech-card';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES: CurrentUser['role'][] = ['admin', 'finance', 'technician'];

type Search = { year?: string };

export default async function KomisiTeknisiPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const supabase = await createClient();

  // ─── Auth ────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: me, error: meErr } = await supabase
    .from('v_current_user')
    .select('*')
    .maybeSingle<CurrentUser>();

  if (meErr || !me) {
    redirect('/dashboard');
  }

  if (!ALLOWED_ROLES.includes(me.role)) {
    redirect('/403');
  }

  // ─── Year filter ─────────────────────────────
  const sp = await searchParams;
  const requested = parseInt(sp.year ?? '', 10);
  const fallbackYear = new Date().getFullYear();
  const year =
    !Number.isNaN(requested) && requested >= 2024 && requested <= 2099
      ? requested
      : fallbackYear;

  // ─── Fetch data ──────────────────────────────
  const { data, error } = await supabase.rpc('get_tech_commission_recap', {
    p_year: year,
  });

  if (error) {
    return (
      <ErrorScreen
        title="Gagal memuat data"
        detail={error.message}
      />
    );
  }

  const payload = (data ?? { earners: [], commissions: [] }) as RecapPayload;
  const agg = aggregate(payload);

  const opts = yearOptions(fallbackYear);
  const roleLabelMap: Record<CurrentUser['role'], string> = {
    admin: 'Administrator',
    finance: 'Keuangan',
    technician: 'Teknisi',
    marketing: 'Marketing',
    tro: 'TRO',
    supervisor: 'Supervisor',
  };

  return (
    <main className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      {/* ─── Header ─── */}
      <header className="flex items-center justify-between mb-6">
        <Link
          href="/dashboard"
          className="text-neutral-500 hover:text-neutral-900 text-sm flex items-center gap-1"
        >
          ← <span>Dashboard</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs font-medium text-neutral-700">
              {me.staff_name ?? me.technician_name ?? me.email}
            </div>
            <div className="text-[10px] text-neutral-500">
              {roleLabelMap[me.role] ?? me.role}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-aeac-amber-500 text-black font-bold text-xs flex items-center justify-center">
            AEAC
          </div>
        </div>
      </header>

      {/* ─── Page heading ─── */}
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-neutral-900">
          Rekap Komisi Teknisi
        </h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          Berdasarkan bulan penerimaan pembayaran
        </p>
      </div>

      {/* ─── Year filter (auto-submits via change handler in JS not needed; native form GET) ─── */}
      <form className="flex items-center gap-2 mb-4">
        <label className="text-xs text-neutral-500" htmlFor="year">
          Tahun
        </label>
        <select
          id="year"
          name="year"
          defaultValue={String(year)}
          className="flex-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm bg-white focus:border-amber-500 focus:outline-none"
        >
          {opts.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-3 py-2 bg-aeac-amber-500 text-black font-medium text-sm rounded-lg hover:bg-amber-600 transition-colors"
        >
          Tampilkan
        </button>
      </form>

      {/* ─── Summary tiles ─── */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Tile label={`Penjualan ${year}`} value={fmtRp(agg.total_team_sales)} />
        <Tile label="Total Komisi" value={fmtRp(agg.total_commission)} />
        <Tile
          label="Sudah Dibayar"
          value={fmtRp(agg.total_paid_out)}
          tone="success"
        />
        <Tile
          label="Terkumpul"
          value={fmtRp(agg.total_available)}
          tone="warning"
        />
      </section>

      {/* ─── Quarterly bar ─── */}
      {agg.total_commission > 0 && (
        <section className="bg-aeac-amber-50 border border-aeac-amber-200 rounded-xl p-3 mb-4">
          <div className="text-[10px] text-aeac-amber-700 uppercase tracking-wider font-medium mb-2">
            Total Komisi per Kuartal
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[1, 2, 3, 4].map((q) => {
              const qd = agg.quarterly[q];
              const has = qd.has_data && qd.commission > 0;
              return (
                <div
                  key={q}
                  className="bg-white rounded-md py-2 px-1 text-center"
                >
                  <div className="text-[10px] text-neutral-500 font-medium mb-0.5">
                    Q{q}
                  </div>
                  {has ? (
                    <div className="text-xs font-semibold text-neutral-900">
                      {fmtRp(qd.commission)}
                    </div>
                  ) : (
                    <div className="text-xs font-medium text-neutral-300">—</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Per-tech section ─── */}
      {agg.techs_with_data.length === 0 ? (
        <div className="bg-white border border-dashed border-neutral-200 rounded-xl p-6 text-center text-neutral-500 text-sm">
          Belum ada data komisi untuk tahun {year}.
        </div>
      ) : (
        <>
          <h3 className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-2 px-1">
            Per Teknisi
          </h3>

          {agg.techs_with_data.map((pt, idx) => (
            <TechCard
              key={pt.earner.id}
              pt={pt}
              year={year}
              team_monthly_basis={agg.team_monthly_basis}
              months_desc={agg.months_desc}
              total_team_sales={agg.total_team_sales}
              defaultOpen={idx === 0}
            />
          ))}
        </>
      )}

      {/* ─── Footnote ─── */}
      <div className="text-[11px] text-neutral-500 leading-relaxed px-1 py-3 mt-2">
        <p className="mb-2">
          <span className="font-semibold text-neutral-700">Cara perhitungan komisi:</span>
          <br />
          Komisi dihitung berdasarkan{' '}
          <span className="font-medium text-neutral-700">bulan penerimaan pembayaran</span>{' '}
          (bukan tanggal pengerjaan). Hanya invoice yang{' '}
          <span className="font-medium text-neutral-700">sudah dibayar</span> yang masuk hitungan.
        </p>

        <p className="mb-2">
          <span className="font-semibold text-neutral-700">Tarif per pekerjaan:</span>
          <br />
          • 1 teknisi (solo) →{' '}
          <span className="font-medium text-neutral-700">7,5%</span> untuk semua
          <br />
          • 2 teknisi → <span className="font-medium text-neutral-700">5%</span> untuk semua
          <br />
          • 3+ teknisi → <span className="font-medium text-neutral-700">5%</span> untuk Senior,{' '}
          <span className="font-medium text-neutral-700">2,5%</span> untuk Trainee
        </p>

        <p className="mb-2">
          <span className="font-semibold text-neutral-700">Pembayaran:</span> dilakukan setiap kuartal (3 bulan sekali).
        </p>

        <p className="italic text-neutral-400">
          Catatan: Data Januari & awal Februari 2026 menggunakan ringkasan bulanan
          karena sistem invoice baru aktif mulai 21 Februari 2026. Dari 21 Februari
          ke depan, komisi dihitung per pekerjaan berdasarkan laporan teknisi.
        </p>
      </div>
    </main>
  );
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'warning';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-600'
      : tone === 'warning'
        ? 'text-amber-600'
        : 'text-neutral-900';

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-3">
      <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-sm font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function ErrorScreen({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-white border border-neutral-200 rounded-2xl p-6 text-center shadow-sm">
        <h1 className="text-base font-semibold text-neutral-900 mb-2">{title}</h1>
        <p className="text-xs text-neutral-600 leading-relaxed mb-4">{detail}</p>
        <Link
          href="/dashboard"
          className="inline-block text-xs px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    </main>
  );
}
