// app/b2b/penawaran/_components/proposal-status.tsx — Draf / Terkirim chip.
import { fmtDate, isoToJakartaYmd } from '@/lib/b2b';

export default function ProposalStatus({ status, sentAt }: { status: string; sentAt: string | null }) {
  return status === 'sent' ? (
    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 whitespace-nowrap">
      Terkirim{sentAt ? ` ${fmtDate(isoToJakartaYmd(sentAt))}` : ''}
    </span>
  ) : (
    <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">Draf</span>
  );
}
