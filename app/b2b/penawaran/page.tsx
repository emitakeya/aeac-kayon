// app/b2b/penawaran/page.tsx — every proposal, newest first.
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fmtDate } from '@/lib/b2b';
import { TEMPLATE_LABEL, rupiah, type ProposalRow } from '@/lib/b2b-penawaran';
import ProposalStatus from './_components/proposal-status';

export const dynamic = 'force-dynamic';

export default async function PenawaranListPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('b2b_list_proposals', { p_prospect_id: null });

  if (error) {
    return (
      <main className="p-8">
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Gagal memuat penawaran: {error.message}
        </p>
      </main>
    );
  }
  const rows = (data ?? []) as ProposalRow[];

  return (
    <main className="px-4 py-6 md:px-10 md:py-8 flex flex-col gap-5 max-w-[1200px]">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-[28px] font-bold tracking-tight">Penawaran</h1>
          <p className="text-sm text-neutral-600">Semua penawaran yang dibuat. Penawaran baru dibuat dari halaman prospek.</p>
        </div>
        <Link href="/b2b/penawaran/baru"
          className="inline-flex items-center h-11 px-5 rounded-lg bg-aeac-amber-500 hover:bg-aeac-amber-600 text-black text-sm font-bold">
          + Buat Penawaran
        </Link>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
          Belum ada penawaran. Buka prospek, lalu klik “Buat Penawaran”.
        </p>
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-[13px] text-neutral-600">
                <th className="px-4 py-3 font-semibold">Klien</th>
                <th className="px-4 py-3 font-semibold">Template</th>
                <th className="px-4 py-3 font-semibold">Tanggal</th>
                <th className="px-4 py-3 font-semibold text-right">Total / kunjungan</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Diubah</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/b2b/penawaran/${r.id}`} className="font-semibold text-neutral-900 hover:underline">
                      {r.business_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-700">{TEMPLATE_LABEL[r.template] ?? r.template}</td>
                  <td className="px-4 py-3 text-neutral-700">{fmtDate(r.proposal_date)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.total ? rupiah(r.total) : '—'}</td>
                  <td className="px-4 py-3"><ProposalStatus status={r.status} sentAt={r.sent_at} /></td>
                  <td className="px-4 py-3 text-xs text-neutral-600">
                    {fmtDate(r.updated_at)}{r.updated_by_name ? ` · ${r.updated_by_name}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
