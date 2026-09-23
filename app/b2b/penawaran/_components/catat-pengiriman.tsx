'use client';
// app/b2b/penawaran/_components/catat-pengiriman.tsx
// "Catat pengiriman" — records that staff sent the PDF THEMSELVES.
// The system never sends anything: this only logs a Penawaran activity,
// optionally moves the status to Penawaran and sets the next follow-up
// (b2b_mark_proposal_sent → b2b_log_activity, one transaction).

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { STATUS_LABEL, addDays, jakartaToday, waLink, type B2BMeta } from '@/lib/b2b';
import { itemsTotal, rupiah, waMessage, type ProposalDraft } from '@/lib/b2b-penawaran';
import { Chips } from '../../_components/chips';

const EARLY = ['new_lead', 'pic_found', 'contacted', 'interested', 'survey'];
const QUICK: [string, number][] = [['3 hari', 3], ['1 minggu', 7], ['2 minggu', 14]];

export default function CatatPengiriman({
  proposalId, draft, prospect, meta, onClose,
}: {
  proposalId: string;
  draft: ProposalDraft;
  prospect: { business_name: string; status: string; pic_phone: string | null };
  meta: B2BMeta;
  onClose: () => void;
}) {
  const router = useRouter();
  const today = jakartaToday();
  const [msg, setMsg] = useState(() => waMessage(draft, draft.sender_name));
  const [copied, setCopied] = useState(false);
  const [staff, setStaff] = useState<string[]>([meta.me]);
  const canMove = EARLY.includes(prospect.status);
  const [moveStatus, setMoveStatus] = useState(canMove);
  const [fuMode, setFuMode] = useState<'date' | 'none'>('date');
  const [fuDate, setFuDate] = useState(addDays(today, 7));
  const [fuNote, setFuNote] = useState('Tanyakan tanggapan atas penawaran');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const wa = waLink(prospect.pic_phone);
  const waHref = wa ? `${wa}?text=${encodeURIComponent(msg)}` : null;
  const total = itemsTotal(draft.items);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(msg);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr('Gagal menyalin — pilih teksnya lalu salin manual.');
    }
  }

  async function save() {
    setErr(null);
    if (fuMode === 'date' && !fuDate) return setErr('Pilih tanggal follow-up, atau pilih “Tidak ada follow-up”.');
    setSaving(true);
    const { error } = await createClient().rpc('b2b_mark_proposal_sent', {
      p: {
        proposal_id: proposalId,
        staff_ids: staff,
        status_to: moveStatus ? 'quotation' : null,
        next_followup_date: fuMode === 'date' ? fuDate : null,
        followup_note: fuMode === 'date' ? fuNote : null,
      },
    });
    setSaving(false);
    if (error) return setErr(error.message);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex md:items-center md:justify-center bg-black/40" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="cp-title" onClick={(e) => e.stopPropagation()}
        className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-xl md:rounded-2xl flex flex-col">
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-neutral-200">
          <div className="min-w-0">
            <h2 id="cp-title" className="text-lg font-bold">Catat pengiriman</h2>
            <p className="text-xs text-neutral-600 truncate">{prospect.business_name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup"
            className="w-11 h-11 rounded-lg text-2xl leading-none text-neutral-700 hover:bg-neutral-100">×</button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          <p className="rounded-lg bg-aeac-amber-50 px-4 py-3 text-sm text-neutral-800">
            Penawaran{total > 0 ? <> · <strong>{rupiah(total)}</strong></> : null}. Sistem tidak mengirim apa pun —
            Anda yang mengirim PDF lewat WhatsApp. Di sini hanya dicatat.
          </p>

          <div className="flex flex-col gap-2">
            <label htmlFor="cp-msg" className="text-[13px] font-semibold">
              Pesan WhatsApp <span className="font-normal text-neutral-600">(opsional — bantuan menyalin)</span>
            </label>
            <textarea id="cp-msg" rows={5} value={msg} onChange={(e) => setMsg(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm focus:border-aeac-amber-500 focus:outline-none" />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void copy()}
                className="h-10 px-4 rounded-lg border border-neutral-300 bg-white text-sm font-semibold">
                {copied ? 'Tersalin ✓' : 'Salin pesan'}
              </button>
              {waHref ? (
                <a href={waHref} target="_blank" rel="noreferrer"
                  className="inline-flex items-center h-10 px-4 rounded-lg border border-neutral-300 bg-white text-sm font-semibold hover:bg-neutral-50">
                  Buka WhatsApp PIC
                </a>
              ) : (
                <span className="self-center text-xs text-neutral-600">Nomor PIC belum ada.</span>
              )}
            </div>
            <p className="text-xs text-neutral-600">Lampirkan file PDF secara manual di WhatsApp.</p>
          </div>

          <div className="flex flex-col gap-2">
            <span id="cp-staff" className="text-[13px] font-semibold">Dikirim oleh</span>
            <Chips options={meta.staff.map((st) => [st.id, st.name] as [string, string])} selected={staff}
              onToggle={(k) => setStaff((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]))}
              labelledBy="cp-staff" />
          </div>

          {canMove ? (
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" checked={moveStatus} onChange={(e) => setMoveStatus(e.target.checked)}
                className="w-5 h-5 accent-amber-500" />
              Ubah status {STATUS_LABEL[prospect.status]} → <strong>Penawaran</strong>
            </label>
          ) : null}

          <div className="flex flex-col gap-2 rounded-xl bg-neutral-50 p-4">
            <span className="text-[13px] font-semibold">Follow-up berikut</span>
            <div className="flex flex-wrap gap-2">
              {QUICK.map(([l, n]) => {
                const d = addDays(today, n);
                const on = fuMode === 'date' && fuDate === d;
                return (
                  <button key={l} type="button" aria-pressed={on} onClick={() => { setFuMode('date'); setFuDate(d); }}
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
                <label htmlFor="cp-fu" className="sr-only">Tanggal follow-up</label>
                <input id="cp-fu" type="date" min={today} value={fuDate} onChange={(e) => setFuDate(e.target.value)}
                  className="h-11 w-full md:w-64 rounded-lg border border-neutral-300 bg-white px-3 text-sm" />
                <label htmlFor="cp-fun" className="sr-only">Rencana follow-up</label>
                <input id="cp-fun" value={fuNote} onChange={(e) => setFuNote(e.target.value)}
                  className="h-11 w-full rounded-lg border border-neutral-300 bg-white px-3.5 text-sm" />
              </>
            ) : null}
          </div>

          {err ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
          ) : null}
        </div>

        <footer className="flex gap-3 px-5 py-4 border-t border-neutral-200">
          <button type="button" onClick={onClose}
            className="h-12 px-5 rounded-lg border border-neutral-300 bg-white text-sm font-semibold">Batal</button>
          <button type="button" onClick={() => void save()} disabled={saving}
            className="flex-1 h-12 rounded-lg bg-aeac-amber-500 hover:bg-aeac-amber-600 text-black font-bold disabled:opacity-50">
            {saving ? 'Menyimpan…' : 'Simpan catatan'}
          </button>
        </footer>
      </div>
    </div>
  );
}
