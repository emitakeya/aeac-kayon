'use client';
// app/b2b/penawaran/_components/penawaran-editor.tsx
// Proposal editor: template → document info → blocks (every block editable,
// hideable, movable) → live A4 preview. Actions are separate on purpose:
//   Simpan draf        — saves
//   Unduh PDF          — saves, then downloads (nothing is sent)
//   Catat pengiriman…  — records, after staff sent the PDF themselves

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtDateTime, type B2BMeta } from '@/lib/b2b';
import {
  TEMPLATE_INFO, TEMPLATE_LABEL, itemsTotal, lineTotal, newBlockId, parseRupiah, pdfFilename, rupiah,
  templateBlocks, unfilledPlaceholders, unitCount,
  type Block, type Item, type ProposalDraft, type TemplateKey,
} from '@/lib/b2b-penawaran';
import PenawaranPreview from './penawaran-preview';
import CatatPengiriman from './catat-pengiriman';

type ProspectInfo = { id: string; business_name: string; address: string | null; pic_phone: string | null; status: string };
type SavedInfo = { status: 'draft' | 'sent'; sent_at: string | null; updated_at: string; updated_by_name: string | null };

const INPUT = 'h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm focus:border-aeac-amber-500 focus:outline-none';
const AREA = 'w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed focus:border-aeac-amber-500 focus:outline-none';
const BTN = 'h-11 px-4 rounded-lg border border-neutral-300 bg-white text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50';

const KIND_LABEL: Record<Block['kind'], string> = { text: 'Paragraf', list: 'Daftar poin', table: 'Tabel harga', callout: 'Kotak penutup' };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function PenawaranEditor({
  initial, prospect, meta, saved,
}: {
  initial: ProposalDraft;
  prospect: ProspectInfo;
  meta: B2BMeta;
  saved: SavedInfo | null;
}) {
  const router = useRouter();
  const [d, setD] = useState<ProposalDraft>(initial);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<null | 'save' | 'pdf' | 'delete'>(null);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);

  const total = useMemo(() => itemsTotal(d.items), [d.items]);
  const units = useMemo(() => unitCount(d.items), [d.items]);
  const tableVisible = d.blocks.some((b) => b.kind === 'table' && b.visible);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  function patch(p: Partial<ProposalDraft>) {
    setD((x) => ({ ...x, ...p }));
    setDirty(true);
    setNotice(null);
  }
  const setBlock = (i: number, p: Partial<Block>) =>
    patch({ blocks: d.blocks.map((b, j) => (j === i ? { ...b, ...p } : b)) });
  const moveBlock = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= d.blocks.length) return;
    const xs = [...d.blocks];
    [xs[i], xs[j]] = [xs[j], xs[i]];
    patch({ blocks: xs });
  };
  const removeBlock = (i: number) => {
    if (!window.confirm(`Hapus blok “${d.blocks[i].title || KIND_LABEL[d.blocks[i].kind]}”?`)) return;
    patch({ blocks: d.blocks.filter((_, j) => j !== i) });
  };
  const addBlock = (kind: 'text' | 'list') => {
    const blk: Block = { id: newBlockId(), kind, title: kind === 'list' ? 'Poin' : 'Paragraf tambahan', text: '', visible: true };
    // insert before the closing box if there is one
    const ci = d.blocks.findIndex((b) => b.kind === 'callout');
    const xs = [...d.blocks];
    xs.splice(ci >= 0 ? ci : xs.length, 0, blk);
    patch({ blocks: xs });
  };

  const setItem = (i: number, p: Partial<Item>) =>
    patch({ items: d.items.map((it, j) => (j === i ? { ...it, ...p } : it)) });

  function pickTemplate(t: TemplateKey) {
    if (t === d.template) return;
    if (!window.confirm(`Ganti ke template “${TEMPLATE_LABEL[t]}”? Isi paragraf diganti dengan teks template. Tabel harga dan info dokumen tetap.`)) return;
    patch({ template: t, blocks: templateBlocks(t) });
  }

  /** Saves and returns the proposal id (null on error). */
  async function save(): Promise<string | null> {
    setErr(null);
    setBusy('save');
    const { data, error } = await createClient().rpc('b2b_save_proposal', {
      p: { ...d, items: d.items.filter((it) => it.label.trim()) },
    });
    setBusy(null);
    if (error) { setErr(error.message); return null; }
    const id = data as string;
    setDirty(false);
    if (!d.id) {
      setD((x) => ({ ...x, id }));
      // Update the URL without remounting (keeps state, e.g. a PDF in progress).
      window.history.replaceState(null, '', `/b2b/penawaran/${id}`);
    } else {
      router.refresh();
    }
    setNotice('Tersimpan.');
    return id;
  }

  async function downloadPdf() {
    const holes = unfilledPlaceholders(d);
    if (holes.length && !window.confirm(
      `Masih ada teks yang belum diisi: ${holes.join(', ')}\n\nTetap unduh PDF?`)) return;
    if (tableVisible && d.items.some((it) => it.label.trim() && !it.price)) {
      if (!window.confirm('Ada baris harga yang masih Rp 0. Tetap unduh PDF?')) return;
    }
    const id = dirty || !d.id ? await save() : d.id;
    if (!id) return;
    setBusy('pdf');
    try {
      const [{ pdf }, { PenawaranPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./penawaran-pdf'),
      ]);
      const blob = await pdf(
        <PenawaranPDF draft={d} businessName={prospect.business_name} address={prospect.address} />,
      ).toBlob();
      downloadBlob(blob, pdfFilename(prospect.business_name, d.proposal_date));
      setNotice('PDF diunduh. Kirim lewat WhatsApp, lalu klik “Catat pengiriman”.');
    } catch (e) {
      setErr(e instanceof Error ? `Gagal membuat PDF: ${e.message}` : 'Gagal membuat PDF');
    } finally {
      setBusy(null);
    }
  }

  async function openLogger() {
    const id = dirty || !d.id ? await save() : d.id;
    if (id) setLogging(true);
  }

  async function deleteDraft() {
    if (!d.id || !window.confirm('Hapus draf penawaran ini?')) return;
    setBusy('delete');
    const { error } = await createClient().rpc('b2b_delete_proposal', { p_id: d.id });
    setBusy(null);
    if (error) return setErr(error.message);
    setDirty(false);
    router.push(`/b2b/prospek/${prospect.id}`);
  }

  return (
    <main className="px-4 py-6 md:px-10 md:py-8 flex flex-col gap-5 max-w-[1400px]">
      <nav className="text-sm text-neutral-600" aria-label="Breadcrumb">
        <Link href="/b2b/penawaran" className="font-semibold text-aeac-amber-700 hover:underline">Penawaran</Link>
        {' / '}
        <Link href={`/b2b/prospek/${prospect.id}`} className="font-semibold text-aeac-amber-700 hover:underline">
          {prospect.business_name}
        </Link>
        {' / '}{d.id ? 'Edit' : 'Baru'}
      </nav>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl md:text-[28px] font-bold tracking-tight">{d.id ? 'Edit Penawaran' : 'Buat Penawaran'}</h1>
        {saved?.status === 'sent' ? (
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
            Terkirim{saved.sent_at ? ` · ${fmtDateTime(saved.sent_at)}` : ''}
          </span>
        ) : (
          <span className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-700">Draf</span>
        )}
        {dirty ? <span className="text-xs text-amber-800">Ada perubahan belum disimpan</span> : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] items-start">
        {/* ── Editor ─────────────────────────────── */}
        <div className="flex flex-col gap-6 min-w-0">
          <section className="flex flex-col gap-2.5">
            <h2 id="tpl-h" className="text-[13px] font-semibold uppercase tracking-wide text-neutral-600">1 · Template</h2>
            <div role="group" aria-labelledby="tpl-h" className="grid gap-3 sm:grid-cols-3">
              {TEMPLATE_INFO.map((t) => {
                const on = d.template === t.key;
                return (
                  <button key={t.key} type="button" aria-pressed={on} onClick={() => pickTemplate(t.key)}
                    className={'text-left rounded-xl border px-4 py-3 flex flex-col gap-1 transition ' +
                      (on ? 'border-2 border-aeac-amber-600 bg-aeac-amber-50' : 'border-neutral-300 bg-white hover:border-neutral-500')}>
                    <span className="font-bold text-[15px]">{t.label}</span>
                    <span className="text-[13px] text-neutral-600">{t.hint}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-600">2 · Info dokumen</h2>
            <div className="rounded-xl border border-neutral-200 bg-white p-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Field id="f-title" label="Judul">
                <input id="f-title" className={INPUT} value={d.title} onChange={(e) => patch({ title: e.target.value })} />
              </Field>
              <Field id="f-rcp" label="Kepada">
                <input id="f-rcp" className={INPUT} value={d.recipient} placeholder="mis. Bu Ata"
                  onChange={(e) => patch({ recipient: e.target.value })} />
              </Field>
              <Field id="f-date" label="Tanggal">
                <input id="f-date" type="date" className={INPUT} value={d.proposal_date}
                  onChange={(e) => patch({ proposal_date: e.target.value })} />
              </Field>
              <Field id="f-valid" label="Berlaku sampai">
                <input id="f-valid" type="date" className={INPUT} value={d.valid_until}
                  onChange={(e) => patch({ valid_until: e.target.value })} />
              </Field>
              <Field id="f-sender" label="Pengirim">
                <input id="f-sender" className={INPUT} value={d.sender_name} list="b2b-staff-names"
                  onChange={(e) => patch({ sender_name: e.target.value })} />
                <datalist id="b2b-staff-names">
                  {meta.staff.map((s) => <option key={s.id} value={s.name} />)}
                </datalist>
              </Field>
              <Field id="f-wa" label="WhatsApp di footer">
                <input id="f-wa" className={INPUT} value={d.sender_phone}
                  onChange={(e) => patch({ sender_phone: e.target.value })} />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-2.5">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-600">
              3 · Isi penawaran <span className="normal-case font-normal tracking-normal">— semua bisa diubah · teks di [kurung] wajib diganti · **tebal**</span>
            </h2>

            {d.blocks.map((bl, i) => (
              <div key={bl.id} className={'rounded-xl border bg-white p-4 flex flex-col gap-2.5 ' +
                (bl.kind === 'table' ? 'border-neutral-400' : 'border-neutral-200') + (bl.visible ? '' : ' opacity-60')}>
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor={`bt-${bl.id}`} className="sr-only">Nama blok</label>
                  <input id={`bt-${bl.id}`} value={bl.title} onChange={(e) => setBlock(i, { title: e.target.value })}
                    className="min-w-0 flex-1 rounded-md border border-transparent px-1.5 py-1 font-bold text-[15px] hover:border-neutral-300 focus:border-aeac-amber-500 focus:outline-none" />
                  <span className="text-[11px] text-neutral-500">{KIND_LABEL[bl.kind]}{bl.kind === 'list' ? ' · judul tercetak' : ''}</span>
                  <label className="flex items-center gap-1.5 text-[13px] ml-1">
                    <input type="checkbox" checked={bl.visible} onChange={(e) => setBlock(i, { visible: e.target.checked })}
                      className="w-4 h-4 accent-amber-500" />
                    Tampilkan
                  </label>
                  <div className="flex gap-1">
                    <IconBtn label="Naikkan" onClick={() => moveBlock(i, -1)} disabled={i === 0} path="M4 10l4-4 4 4" />
                    <IconBtn label="Turunkan" onClick={() => moveBlock(i, 1)} disabled={i === d.blocks.length - 1} path="M4 6l4 4 4-4" />
                    <IconBtn label="Hapus blok" onClick={() => removeBlock(i)} path="M4 4l8 8M12 4l-8 8" />
                  </div>
                </div>

                {bl.kind === 'table' ? (
                  <ItemsEditor items={d.items} setItem={setItem}
                    add={() => patch({ items: [...d.items, { label: '', qty: 1, normal_price: '', price: 0 }] })}
                    remove={(j) => patch({ items: d.items.filter((_, k) => k !== j) })}
                    total={total} units={units} />
                ) : (
                  <>
                    <label htmlFor={`bx-${bl.id}`} className="sr-only">{bl.title}</label>
                    <textarea id={`bx-${bl.id}`} className={AREA}
                      rows={Math.min(8, Math.max(2, Math.ceil(bl.text.length / 90) + bl.text.split('\n').length - 1))}
                      value={bl.text} onChange={(e) => setBlock(i, { text: e.target.value })} />
                    {bl.kind === 'list' ? <p className="text-xs text-neutral-500">Satu baris = satu poin.</p> : null}
                    {bl.kind === 'callout' ? <p className="text-xs text-neutral-500">Tanggal “berlaku sampai” tampil di kotak ini.</p> : null}
                  </>
                )}
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => addBlock('text')}
                className="h-10 px-4 rounded-lg border border-dashed border-neutral-400 bg-white text-sm font-semibold">+ Paragraf</button>
              <button type="button" onClick={() => addBlock('list')}
                className="h-10 px-4 rounded-lg border border-dashed border-neutral-400 bg-white text-sm font-semibold">+ Daftar poin</button>
              {!d.blocks.some((b) => b.kind === 'table') ? (
                <button type="button" onClick={() => patch({ blocks: [...d.blocks, { id: newBlockId(), kind: 'table', title: 'Tabel harga', text: '', visible: true }] })}
                  className="h-10 px-4 rounded-lg border border-dashed border-neutral-400 bg-white text-sm font-semibold">+ Tabel harga</button>
              ) : null}
            </div>
          </section>
        </div>

        {/* ── Preview + actions ─────────────────── */}
        <aside className="flex flex-col gap-3 lg:sticky lg:top-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-neutral-600">Pratinjau PDF</h2>
            <span className="text-xs text-neutral-500">A4</span>
          </div>
          <PenawaranPreview draft={d} businessName={prospect.business_name} address={prospect.address} />

          {err ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p> : null}
          {notice ? <p role="status" className="rounded-lg bg-green-50 px-4 py-2.5 text-sm text-green-800">{notice}</p> : null}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void downloadPdf()} disabled={busy !== null}
              className="h-12 rounded-lg bg-aeac-amber-500 hover:bg-aeac-amber-600 text-black font-bold disabled:opacity-50">
              {busy === 'pdf' ? 'Menyusun…' : 'Unduh PDF'}
            </button>
            <button type="button" onClick={() => void save()} disabled={busy !== null || (!dirty && !!d.id)} className={BTN + ' h-12'}>
              {busy === 'save' ? 'Menyimpan…' : 'Simpan draf'}
            </button>
          </div>
          <div className="border-t border-neutral-200 pt-3 flex flex-col gap-2">
            <p className="text-[13px] text-neutral-600">Sudah dikirim ke klien? Catat terpisah — tidak ada yang terkirim otomatis.</p>
            <button type="button" onClick={() => void openLogger()} disabled={busy !== null} className={BTN}>
              Catat pengiriman…
            </button>
            {d.id && saved?.status !== 'sent' ? (
              <button type="button" onClick={() => void deleteDraft()} disabled={busy !== null}
                className="self-start text-xs font-semibold text-red-700 hover:underline disabled:opacity-50">
                Hapus draf
              </button>
            ) : null}
            {saved ? (
              <p className="text-xs text-neutral-500">
                Terakhir disimpan {fmtDateTime(saved.updated_at)}{saved.updated_by_name ? ` oleh ${saved.updated_by_name}` : ''}
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      {logging && d.id ? (
        <CatatPengiriman proposalId={d.id} draft={d} prospect={prospect} meta={meta} onClose={() => setLogging(false)} />
      ) : null}
    </main>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">{label}</label>
      {children}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, path }: { label: string; onClick: () => void; disabled?: boolean; path: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className="w-9 h-9 rounded-md border border-neutral-200 bg-white flex items-center justify-center hover:bg-neutral-50 disabled:opacity-30">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={path} />
      </svg>
    </button>
  );
}

function ItemsEditor({
  items, setItem, add, remove, total, units,
}: {
  items: Item[];
  setItem: (i: number, p: Partial<Item>) => void;
  add: () => void;
  remove: (i: number) => void;
  total: number;
  units: number;
}) {
  const cols = 'grid grid-cols-[minmax(0,2.2fr)_70px_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1fr)_36px] gap-2 items-center';
  return (
    <div className="flex flex-col gap-2 overflow-x-auto">
      <div className={cols + ' min-w-[560px] text-xs font-semibold text-neutral-600'}>
        <span>Jenis unit</span><span>Jumlah</span><span>Harga normal (teks)</span><span>Harga korporat</span>
        <span className="text-right">Subtotal</span><span />
      </div>
      {items.map((it, i) => (
        <div key={i} className={cols + ' min-w-[560px]'}>
          <input aria-label={`Jenis unit baris ${i + 1}`} value={it.label} placeholder="mis. AC Split (semua ukuran)"
            onChange={(e) => setItem(i, { label: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2.5 text-sm min-w-0" />
          <input aria-label={`Jumlah baris ${i + 1}`} inputMode="numeric" value={it.qty ? String(it.qty) : ''}
            onChange={(e) => setItem(i, { qty: parseRupiah(e.target.value) })}
            className="h-10 rounded-md border border-neutral-300 px-2.5 text-sm tabular-nums min-w-0" />
          <input aria-label={`Harga normal baris ${i + 1}`} value={it.normal_price} placeholder="mis. Rp 90.000–120.000"
            onChange={(e) => setItem(i, { normal_price: e.target.value })}
            className="h-10 rounded-md border border-neutral-300 px-2.5 text-sm min-w-0" />
          <input aria-label={`Harga korporat baris ${i + 1}`} inputMode="numeric"
            value={it.price ? it.price.toLocaleString('id-ID') : ''} placeholder="0"
            onChange={(e) => setItem(i, { price: parseRupiah(e.target.value) })}
            className="h-10 rounded-md border border-neutral-300 px-2.5 text-sm font-semibold tabular-nums min-w-0" />
          <span className="text-right text-sm font-semibold tabular-nums">{rupiah(lineTotal(it))}</span>
          <button type="button" aria-label={`Hapus baris ${i + 1}`} onClick={() => remove(i)}
            className="w-9 h-9 rounded-md border border-neutral-200 bg-white flex items-center justify-center hover:bg-neutral-50">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-3 min-w-[560px]">
        <button type="button" onClick={add}
          className="h-10 px-4 rounded-lg border border-dashed border-neutral-400 bg-white text-sm font-semibold">+ Tambah baris</button>
        <div className="flex items-baseline gap-3">
          <span className="text-sm text-neutral-700">Total per kunjungan{units ? ` · ${units} unit` : ''}</span>
          <span className="rounded-md bg-aeac-amber-50 px-2.5 py-1 text-xl font-bold tabular-nums">{rupiah(total)}</span>
        </div>
      </div>
      <p className="text-xs text-neutral-500">Jumlah unit diambil dari Peluang AC di Prospek. Total dihitung otomatis.</p>
    </div>
  );
}
