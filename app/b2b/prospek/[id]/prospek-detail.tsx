'use client';
// Prospect detail: info cards (left), follow-up + timeline (right).
// "Edit" swaps the cards for the shared form; "Catat Aktivitas" opens the logger.

import Link from 'next/link';
import { useState } from 'react';
import {
  AC_LABEL, ACTIVITY_LABEL, CATEGORY_LABEL, LOST_REASON_LABEL, SOURCE_LABEL, STATUS_LABEL, VENDOR_LABEL,
  daysBetween, fmtDate, fmtDateTime, followupKind, jakartaToday, staffNames, waLink,
  type Activity, type B2BMeta, type ProspectDetail,
} from '@/lib/b2b';
import ProspekForm from '../../_components/prospek-form';
import ActivityLogger from '../../_components/activity-logger';
import { StatusChip } from '../prospek-list';

export default function ProspekDetailView({ detail, meta }: { detail: ProspectDetail; meta: B2BMeta }) {
  const p = detail.prospect;
  const [editing, setEditing] = useState(false);
  const [logging, setLogging] = useState(false);
  const today = jakartaToday();
  const fuKind = followupKind(p.next_followup_date, p.status, today);
  const wa = waLink(p.pic_phone);
  const closed = p.status === 'won' || p.status === 'lost';

  return (
    <main className="px-4 py-6 md:px-10 md:py-8 flex flex-col gap-5 max-w-[1400px] pb-28 md:pb-8">
      <Link href="/b2b/prospek" className="text-sm font-semibold text-aeac-amber-700 hover:underline">
        ← Kembali ke Prospek
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl md:text-[28px] font-bold tracking-tight">{p.business_name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700">
            <StatusChip status={p.status} />
            <span className="rounded-full border border-neutral-300 px-2.5 py-0.5 text-[13px]">{p.area_name}</span>
            <span>{CATEGORY_LABEL[p.category] ?? p.category}</span>
            {p.status === 'lost' && p.lost_reason ? (
              <span className="text-neutral-600">· {LOST_REASON_LABEL[p.lost_reason]}</span>
            ) : null}
          </div>
        </div>
        {!editing ? (
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(true)}
              className="h-11 px-4 rounded-lg border border-neutral-300 bg-white text-sm font-semibold">
              Edit data
            </button>
            <button type="button" onClick={() => setLogging(true)}
              className="hidden md:inline-flex items-center h-11 px-5 rounded-lg bg-aeac-amber-500 hover:bg-aeac-amber-600 text-black text-sm font-bold">
              Catat Aktivitas
            </button>
          </div>
        ) : null}
      </header>

      {editing ? (
        <ProspekForm meta={meta} prospect={p} onCancel={() => setEditing(false)} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
          {/* Left: info */}
          <div className="flex flex-col gap-4">
            <InfoCard title="PIC">
              {p.pic_name ? (
                <>
                  <Row k="Nama" v={p.pic_name} />
                  <Row k="Jabatan" v={p.pic_position} />
                  <Row k="WhatsApp / HP" v={p.pic_phone}>
                    {wa ? (
                      <a href={wa} target="_blank" rel="noreferrer"
                        className="ml-2 inline-flex items-center rounded-md bg-green-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-800">
                        Buka WhatsApp
                      </a>
                    ) : null}
                  </Row>
                  <Row k="Email" v={p.pic_email}>
                    {p.pic_email ? (
                      <a href={`mailto:${p.pic_email}`} className="ml-2 text-xs font-semibold text-aeac-amber-700 hover:underline">
                        Kirim email
                      </a>
                    ) : null}
                  </Row>
                </>
              ) : (
                <p className="text-sm italic text-neutral-500">Belum ada PIC. Klik “Edit data” untuk menambahkan.</p>
              )}
            </InfoCard>

            <InfoCard title="Lokasi">
              <Row k="Alamat" v={p.address} />
              <Row k="Telepon umum" v={p.phone} />
              <Row k="Google Maps" v={p.maps_url ? '' : null}>
                {p.maps_url ? (
                  <a href={p.maps_url} target="_blank" rel="noreferrer" className="text-aeac-amber-700 font-semibold hover:underline">
                    Buka peta
                  </a>
                ) : null}
              </Row>
            </InfoCard>

            <InfoCard title="Peluang AC">
              <Row k="Tipe AC" v={p.ac_types.length ? p.ac_types.map((t) => AC_LABEL[t] ?? t).join(', ') : null} />
              <Row k="Perkiraan unit" v={p.estimated_units != null ? String(p.estimated_units) : null} />
              <Row k="Sudah ada vendor" v={VENDOR_LABEL[p.existing_vendor]} />
              <Row k="Harga vendor" v={p.vendor_price_notes} />
              <Row k="Kebutuhan" v={p.needs} multiline />
            </InfoCard>

            <InfoCard title="Penanganan">
              <Row k="Staf" v={staffNames(p.staff)} />
              <Row k="Sumber" v={p.source ? SOURCE_LABEL[p.source] : null} />
              <Row k="Dibuat" v={fmtDateTime(p.created_at)} />
            </InfoCard>
          </div>

          {/* Right: follow-up + timeline */}
          <div className="flex flex-col gap-4">
            <section className={
              'rounded-xl border p-5 flex flex-col gap-2 ' +
              (fuKind === 'over' ? 'border-red-300 bg-red-50'
                : fuKind === 'today' ? 'border-aeac-amber-400 bg-aeac-amber-50'
                : 'border-neutral-200 bg-white')
            }>
              <h2 className="text-[17px] font-bold">Follow-up berikut</h2>
              {closed ? (
                <p className="text-sm text-neutral-700">
                  Prospek sudah {STATUS_LABEL[p.status].toLowerCase()} — tidak ada follow-up.
                </p>
              ) : p.next_followup_date ? (
                <>
                  <p className={'text-lg font-bold ' +
                    (fuKind === 'over' ? 'text-red-700' : fuKind === 'today' ? 'text-amber-800' : 'text-neutral-900')}>
                    {fuKind === 'today' ? 'Hari ini' : fmtDate(p.next_followup_date)}
                    {fuKind === 'over' ? ` · terlambat ${daysBetween(p.next_followup_date, today)} hari` : ''}
                  </p>
                  {p.followup_note ? <p className="text-sm text-neutral-800">{p.followup_note}</p> : null}
                </>
              ) : (
                <p className="text-sm text-neutral-600">Belum dijadwalkan.</p>
              )}
              <button type="button" onClick={() => setLogging(true)}
                className="mt-2 hidden md:inline-flex self-start items-center h-10 px-4 rounded-lg bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800">
                Catat Aktivitas
              </button>
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-5">
              <h2 className="text-[17px] font-bold mb-4">Riwayat aktivitas</h2>
              <ol className="flex flex-col">
                {detail.activities.map((a, i) => (
                  <TimelineItem key={a.id} a={a} last={i === detail.activities.length - 1} />
                ))}
              </ol>
            </section>
          </div>
        </div>
      )}

      {/* Mobile sticky action */}
      {!editing ? (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white/95 border-t border-neutral-200 p-3">
          <button type="button" onClick={() => setLogging(true)}
            className="w-full h-12 rounded-lg bg-aeac-amber-500 text-black font-bold">
            Catat Aktivitas
          </button>
        </div>
      ) : null}

      {logging ? (
        <ActivityLogger prospect={p} meta={meta} onClose={() => setLogging(false)} />
      ) : null}
    </main>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 flex flex-col gap-2.5">
      <h2 className="text-[17px] font-bold mb-1">{title}</h2>
      {children}
    </section>
  );
}

function Row({
  k, v, multiline, children,
}: { k: string; v: string | null | undefined; multiline?: boolean; children?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 text-sm">
      <span className="text-neutral-600">{k}</span>
      <span className={(multiline ? 'whitespace-pre-line ' : '') + 'text-neutral-900 break-words'}>
        {v ? v : children ? null : <span className="text-neutral-400">—</span>}
        {children}
      </span>
    </div>
  );
}

function TimelineItem({ a, last }: { a: Activity; last: boolean }) {
  const isCreated = a.activity_type === 'created';
  return (
    <li className="relative pl-7 pb-5">
      {!last ? <span className="absolute left-[7px] top-4 bottom-0 w-px bg-neutral-200" aria-hidden="true" /> : null}
      <span
        className={'absolute left-0 top-1 w-[15px] h-[15px] rounded-full border-2 ' +
          (a.status_to ? 'bg-aeac-amber-400 border-aeac-amber-600' : 'bg-white border-neutral-400')}
        aria-hidden="true"
      />
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-semibold text-sm">{ACTIVITY_LABEL[a.activity_type] ?? a.activity_type}</span>
        <span className="text-xs text-neutral-600">{fmtDateTime(a.activity_at)}</span>
        <span className="text-xs text-neutral-600">· {staffNames(a.staff)}</span>
      </div>
      {a.status_to ? (
        <div className="mt-1 text-[13px] text-neutral-800">
          {a.status_from ? (
            <>Status: {STATUS_LABEL[a.status_from]} → <strong>{STATUS_LABEL[a.status_to]}</strong></>
          ) : (
            <>Status awal: <strong>{STATUS_LABEL[a.status_to]}</strong></>
          )}
        </div>
      ) : null}
      {a.notes && !isCreated ? <p className="mt-1 text-sm text-neutral-900 whitespace-pre-line">{a.notes}</p> : null}
      {a.next_followup_date ? (
        <p className="mt-1 text-xs text-neutral-600">Follow-up berikut dijadwalkan: {fmtDate(a.next_followup_date)}</p>
      ) : null}
    </li>
  );
}
