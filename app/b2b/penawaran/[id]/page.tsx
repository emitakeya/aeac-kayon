// app/b2b/penawaran/[id]/page.tsx — edit an existing proposal.
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { B2BMeta } from '@/lib/b2b';
import type { ProposalProspect, ProposalRecord } from '@/lib/b2b-penawaran';
import PenawaranEditor from '../_components/penawaran-editor';

export const dynamic = 'force-dynamic';

export default async function PenawaranEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [res, meta] = await Promise.all([
    supabase.rpc('b2b_get_proposal', { p_id: id }),
    supabase.rpc('b2b_get_meta'),
  ]);
  if (res.error || meta.error) {
    return (
      <main className="p-8">
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Gagal memuat penawaran: {(res.error ?? meta.error)?.message}
        </p>
      </main>
    );
  }
  if (!res.data) notFound();

  const { proposal: r, prospect: p } = res.data as { proposal: ProposalRecord; prospect: ProposalProspect };

  return (
    <PenawaranEditor
      initial={{
        id: r.id,
        prospect_id: r.prospect_id,
        template: r.template,
        title: r.title,
        recipient: r.recipient ?? '',
        proposal_date: r.proposal_date,
        valid_until: r.valid_until ?? '',
        sender_name: r.sender_name ?? '',
        sender_phone: r.sender_phone ?? '',
        blocks: r.blocks ?? [],
        items: r.items ?? [],
      }}
      prospect={{ id: p.id, business_name: p.business_name, address: p.address, pic_phone: p.pic_phone, status: p.status }}
      meta={meta.data as B2BMeta}
      saved={{ status: r.status, sent_at: r.sent_at, updated_at: r.updated_at, updated_by_name: r.updated_by_name }}
    />
  );
}
