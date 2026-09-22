'use client';
// "Catat Aktivitas" — quick logger. Full-screen sheet on phones, dialog on desktop.
// One save = activity row + (optional) status change + new next follow-up,
// all in b2b_log_activity() as a single transaction.

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  ACTIVITY_TYPES, LOST_REASONS, STATUSES, addDays, jakartaNowLocal, jakartaToday, localToIso,
  type B2BMeta, type Prospect,
} from '@/lib/b2b';
import { Chips } from './chips';

const QUICK: [string, number][] = [['Besok', 1], ['3 hari', 3], ['1 minggu', 7], ['2 minggu', 14]];

export default function ActivityLogger({
  prospect, meta, onClose,
}: { prospect: Prospect; meta: B2BMeta; onClose: () => void }) {
  const router = useRouter();
  const today = jakartaToday();
  const [type, setType] = useState('');
  const [notes, setNotes] = useState('');
  const [at, setAt] = useState(jakartaNowLocal());
  const [staff, setStaff] = useState<string[]>([meta.me]);
  const [status, setStatus] = useState(prospect.status);
  const [lostReason, setLostReason] = useState('');
  const [fuMode, setFuMode] = useState<'date' | 'none'>('date');
  const [fuDate, setFuDate] = useState('');
  const [fuNote, setFuNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const closing = status === 'won' || status === 'lost';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  async function save() {
    setErr(null);
    if (!type) return setErr('Pilih jenis aktivitas.');
    if (status === 'lost' && !lostReason) return setErr('Pilih alasan gagal.');
    if (!closing && fuMode === 'date' && !fuDate)
      return setErr('Pilih tanggal follow-up berikut, atau pilih “Tidak ada follow-up”.');

    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('b2b_log_activity', {
      p: {
        prospect_id: prospect.id,
        activity_type: type,
        activity_at: localToIso(at),
        notes,
        staff_ids: staff,
        status_to: status !== prospect.status ? status : null,
        lost_reason: status === 'lost' ? lostReason : null,
        next_followup_date: !closing && fuMode === 'date' ? fuDate : null,
        followup_note: !closing && fuMode === 'date' ? fuNote : null,
      },
    });
    setSaving(false);
    if (error) return setErr(error.message);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex md:items-center md:justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logger-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-xl md:rounded-2xl flex flex-col"
      >
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-neutral-200">
          <div className="min-w-0">
            <h2 id="logger-title" className="text-lg font-bold">Catat Aktivitas</h2>
            <p className="text-xs text-neutral-600 truncate">{prospect.business_name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup"
            className="w-11 h-11 rounded-lg text-2xl leading-none text-neutral-700 hover:bg-neutral-100">
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span id="lg-type" className="text-[13px] font-semibold">Jenis aktivitas *</span>
            <Chips options={ACTIVITY_TYPES} selected={type ? [type] : []} onToggle={setType} labelledBy="lg-type" size="lg" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="lg-notes" className="text-[13px] font-semibold">Catatan / hasil</label>
            <textarea id="lg-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="mis. Bertemu building manager, minta company profile via WA"
              className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm focus:border-aeac-amber-500 focus:outline-none" />
          </div>

          <div className="flex flex-col gap-2">
            <span id="lg-staff" className="text-[13px] font-semibold">Siapa yang ikut</span>
            <Chips options={meta.staff.map((s) => [s.id, s.name] as [string, string])} selected={staff}
              onToggle={(k) => setStaff((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))}
              labelledBy="lg-staff" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="lg-at" className="text-[13px] font-semibold">Waktu</label>
            <input id="lg-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)}
              className="h-11 w-full md:w-64 rounded-lg border border-neutral-300 px-3 text-sm" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="lg-status" className="text-[13px] font-semibold">Status</label>
            <select id="lg-status" value={status} onChange={(e) => setStatus(e.target.value)}
              className="h-11 w-full md:w-64 rounded-lg border border-neutral-300 bg-white px-3 text-sm">
              {STATUSES.map(([k, l]) => (
                <option key={k} value={k}>{l}{k === prospect.status ? ' (sekarang)' : ''}</option>
              ))}
            </select>
            {status === 'lost' ? (
              <div className="mt-2 flex flex-col gap-2">
                <span id="lg-lost" className="text-[13px] font-semibold">Alasan gagal *</span>
                <Chips options={LOST_REASONS} selected={lostReason ? [lostReason] : []}
                  onToggle={setLostReason} labelledBy="lg-lost" />
              </div>
            ) : null}
          </div>

          {!closing ? (
            <div className="flex flex-col gap-2 rounded-xl bg-neutral-50 p-4">
              <span className="text-[13px] font-semibold">Follow-up berikut *</span>
              <div className="flex flex-wrap gap-2">
                {QUICK.map(([l, n]) => {
                  const d = addDays(today, n);
                  const on = fuMode === 'date' && fuDate === d;
                  return (
                    <button key={l} type="button" aria-pressed={on}
                      onClick={() => { setFuMode('date'); setFuDate(d); }}
                      className={'min-h-11 px-4 rounded-full text-sm font-semibold border ' +
                        (on ? 'bg-aeac-amber-100 text-amber-900 border-2 border-aeac-amber-600' : 'bg-white border-neutral-300')}>
                      {l}
                    </button>
                  );
                })}
                <button type="button" aria-pressed={fuMode === 'none'} onClick={() => setFuMode('none')}
                  className={'min-h-11 px-4 rounded-full text-sm font-semibold border ' +
                    (fuMode === 'none' ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white border-neutral-300')}>
                  Tidak ada follow-up
                </button>
              </div>
              {fuMode === 'date' ? (
                <>
                  <label htmlFor="lg-fu" className="sr-only">Tanggal follow-up</label>
                  <input id="lg-fu" type="date" min={today} value={fuDate}
                    onChange={(e) => { setFuMode('date'); setFuDate(e.target.value); }}
                    className="h-11 w-full md:w-64 rounded-lg border border-neutral-300 bg-white px-3 text-sm" />
                  <label htmlFor="lg-fun" className="sr-only">Rencana follow-up</label>
                  <input id="lg-fun" value={fuNote} onChange={(e) => setFuNote(e.target.value)}
                    placeholder="Rencana, mis. tanyakan jadwal survei"
                    className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3.5 text-sm" />
                </>
              ) : null}
            </div>
          ) : (
            <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
              Status {status === 'won' ? 'Deal' : 'Gagal'} menutup prospek — follow-up tidak dijadwalkan lagi.
            </p>
          )}

          {err ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
          ) : null}
        </div>

        <footer className="flex gap-3 px-5 py-4 border-t border-neutral-200">
          <button type="button" onClick={onClose}
            className="h-12 px-5 rounded-lg border border-neutral-300 bg-white text-sm font-semibold">
            Batal
          </button>
          <button type="button" onClick={() => void save()} disabled={saving}
            className="flex-1 h-12 rounded-lg bg-aeac-amber-500 hover:bg-aeac-amber-600 text-black font-bold disabled:opacity-50">
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </footer>
      </div>
    </div>
  );
}
