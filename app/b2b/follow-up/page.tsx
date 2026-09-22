// app/b2b/follow-up/page.tsx — daily Follow-up list (Terlambat / Hari ini / 7 hari ke depan).
// Reuses b2b_list_prospects(); grouping happens client-side in Jakarta time.
import { createClient } from '@/lib/supabase/server';
import type { B2BMeta, ProspectRow } from '@/lib/b2b';
import FollowUpList from './follow-up-list';

export const dynamic = 'force-dynamic';

export default async function FollowUpPage() {
  const supabase = await createClient();
  const [list, meta] = await Promise.all([
    supabase.rpc('b2b_list_prospects'),
    supabase.rpc('b2b_get_meta'),
  ]);

  if (list.error || meta.error) {
    return (
      <main className="p-8">
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Gagal memuat follow-up: {(list.error ?? meta.error)?.message}
        </p>
      </main>
    );
  }

  return <FollowUpList rows={(list.data ?? []) as ProspectRow[]} meta={meta.data as B2BMeta} />;
}
