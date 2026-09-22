// app/b2b/prospek/[id]/page.tsx — prospect detail + activity timeline.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { B2BMeta, ProspectDetail } from '@/lib/b2b';
import ProspekDetailView from './prospek-detail';

export const dynamic = 'force-dynamic';

export default async function ProspekDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [detail, meta] = await Promise.all([
    supabase.rpc('b2b_get_prospect', { p_id: id }),
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
  if (d.prospect.is_archived) {
    return (
      <main className="p-8 flex flex-col gap-3">
        <p className="text-sm text-neutral-700">Prospek ini sudah diarsipkan.</p>
        <Link href="/b2b/prospek" className="text-sm font-semibold text-aeac-amber-700 hover:underline">
          ← Kembali ke Prospek
        </Link>
      </main>
    );
  }

  return <ProspekDetailView detail={d} meta={meta.data as B2BMeta} />;
}
