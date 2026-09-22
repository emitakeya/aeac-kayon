'use client';
// Create / edit form for a prospect.
// Only business name, category and area are required.
// Status and follow-up are set here only on create; afterwards they change
// through "Catat Aktivitas" so every change lands in the timeline.

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  AC_TYPES, CATEGORIES, SOURCES, STATUSES, VENDOR, addDays, jakartaToday,
  type B2BMeta, type Prospect,
} from '@/lib/b2b';
import AreaPicker, { type AreaValue } from './area-picker';
import { Chips } from './chips';

const INPUT =
  'h-11 w-full rounded-lg border border-neutral-300 bg-white px-3.5 text-sm focus:border-aeac-amber-500 focus:outline-none';
const TEXTAREA =
  'w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm focus:border-aeac-amber-500 focus:outline-none resize-y';
const LABEL = 'text-[13px] font-semibold text-neutral-900';

type Form = {
  business_name: string;
  category: string;
  area: AreaValue;
  address: string;
  maps_url: string;
  phone: string;
  pic_name: string;
  pic_position: string;
  pic_phone: string;
  pic_email: string;
  ac_types: string[];
  estimated_units: string;
  existing_vendor: string;
  vendor_price_notes: string;
  needs: string;
  source: string;
  staff_ids: string[];
  // create only
  status: string;
  next_followup_date: string;
  followup_note: string;
};

function initial(p: Prospect | null, me: string): Form {
  return {
    business_name: p?.business_name ?? '',
    category: p?.category ?? '',
    area: p ? { id: p.area_id, name: p.area_name } : { id: null, name: '' },
    address: p?.address ?? '',
    maps_url: p?.maps_url ?? '',
    phone: p?.phone ?? '',
    pic_name: p?.pic_name ?? '',
    pic_position: p?.pic_position ?? '',
    pic_phone: p?.pic_phone ?? '',
    pic_email: p?.pic_email ?? '',
    ac_types: p?.ac_types ?? [],
    estimated_units: p?.estimated_units != null ? String(p.estimated_units) : '',
    existing_vendor: p?.existing_vendor ?? 'unknown',
    vendor_price_notes: p?.vendor_price_notes ?? '',
    needs: p?.needs ?? '',
    source: p?.source ?? 'walk_in',
    staff_ids: p?.staff_ids ?? [me],
    status: 'new_lead',
    next_followup_date: '',
    followup_note: '',
  };
}

export default function ProspekForm({
  meta, prospect, onCancel,
}: { meta: B2BMeta; prospect: Prospect | null; onCancel?: () => void }) {
  const router = useRouter();
  const editing = !!prospect;
  const [f, setF] = useState<Form>(() => initial(prospect, meta.me));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const today = jakartaToday();

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggle = (k: 'ac_types' | 'staff_ids', v: string) =>
    setF((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));

  async function save(extra?: { is_archived?: boolean }) {
    setErr(null);
    if (!f.business_name.trim()) return setErr('Nama bisnis wajib diisi.');
    if (!f.category) return setErr('Pilih kategori.');
    if (!f.area.id && !f.area.name.trim())
      return setErr('Pilih area, atau ketik nama baru lalu klik “Tambah area baru”.');

    setSaving(true);
    const payload: Record<string, unknown> = {
      id: prospect?.id ?? null,
      business_name: f.business_name,
      category: f.category,
      area_id: f.area.id,
      area_name: f.area.name,
      address: f.address,
      maps_url: f.maps_url,
      phone: f.phone,
      pic_name: f.pic_name,
      pic_position: f.pic_position,
      pic_phone: f.pic_phone,
      pic_email: f.pic_email,
      ac_types: f.ac_types,
      estimated_units: f.estimated_units,
      existing_vendor: f.existing_vendor,
      vendor_price_notes: f.vendor_price_notes,
      needs: f.needs,
      source: f.source,
      staff_ids: f.staff_ids,
      ...(editing ? {} : {
        status: f.status,
        next_followup_date: f.next_followup_date,
        followup_note: f.followup_note,
      }),
      ...extra,
    };

    const supabase = createClient();
    const { data, error } = await supabase.rpc('b2b_save_prospect', { p: payload });
    setSaving(false);
    if (error) return setErr(error.message);

    if (extra?.is_archived) {
      router.push('/b2b/prospek');
    } else if (editing) {
      onCancel?.();
    } else {
      router.push(`/b2b/prospek/${data as string}`);
    }
    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void save(); }}
      className="flex flex-col gap-4 w-full max-w-3xl"
    >
      <Card title="Identitas" note="Wajib diisi" noteClass="text-amber-700 font-semibold">
        <Field id="f-nama" label="Nama bisnis *">
          <input id="f-nama" className={INPUT} value={f.business_name}
            onChange={(e) => set('business_name', e.target.value)} placeholder="mis. Mattea Melawai" />
        </Field>
        <div className="flex flex-col gap-2">
          <span id="f-kat" className={LABEL}>Kategori *</span>
          <Chips options={CATEGORIES} selected={f.category ? [f.category] : []}
            onToggle={(k) => set('category', k)} labelledBy="f-kat" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="f-area" className={LABEL}>Area *</label>
          <p className="text-xs text-neutral-600">
            Nama kelompok buatan tim sendiri, bukan dari alamat. Pilih yang ada, atau ketik nama baru.
          </p>
          <AreaPicker inputId="f-area" areas={meta.areas} value={f.area} onChange={(v) => set('area', v)} />
        </div>
      </Card>

      <Card title="Lokasi" note="Opsional">
        <Field id="f-alamat" label="Alamat">
          <textarea id="f-alamat" rows={2} className={TEXTAREA} value={f.address}
            onChange={(e) => set('address', e.target.value)} placeholder="Jl. Melawai Raya No. …" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="f-maps" label="Link Google Maps">
            <input id="f-maps" type="url" className={INPUT} value={f.maps_url}
              onChange={(e) => set('maps_url', e.target.value)} placeholder="https://maps.app.goo.gl/…" />
          </Field>
          <Field id="f-telp" label="Telepon umum">
            <input id="f-telp" type="tel" className={INPUT} value={f.phone}
              onChange={(e) => set('phone', e.target.value)} placeholder="021 …" />
          </Field>
        </div>
      </Card>

      <Card title="PIC" note="Opsional · bisa diisi nanti">
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="f-picn" label="Nama PIC">
            <input id="f-picn" className={INPUT} value={f.pic_name}
              onChange={(e) => set('pic_name', e.target.value)} placeholder="mis. Pak Angga" />
          </Field>
          <Field id="f-picj" label="Jabatan">
            <input id="f-picj" className={INPUT} value={f.pic_position}
              onChange={(e) => set('pic_position', e.target.value)} placeholder="mis. Building Manager" />
          </Field>
          <Field id="f-picw" label="WhatsApp / HP">
            <input id="f-picw" type="tel" className={INPUT} value={f.pic_phone}
              onChange={(e) => set('pic_phone', e.target.value)} placeholder="08…" />
          </Field>
          <Field id="f-pice" label="Email">
            <input id="f-pice" type="email" className={INPUT} value={f.pic_email}
              onChange={(e) => set('pic_email', e.target.value)} placeholder="nama@perusahaan.com" />
          </Field>
        </div>
      </Card>

      <Card title="Peluang AC" note="Opsional">
        <div className="flex flex-col gap-2">
          <span id="f-ac" className={LABEL}>Tipe AC (boleh lebih dari satu)</span>
          <Chips options={AC_TYPES} selected={f.ac_types} onToggle={(k) => toggle('ac_types', k)} labelledBy="f-ac" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field id="f-unit" label="Perkiraan jumlah unit">
            <input id="f-unit" type="number" min={0} inputMode="numeric" className={INPUT} value={f.estimated_units}
              onChange={(e) => set('estimated_units', e.target.value)} placeholder="mis. 8" />
          </Field>
          <div className="flex flex-col gap-2">
            <span id="f-vendor" className={LABEL}>Sudah ada vendor AC?</span>
            <Chips options={VENDOR} selected={[f.existing_vendor]}
              onToggle={(k) => set('existing_vendor', k)} labelledBy="f-vendor" />
          </div>
        </div>
        <Field id="f-harga" label="Catatan harga vendor sekarang">
          <input id="f-harga" className={INPUT} value={f.vendor_price_notes}
            onChange={(e) => set('vendor_price_notes', e.target.value)} placeholder="mis. Split ±90rb, Cassette ±220rb" />
        </Field>
        <Field id="f-butuh" label="Kebutuhan / catatan">
          <textarea id="f-butuh" rows={3} className={TEXTAREA} value={f.needs}
            onChange={(e) => set('needs', e.target.value)}
            placeholder="mis. Terbuka untuk vendor cadangan. Kantor pusat di Matraman." />
        </Field>
      </Card>

      <Card title="Penanganan">
        <div className="flex flex-col gap-2">
          <span id="f-staf" className={LABEL}>Staf yang menangani (boleh lebih dari satu)</span>
          <Chips options={meta.staff.map((s) => [s.id, s.name] as [string, string])} selected={f.staff_ids}
            onToggle={(k) => toggle('staff_ids', k)} labelledBy="f-staf" />
        </div>
        <Field id="f-sumber" label="Sumber">
          <select id="f-sumber" className={INPUT + ' md:w-72'} value={f.source}
            onChange={(e) => set('source', e.target.value)}>
            {SOURCES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>

        {!editing ? (
          <>
            <Field id="f-status" label="Status awal">
              <select id="f-status" className={INPUT + ' md:w-72'} value={f.status}
                onChange={(e) => set('status', e.target.value)}>
                {STATUSES.filter(([k]) => k !== 'won' && k !== 'lost').map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </Field>
            <div className="flex flex-col gap-2">
              <label htmlFor="f-fu" className={LABEL}>Follow-up pertama</label>
              <div className="flex flex-wrap items-center gap-2">
                {[['Besok', 1], ['3 hari', 3], ['1 minggu', 7]].map(([l, n]) => {
                  const d = addDays(today, n as number);
                  return (
                    <button key={l} type="button" onClick={() => set('next_followup_date', d)}
                      aria-pressed={f.next_followup_date === d}
                      className={'min-h-10 px-3.5 rounded-full text-[13px] font-semibold border ' +
                        (f.next_followup_date === d
                          ? 'bg-aeac-amber-100 text-amber-900 border-2 border-aeac-amber-600'
                          : 'bg-white border-neutral-300')}>
                      {l}
                    </button>
                  );
                })}
                <input id="f-fu" type="date" className={INPUT + ' w-auto'} value={f.next_followup_date}
                  min={today} onChange={(e) => set('next_followup_date', e.target.value)} />
              </div>
            </div>
            <Field id="f-fun" label="Rencana follow-up">
              <input id="f-fun" className={INPUT} value={f.followup_note}
                onChange={(e) => set('followup_note', e.target.value)} placeholder="mis. Kirim company profile via WhatsApp" />
            </Field>
          </>
        ) : null}
      </Card>

      {err ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pb-8">
        {editing ? (
          <button type="button" disabled={saving}
            onClick={() => { if (confirm('Arsipkan prospek ini? Prospek tidak akan muncul di daftar.')) void save({ is_archived: true }); }}
            className="h-11 px-4 rounded-lg text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
            Arsipkan
          </button>
        ) : null}
        <div className="ml-auto flex gap-3">
          {onCancel ? (
            <button type="button" onClick={onCancel}
              className="h-11 px-5 rounded-lg border border-neutral-300 bg-white text-sm font-semibold text-neutral-800">
              Batal
            </button>
          ) : (
            <button type="button" onClick={() => router.push('/b2b/prospek')}
              className="h-11 px-5 rounded-lg border border-neutral-300 bg-white text-sm font-semibold text-neutral-800">
              Batal
            </button>
          )}
          <button type="submit" disabled={saving}
            className="h-11 px-6 rounded-lg bg-aeac-amber-500 hover:bg-aeac-amber-600 text-black text-sm font-bold disabled:opacity-50">
            {saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : 'Simpan Prospek'}
          </button>
        </div>
      </div>
    </form>
  );
}

function Card({
  title, note, noteClass, children,
}: { title: string; note?: string; noteClass?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5 md:p-6 flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[17px] font-bold">{title}</h2>
        {note ? <span className={'text-xs ' + (noteClass ?? 'text-neutral-600')}>{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>{label}</label>
      {children}
    </div>
  );
}
