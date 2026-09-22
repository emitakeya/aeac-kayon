'use client';
// Daily work queue. Each row shows the plan from the last log, the PIC with a
// WhatsApp button, and "Catat" which opens the same logger as the detail page.
// After saving, router.refresh() re-groups the list (the row moves on).

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ACTIVITY_LABEL, CATEGORY_LABEL,
  daysBetween, fmtDate, fmtDay, followupKind, isoToJakartaYmd, jakartaToday, staffNames, waLink,
  type B2BMeta, type FollowupKind, type ProspectRow,
} from '@/lib/b2b';
import ActivityLogger from '../_components/activity-logger';
import { StatusChip } from '../prospek/prospek-list';

type Row = ProspectRow & { fuKind: FollowupKind };

const SECTIONS: { kind: FollowupKind; title: string; dot: string; box: string; empty: string }[] = [
  { kind: 'over', title: 'Terlambat', dot: 'bg-red-700', box: 'border-red-200', empty: 'Tidak ada yang terlambat.' },
  { kind: 'today', title: 'Hari ini', dot: 'bg-aeac-amber-600', box: 'border-amber-200', empty: 'Tidak ada follow-up hari ini.' },
  { kind: 'soon', title: '7 hari ke depan', dot: 'bg-neutral-500', box: 'border-neutral-200', empty: 'Belum ada jadwal minggu ini.' },
];

export default function FollowUpList({ rows, meta }: { rows: ProspectRow[]; meta: B2BMeta }) {
  const today = jakartaToday();
  const [mine, setMine] = useState(false);
  const [logFor, setLogFor] = useState<Row | null>(null);

  // Match "mine" by name: one person can have two logins (two user ids).
  const myName = meta.staff.find((s) => s.id === meta.me)?.name ?? null;

  const all: Row[] = useMemo(
    () => rows.map((r) => ({ ...r, fuKind: followupKind(r.next_followup_date, r.status, today) })),
    [rows, today],
  );
  const visible = useMemo(
    () => (mine ? all.filter((r) => r.staff.some((s) => s.id === meta.me || (myName && s.name === myName))) : all),
    [all, mine, meta.me, myName],
  );

  const bySection = (k: FollowupKind) =>
    visible
      .filter((r) => r.fuKind === k)
      .sort((a, b) => (a.next_followup_date ?? '').localeCompare(b.next_followup_date ?? '') ||
        a.business_name.localeCompare(b.business_name));

  const nOver = visible.filter((r) => r.fuKind === 'over').length;
  const nToday = visible.filter((r) => r.fuKind === 'today').length;
  const unscheduled = visible.filter(
    (r) => !r.next_followup_date && r.status !== 'won' && r.status !== 'lost',
  ).length;

  const todayLabel = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date());

  return (
    <main className="px-4 py-5 md:px-10 md:py-8 flex flex-col gap-6 max-w-[1400px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold tracking-tight">Follow-up</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {todayLabel} · {nOver} terlambat · {nToday} hari ini
          </p>
        </div>
        <div role="group" aria-label="Tampilkan" className="flex gap-1 rounded-xl bg-neutral-200 p-1">
          {[
            [false, 'Semua staf'],
            [true, 'Punya saya'],
          ].map(([v, l]) => (
            <button
              key={String(v)}
              type="button"
              aria-pressed={mine === v}
              onClick={() => setMine(v as boolean)}
              className={
                'h-9 px-3.5 rounded-lg text-[13px] font-semibold ' +
                (mine === v ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-600')
              }
            >
              {l as string}
            </button>
          ))}
        </div>
      </header>

      {SECTIONS.map((sec) => {
        const items = bySection(sec.kind);
        return (
          <section key={sec.kind} aria-label={sec.title} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className={'w-2.5 h-2.5 rounded-full ' + sec.dot} aria-hidden="true" />
              <h2 className="text-[17px] font-bold">{sec.title}</h2>
              <span className="text-sm font-semibold text-neutral-600">{items.length}</span>
            </div>

            {items.length === 0 ? (
              <p className={'rounded-xl border bg-white px-5 py-4 text-sm text-neutral-600 ' + sec.box}>{sec.empty}</p>
            ) : (
              <>
                {/* Desktop rows */}
                <div className={'hidden md:block rounded-xl border bg-white overflow-hidden ' + sec.box}>
                  {items.map((r) => (
                    <DesktopRow key={r.id} r={r} today={today} onLog={() => setLogFor(r)} />
                  ))}
                </div>
                {/* Phone */}
                {sec.kind === 'soon' ? (
                  <div className="md:hidden rounded-xl border border-neutral-200 bg-white overflow-hidden">
                    {items.map((r) => (
                      <Link
                        key={r.id}
                        href={`/b2b/prospek/${r.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-100 last:border-b-0 text-sm"
                      >
                        <span className="font-semibold truncate">{r.business_name}</span>
                        <span className="text-neutral-700 whitespace-nowrap">{fmtDay(r.next_followup_date)}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="md:hidden flex flex-col gap-2">
                    {items.map((r) => (
                      <PhoneCard key={r.id} r={r} today={today} border={sec.box} onLog={() => setLogFor(r)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}

      {unscheduled > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-neutral-400 bg-white px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-[15px]">{unscheduled} prospek aktif belum punya jadwal follow-up</span>
            <span className="text-[13px] text-neutral-600">
              Prospek yang bukan Deal/Gagal sebaiknya selalu punya tanggal berikutnya, supaya tidak terlupakan.
            </span>
          </div>
          <Link href="/b2b/prospek?fu=none" className="ml-auto text-sm font-bold text-aeac-amber-700 hover:underline whitespace-nowrap">
            Lihat daftar →
          </Link>
        </div>
      ) : null}

      {logFor ? (
        <ActivityLogger prospect={logFor} meta={meta} onClose={() => setLogFor(null)} />
      ) : null}
    </main>
  );
}

function dueText(r: Row, today: string): string {
  if (r.fuKind === 'over') return `${fmtDate(r.next_followup_date)} · ${daysBetween(r.next_followup_date!, today)} hari`;
  if (r.fuKind === 'today') return 'Hari ini';
  return fmtDay(r.next_followup_date);
}

function WaButton({ r, big }: { r: Row; big?: boolean }) {
  const wa = waLink(r.pic_phone);
  if (!wa) return null;
  return (
    <a
      href={wa}
      target="_blank"
      rel="noreferrer"
      aria-label={`Buka WhatsApp ${r.pic_name ?? r.business_name}`}
      className={
        'shrink-0 rounded-lg bg-green-700 hover:bg-green-800 flex items-center justify-center ' +
        (big ? 'w-12 h-11' : 'w-9 h-9')
      }
    >
      <svg width={big ? 20 : 18} height={big ? 20 : 18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 20l1.2-5.4A8.4 8.4 0 1 1 21 11.5z" />
      </svg>
    </a>
  );
}

function DesktopRow({ r, today, onLog }: { r: Row; today: string; onLog: () => void }) {
  const dueCls =
    r.fuKind === 'over' ? 'text-red-700 font-bold' : r.fuKind === 'today' ? 'text-amber-700 font-bold' : 'text-neutral-800 font-semibold';
  return (
    <div className="grid grid-cols-[120px_1.5fr_130px_1.3fr_1.6fr_110px_110px_96px] gap-4 px-5 py-3.5 border-b border-neutral-100 last:border-b-0 items-center text-sm">
      <span className={'text-[13px] ' + dueCls}>{dueText(r, today)}</span>
      <span className="flex flex-col min-w-0">
        <Link href={`/b2b/prospek/${r.id}`} className="font-semibold truncate hover:underline">
          {r.business_name}
        </Link>
        <span className="text-xs text-neutral-600 truncate">
          {r.area_name} · {CATEGORY_LABEL[r.category] ?? r.category}
        </span>
      </span>
      <span><StatusChip status={r.status} /></span>
      <span className="flex items-center gap-2 min-w-0">
        <span className="flex flex-col min-w-0">
          {r.pic_name ? (
            <span className="font-medium truncate">{r.pic_name}</span>
          ) : (
            <span className="italic text-neutral-500">Belum ada PIC</span>
          )}
          <span className="text-xs text-neutral-600 truncate">{r.pic_position}</span>
        </span>
        <span className="ml-auto"><WaButton r={r} /></span>
      </span>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Rencana</span>
        <span className="break-words">{r.followup_note ?? <span className="text-neutral-400">—</span>}</span>
      </span>
      <span className="flex flex-col">
        {r.last_activity_at ? (
          <>
            <span className="text-[13px]">{fmtDate(isoToJakartaYmd(r.last_activity_at))}</span>
            <span className="text-xs text-neutral-600">{ACTIVITY_LABEL[r.last_activity_type ?? ''] ?? ''}</span>
          </>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
      </span>
      <span className="text-[13px] text-neutral-700 truncate">{staffNames(r.staff)}</span>
      <button
        type="button"
        onClick={onLog}
        className="h-10 rounded-lg bg-aeac-amber-500 hover:bg-aeac-amber-600 text-black text-[13px] font-bold"
      >
        Catat
      </button>
    </div>
  );
}

function PhoneCard({ r, today, border, onLog }: { r: Row; today: string; border: string; onLog: () => void }) {
  return (
    <article className={'rounded-xl border bg-white p-3.5 flex flex-col gap-2 ' + border}>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/b2b/prospek/${r.id}`} className="min-w-0">
          <div className="font-bold truncate">{r.business_name}</div>
          <div className="text-xs text-neutral-600 truncate">
            {r.area_name}{r.pic_name ? ` · ${r.pic_name}` : ''}
          </div>
        </Link>
        {r.fuKind === 'over' ? (
          <span className="text-xs font-bold text-red-700 whitespace-nowrap">
            {daysBetween(r.next_followup_date!, today)} hari
          </span>
        ) : null}
      </div>
      {r.followup_note ? <p className="text-sm">{r.followup_note}</p> : null}
      <div className="flex gap-2">
        <WaButton r={r} big />
        <button
          type="button"
          onClick={onLog}
          className="flex-1 h-11 rounded-lg bg-aeac-amber-500 text-black text-sm font-bold"
        >
          Catat Aktivitas
        </button>
      </div>
    </article>
  );
}
