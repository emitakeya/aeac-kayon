// app/b2b/penawaran/baru/page.tsx — new proposal for ?prospek=<id>.
// Without a prospect: pick one first.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { jakartaToday, type B2BMeta, type ProspectDetail, type ProspectRow } from '@/lib/b2b';
import { newDraft, type TemplateKey } from '@/lib/b2b-penawaran';
import PenawaranEditor from '../_components/penawaran-editor';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f-]{36}$/i;
const TEMPLATES: TemplateKey[] = ['perkenalan', 'uji_coba', 'harga'];

export default async function PenawaranBaruPage({
  searchParams,
}: { searchParams: Promise<{ prospek?: string; template?: string }> }) {
  const { prospek, template } = await searchParams;
  const supabase = await createClient();

  if (!prospek || !UUID.test(prospek)) {
    const { data } = await supabase.rpc('b2b_list_prospects');
    const rows = ((data ?? []) as ProspectRow[]).filter((r) => r.status !== 'lost');
    return (
      <main className="px-4 py-6 md:px-10 md:py-8 flex flex-col gap-4 max-w-[900px]">
        <Link href="/b2b/penawaran" className="text-sm font-semibold text-aeac-amber-700 hover:underline">← Penawaran</Link>
        <h1 className="text-2xl md:text-[28px] font-bold tracking-tight">Buat Penawaran — pilih prospek</h1>
        <ul className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/b2b/penawaran/baru?prospek=${r.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50">
                <span className="font-semibold">{r.business_name}</span>
                <span className="text-xs text-neutral-600">{r.area_name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const [detail, meta] = await Promise.all([
    supabase.rpc('b2b_get_prospect', { p_id: prospek }),
    supabase.rpc('b2b_get_meta'),
  ]);
  if (detail.error || meta.error) {
    return (
      <main className="p-8">
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Gagal memuat prospek: {(detail.error ?? meta.error)?.message}
        </p>
      </main>
    );
  }
  if (!detail.data) notFound();

  const d = detail.data as ProspectDetail;
  const m = meta.data as B2BMeta;
  const p = d.prospect;

  // Default template: had a paid/test job → "Setelah Uji Coba"; otherwise "Perkenalan".
  const chosen: TemplateKey = TEMPLATES.includes(template as TemplateKey)
    ? (template as TemplateKey)
    : d.activities.some((a) => a.activity_type === 'order') ? 'uji_coba' : 'perkenalan';
  const me = m.staff.find((s) => s.id === m.me)?.name ?? '';

  return (
    <PenawaranEditor
      initial={newDraft({ prospect: p, template: chosen, senderName: me, today: jakartaToday() })}
      prospect={{ id: p.id, business_name: p.business_name, address: p.address, pic_phone: p.pic_phone, status: p.status }}
      meta={m}
      saved={null}
    />
  );
}
