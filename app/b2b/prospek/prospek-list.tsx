'use client';
// app/b2b/prospek/prospek-list.tsx
// Filterable prospect list. Data volume in the pilot is small, so all
// filtering happens client-side on the rows from b2b_list_prospects().

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  CATEGORIES, CATEGORY_LABEL, STATUSES, STATUS_CLASS, STATUS_LABEL, ACTIVITY_LABEL,
  followupKind, fmtDate, isoToJakartaYmd, jakartaToday, daysBetween, staffNames,
  type B2BMeta, type FollowupKind, type ProspectRow,
} from '@/lib/b2b';

const FU_FILTERS: [string, string][] = [
  ['', 'Semua follow-up'],
  ['over', 'Terlambat'],
  ['today', 'Hari ini'],
  ['soon', '7 hari ke depan'],
  ['none', 'Belum dijadwalkan'],
];

const SELECT =
  'h-11 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-aeac-amber-500 focus:outline-none';

export default function ProspekList({ rows, meta }: { rows: ProspectRow[]; meta: B2BMeta }) {
  const today = jakartaToday();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [area, setArea] = useState('');
  const [cat, setCat] = useState('');
  const [staff, setStaff] = useState('');
  const [fu, setFu] = useState('');

  const enriched = useMemo(
    () => rows.map((r) => ({ ...r, fuKind: followupKind(r.next_followup_date, r.status, today) })),
    [rows, today],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return enriched.filter((r) => {
      if (status && r.status !== status) return false;
      if (area && r.area_id !== area) return false;
      if (cat && r.category !== cat) return false;
      if (staff && !r.staff_ids.includes(staff)) return false;
      if (fu === 'soon' && !(r.fuKind === 'soon' || r.fuKind === 'today')) return false;
      if (fu && fu !== 'soon' && r.fuKind !== fu) return false;
      if (!needle) return true;
      return [r.business_name, r.pic_name, r.area_name, r.pic_phone]
        .some((v) => (v ?? '').toLowerCase().includes(needle));
    });
  }, [enriched, q, status, area, cat, staff, fu]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { '': enriched.length };
    for (const r of enriched) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [enriched]);
  const overdue = enriched.filter((r) => r.fuKind === 'over').length;
  const dueToday = enriched.filter((r) => r.fuKind === 'today').length;

  const anyFilter = q || status || area || cat || staff || fu;

  return (
    <main className="px-4 py-6 md:px-10 md:py-8 flex flex-col gap-5 max-w-[1400px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold tracking-tight">Prospek</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {enriched.length} prospek ·{' '}
            <button type="button" onClick={() => setFu('over')} className="text-red-700 font-semibold hover:underline">
              {overdue} terlambat
            </button>{' '}
            ·{' '}
            <button type="button" onClick={() => setFu('today')} className="text-amber-700 font-semibold hover:underline">
              {dueToday} follow-up hari ini
            </button>
          </p>
        </div>
        <Link
          href="/b2b/prospek/baru"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-aeac-amber-500 hover:bg-aeac-amber-600 text-black font-bold text-sm"
        >
          + Tambah Prospek
        </Link>
      </header>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama bisnis, PIC, area, telepon…"
          aria-label="Cari prospek"
          className="h-11 w-full md:w-96 rounded-lg border border-neutral-300 bg-white px-4 text-sm focus:border-aeac-amber-500 focus:outline-none"
        />
        <select aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)} className={SELECT}>
          <option value="">Semua area</option>
          {meta.areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select aria-label="Kategori" value={cat} onChange={(e) => setCat(e.target.value)} className={SELECT}>
          <option value="">Semua kategori</option>
          {CATEGORIES.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        <select aria-label="Staf" value={staff} onChange={(e) => setStaff(e.target.value)} className={SELECT}>
          <option value="">Semua staf</option>
          {meta.staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select aria-label="Follow-up" value={fu} onChange={(e) => setFu(e.target.value)} className={SELECT}>
          {FU_FILTERS.map(([k, l]) => (
            <option key={k} value={k}>{l}</option>
          ))}
        </select>
        {anyFilter ? (
          <button
            type="button"
            onClick={() => { setQ(''); setStatus(''); setArea(''); setCat(''); setStaff(''); setFu(''); }}
            className="h-11 px-3 text-sm font-semibold text-aeac-amber-700 hover:underline"
          >
            Reset filter
          </button>
        ) : null}
      </div>

      <div role="group" aria-label="Filter status" className="flex flex-wrap gap-2">
        {[['', 'Semua'] as [string, string], ...STATUSES.map((s) => [s[0], s[1]] as [string, string])].map(([k, l]) => {
          const sel = status === k;
          return (
            <button
              key={k || 'all'}
              type="button"
              aria-pressed={sel}
              onClick={() => setStatus(k)}
              className={
                'h-9 px-3.5 rounded-full text-[13px] font-semibold border transition ' +
                (sel ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-800 border-neutral-300 hover:border-neutral-500')
              }
            >
              {l} <span className="opacity-70 font-medium">{counts[k] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-600">
          {enriched.length === 0 ? (
            <>
              Belum ada prospek.{' '}
              <Link href="/b2b/prospek/baru" className="font-semibold text-aeac-amber-700 hover:underline">
                Tambah yang pertama
              </Link>
            </>
          ) : (
            'Tidak ada prospek yang cocok dengan filter.'
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <section aria-label="Daftar prospek" className="hidden md:block rounded-xl border border-neutral-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[1.7fr_1.1fr_1.4fr_130px_120px_160px_1fr] gap-4 px-5 py-3 bg-neutral-50 border-b border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <span>Bisnis</span><span>Area</span><span>PIC</span><span>Status</span>
              <span>Kontak terakhir</span><span>Follow-up berikut</span><span>Staf</span>
            </div>
            {filtered.map((r) => (
              <Link
                key={r.id}
                href={`/b2b/prospek/${r.id}`}
                className="grid grid-cols-[1.7fr_1.1fr_1.4fr_130px_120px_160px_1fr] gap-4 px-5 py-3 border-b border-neutral-100 last:border-b-0 items-center text-sm hover:bg-aeac-amber-50 transition"
              >
                <span className="flex flex-col min-w-0">
                  <span className="font-semibold truncate">{r.business_name}</span>
                  <span className="text-xs text-neutral-600">{CATEGORY_LABEL[r.category] ?? r.category}</span>
                </span>
                <span>
                  <span className="inline-block rounded-full border border-neutral-300 px-2.5 py-0.5 text-[13px] text-neutral-800">
                    {r.area_name}
                  </span>
                </span>
                <span className="flex flex-col min-w-0">
                  {r.pic_name ? (
                    <span className="font-medium truncate">{r.pic_name}</span>
                  ) : (
                    <span className="italic text-neutral-500">Belum ada PIC</span>
                  )}
                  <span className="text-xs text-neutral-600 truncate">{r.pic_position}</span>
                </span>
                <span><StatusChip status={r.status} /></span>
                <LastContact r={r} />
                <FollowupCell date={r.next_followup_date} kind={r.fuKind} today={today} />
                <span className="text-neutral-700 truncate">{staffNames(r.staff)}</span>
              </Link>
            ))}
          </section>

          {/* Mobile cards */}
          <section aria-label="Daftar prospek" className="md:hidden flex flex-col gap-2">
            {filtered.map((r) => (
              <Link
                key={r.id}
                href={`/b2b/prospek/${r.id}`}
                className="rounded-xl border border-neutral-200 bg-white p-4 flex flex-col gap-2 active:bg-aeac-amber-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{r.business_name}</div>
                    <div className="text-xs text-neutral-600">
                      {r.area_name} · {CATEGORY_LABEL[r.category] ?? r.category}
                    </div>
                  </div>
                  <StatusChip status={r.status} />
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-neutral-700 truncate">{r.pic_name ?? 'Belum ada PIC'}</span>
                  <FollowupCell date={r.next_followup_date} kind={r.fuKind} today={today} compact />
                </div>
              </Link>
            ))}
          </section>
        </>
      )}
    </main>
  );
}

export function StatusChip({ status }: { status: string }) {
  return (
    <span className={'inline-block rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ' + (STATUS_CLASS[status] ?? '')}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function LastContact({ r }: { r: ProspectRow }) {
  if (!r.last_activity_at) return <span className="text-neutral-500">—</span>;
  return (
    <span className="flex flex-col">
      <span>{fmtDate(isoToJakartaYmd(r.last_activity_at))}</span>
      <span className="text-xs text-neutral-600">{ACTIVITY_LABEL[r.last_activity_type ?? ''] ?? ''}</span>
    </span>
  );
}

function FollowupCell({
  date, kind, today, compact,
}: { date: string | null; kind: FollowupKind; today: string; compact?: boolean }) {
  if (kind === 'none') {
    return <span className="text-neutral-500 text-[13px]">{date ? '—' : 'Belum dijadwalkan'}</span>;
  }
  if (kind === 'over') {
    const n = daysBetween(date!, today);
    return (
      <span className="text-red-700 font-semibold">
        {fmtDate(date)}{compact ? '' : ` · ${n} hari lalu`}
      </span>
    );
  }
  if (kind === 'today') return <span className="text-amber-700 font-semibold">Hari ini</span>;
  return <span className="text-neutral-800">{fmtDate(date)}</span>;
}
