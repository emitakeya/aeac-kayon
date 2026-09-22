'use client';
// Ringkasan body: KPI cards, funnel, follow-up health, lost reasons,
// and the per-area / per-category table.

import Link from 'next/link';
import { useState } from 'react';
import { CATEGORY_LABEL, LOST_REASON_LABEL, type Summary, type SummaryGroupRow } from '@/lib/b2b';

export default function RingkasanView({ s }: { s: Summary }) {
  const [group, setGroup] = useState<'area' | 'category'>('area');

  const kpis: [string, number, string, boolean?][] = [
    ['Prospek baru', s.kpi.new, 'ditambahkan'],
    ['Kunjungan', s.kpi.visits, 'aktivitas'],
    ['Kontak', s.kpi.contacts, 'kunjungan, telp, WA, email, meeting'],
    ['PIC didapat', s.kpi.pic, 'naik ke PIC Ditemukan+'],
    ['Survei', s.kpi.survey, 'naik ke Survei'],
    ['Penawaran', s.kpi.quotation, 'naik ke Penawaran'],
    ['Deal', s.kpi.won, 'naik ke Deal', true],
    ['Gagal', s.kpi.lost, 'ditutup gagal'],
  ];

  const f = s.funnel;
  const funnel: [string, number][] = [
    ['Prospek', f.prospects],
    ['PIC didapat', f.pic],
    ['Tertarik', f.interested],
    ['Survei', f.survey],
    ['Penawaran', f.quotation],
    ['Deal', f.won],
  ];
  const base = f.prospects || 1;
  const lostMax = Math.max(1, ...s.lost_reasons.map((l) => l.n));

  const rows: SummaryGroupRow[] = group === 'area' ? s.by_area : s.by_category;

  return (
    <>
      <section aria-label="Angka periode ini" className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {kpis.map(([label, n, hint, green]) => (
          <div key={label} className="rounded-xl border border-neutral-200 bg-white p-4 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-neutral-600">{label}</span>
            <span className={'text-3xl font-bold tracking-tight tabular-nums ' + (green ? 'text-green-700' : 'text-neutral-900')}>
              {n}
            </span>
            <span className="text-[11px] text-neutral-500">{hint}</span>
          </div>
        ))}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
        <section aria-labelledby="funnel-h" className="rounded-xl border border-neutral-200 bg-white p-6 flex flex-col gap-4">
          <div>
            <h2 id="funnel-h" className="text-[17px] font-bold">Funnel</h2>
            <p className="mt-1 text-[13px] text-neutral-600">
              Dari {f.prospects} prospek yang ditambahkan dalam periode ini — sampai tahap mana mereka pernah sampai.
            </p>
          </div>
          {f.prospects === 0 ? (
            <p className="text-sm text-neutral-600">Belum ada prospek baru dalam periode ini.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {funnel.map(([label, n], i) => {
                const pct = Math.round((n / base) * 100);
                const prev = i > 0 ? funnel[i - 1][1] : 0;
                const step = i === 0 ? '100%' : prev ? `${Math.round((n / prev) * 100)}% dari atas` : '—';
                return (
                  <div key={label} className="grid grid-cols-[110px_minmax(0,1fr)_48px_96px] gap-3 items-center text-sm">
                    <span className="font-semibold">{label}</span>
                    <div className="h-7 rounded-md bg-neutral-100 overflow-hidden">
                      <div
                        className={'h-full rounded-md ' + (i === funnel.length - 1 ? 'bg-green-700' : 'bg-aeac-amber-500')}
                        style={{ width: `${n ? Math.max(pct, 2) : 0}%` }}
                      />
                    </div>
                    <span className="text-right font-bold tabular-nums">{n}</span>
                    <span className="text-xs text-neutral-600 tabular-nums">{step}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <section aria-labelledby="fu-h" className="rounded-xl border border-neutral-200 bg-white p-6 flex flex-col gap-3">
            <h2 id="fu-h" className="text-[17px] font-bold">
              Kesehatan follow-up <span className="text-xs font-medium text-neutral-500">(saat ini)</span>
            </h2>
            <div className="grid grid-cols-3 gap-2.5">
              <Link href="/b2b/follow-up" className="rounded-lg bg-red-50 p-3 flex flex-col">
                <span className="text-2xl font-bold text-red-700 tabular-nums">{s.followup.over}</span>
                <span className="text-xs font-semibold text-red-900">Terlambat</span>
              </Link>
              <Link href="/b2b/follow-up" className="rounded-lg bg-aeac-amber-50 p-3 flex flex-col">
                <span className="text-2xl font-bold text-amber-700 tabular-nums">{s.followup.today}</span>
                <span className="text-xs font-semibold text-amber-900">Hari ini</span>
              </Link>
              <Link href="/b2b/prospek?fu=none" className="rounded-lg bg-neutral-100 p-3 flex flex-col">
                <span className="text-2xl font-bold text-neutral-800 tabular-nums">{s.followup.none}</span>
                <span className="text-xs font-semibold text-neutral-700">Tanpa jadwal</span>
              </Link>
            </div>
          </section>

          <section aria-labelledby="lost-h" className="rounded-xl border border-neutral-200 bg-white p-6 flex flex-col gap-3">
            <h2 id="lost-h" className="text-[17px] font-bold">Alasan gagal</h2>
            {s.lost_reasons.length === 0 ? (
              <p className="text-sm text-neutral-600">Tidak ada prospek gagal dalam periode ini.</p>
            ) : (
              s.lost_reasons.map((l) => (
                <div key={l.reason} className="grid grid-cols-[minmax(0,1fr)_120px_28px] gap-2.5 items-center text-[13px]">
                  <span>{LOST_REASON_LABEL[l.reason] ?? l.reason}</span>
                  <div className="h-2.5 rounded-full bg-neutral-100 overflow-hidden">
                    <div className="h-full rounded-full bg-neutral-500" style={{ width: `${(l.n / lostMax) * 100}%` }} />
                  </div>
                  <span className="text-right font-bold tabular-nums">{l.n}</span>
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      <section aria-labelledby="break-h" className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-3">
          <h2 id="break-h" className="text-[17px] font-bold">Per {group === 'area' ? 'area' : 'kategori'}</h2>
          <div role="group" aria-label="Kelompokkan" className="flex gap-1 rounded-xl bg-neutral-200 p-1">
            {(['area', 'category'] as const).map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={group === g}
                onClick={() => setGroup(g)}
                className={
                  'h-9 px-3 rounded-lg text-[13px] font-semibold ' +
                  (group === g ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600')
                }
              >
                {g === 'area' ? 'Area' : 'Kategori'}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))] gap-4 px-6 py-2.5 bg-neutral-50 border-y border-neutral-200 text-xs font-semibold uppercase tracking-wide text-neutral-600">
              <span>{group === 'area' ? 'Area' : 'Kategori'}</span>
              <span className="text-right">Prospek</span>
              <span className="text-right">PIC didapat</span>
              <span className="text-right">Tertarik+</span>
              <span className="text-right">Deal</span>
              <span className="text-right">Konversi</span>
            </div>
            {rows.length === 0 ? (
              <p className="px-6 py-5 text-sm text-neutral-600">Belum ada prospek baru dalam periode ini.</p>
            ) : (
              rows.map((r) => (
                <div
                  key={r.name}
                  className="grid grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))] gap-4 px-6 py-3 border-b border-neutral-100 last:border-b-0 text-sm tabular-nums"
                >
                  <span className="font-semibold">{group === 'area' ? r.name : CATEGORY_LABEL[r.name] ?? r.name}</span>
                  <span className="text-right">{r.n}</span>
                  <span className="text-right">{r.pic}</span>
                  <span className="text-right">{r.int}</span>
                  <span className="text-right font-bold">{r.won}</span>
                  <span className="text-right text-neutral-600">{r.n ? `${Math.round((r.won / r.n) * 100)}%` : '—'}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}
