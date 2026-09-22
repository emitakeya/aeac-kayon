// app/b2b/prospek/baru/page.tsx — Tambah Prospek.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import type { B2BMeta } from '@/lib/b2b';
import ProspekForm from '../../_components/prospek-form';

export const dynamic = 'force-dynamic';

export default async function TambahProspekPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('b2b_get_meta');

  return (
    <main className="px-4 py-6 md:px-10 md:py-8 flex flex-col gap-5">
      <Link href="/b2b/prospek" className="text-sm font-semibold text-aeac-amber-700 hover:underline">
        ← Kembali ke Prospek
      </Link>
      <h1 className="text-2xl md:text-[28px] font-bold tracking-tight">Tambah Prospek</h1>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Gagal memuat data: {error.message}
        </p>
      ) : (
        <ProspekForm meta={data as B2BMeta} prospect={null} />
      )}
    </main>
  );
}
