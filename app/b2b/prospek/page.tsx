// app/b2b/prospek/page.tsx — Prospek list (server fetch, client filtering).
import { createClient } from '@/lib/supabase/server';
import type { B2BMeta, ProspectRow } from '@/lib/b2b';
import ProspekList from './prospek-list';

export const dynamic = 'force-dynamic';

const FU_KEYS = ['over', 'today', 'soon', 'none'];

export default async function ProspekPage({
  searchParams,
}: { searchParams: Promise<{ fu?: string }> }) {
  const sp = await searchParams;
  const initialFu = FU_KEYS.includes(sp.fu ?? '') ? (sp.fu as string) : '';
  const supabase = await createClient();
  const [list, meta] = await Promise.all([
    supabase.rpc('b2b_list_prospects'),
    supabase.rpc('b2b_get_meta'),
  ]);

  if (list.error || meta.error) {
    return (
      <main className="p-8">
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Gagal memuat prospek: {(list.error ?? meta.error)?.message}
        </p>
      </main>
    );
  }

  return (
    <ProspekList
      key={initialFu}
      rows={(list.data ?? []) as ProspectRow[]}
      meta={meta.data as B2BMeta}
      initialFu={initialFu}
    />
  );
}
