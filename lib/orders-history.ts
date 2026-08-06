// lib/orders-history.ts
// Types + formatting helpers for /lihat-semua-pesanan.

export type HistorySummaryRow = {
  ym: string; // 'YYYYMM'
  yr: number;
  mon: number;
  n_orders: number;
  n_cancelled: number;
  paid_total: number;
};

export type HistoryOrder = {
  order_id: string;
  scheduled_date: string | null;
  status: string;
  services: string[] | null;
  notes: string | null;
  name_roma: string | null;
  name_kanji: string | null;
  apartment: string | null;
  unit: string | null;
  mobile: string | null;
  email: string | null;
  ordered_by_email: string | null;
  ordered_by_name: string | null;
  ordered_by_team: string | null;
  technicians: string[] | null;
  invoice_number: string | null;
  invoice_total: number | null;
  invoice_status: string | null;
  paid_date: string | null;
  payment_method: string | null;
  xendit_payment_url: string | null;
};

export const MONTH_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const;

export function monthLabel(mon: number): string {
  return MONTH_ID[mon - 1] ?? String(mon);
}

export function rupiah(n: number | null | undefined): string {
  if (n == null) return '—';
  return 'Rp ' + n.toLocaleString('id-ID');
}

/** Jakarta "today" as a year number — the page runs on Vercel (UTC). */
export function jakartaYear(): number {
  return Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
    }).format(new Date()),
  );
}

// ── Status presentation ──────────────────────────────────────────────────────

export type BadgeStyle = { label: string; cls: string };

/** orders.status — live values are pending / completed / cancelled.
 *  `confirmed` is still a valid state the cancel flow recognises. */
export function orderBadge(status: string): BadgeStyle {
  switch (status) {
    case 'pending':
      return { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'confirmed':
      return { label: 'Confirmed', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'completed':
      return { label: 'Selesai', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'cancelled':
      return { label: 'Dibatalkan', cls: 'bg-red-50 text-red-700 border-red-200' };
    default:
      return { label: status, cls: 'bg-neutral-100 text-neutral-600 border-neutral-200' };
  }
}

/** invoices.status — live values are paid / pending_payment / payment_expired.
 *  A null invoice_number means no invoice row exists yet. */
export function paymentBadge(o: HistoryOrder): BadgeStyle {
  if (!o.invoice_number) {
    return { label: 'Belum Invoice', cls: 'bg-neutral-100 text-neutral-600 border-neutral-200' };
  }
  switch (o.invoice_status) {
    case 'paid':
      return { label: 'Lunas', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'pending_payment':
      return { label: 'Menunggu Bayar', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'payment_expired':
      return { label: 'Kedaluwarsa', cls: 'bg-red-50 text-red-700 border-red-200' };
    default:
      return {
        label: o.invoice_status ?? 'Tidak diketahui',
        cls: 'bg-neutral-100 text-neutral-600 border-neutral-200',
      };
  }
}

// ── Filtering ────────────────────────────────────────────────────────────────

export type StatusFilter = 'semua' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'belum_lunas';

export const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'semua', label: 'Semua' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'completed', label: 'Selesai' },
  { key: 'cancelled', label: 'Dibatalkan' },
  { key: 'belum_lunas', label: 'Belum Lunas' },
];

export function matchesStatus(o: HistoryOrder, f: StatusFilter): boolean {
  if (f === 'semua') return true;
  if (f === 'belum_lunas') {
    // Outstanding money only — a cancelled order owes nothing.
    return o.status !== 'cancelled' && o.invoice_status !== 'paid';
  }
  return o.status === f;
}

export function matchesSearch(o: HistoryOrder, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [
    o.order_id,
    o.name_roma,
    o.name_kanji,
    o.apartment,
    o.unit,
    o.invoice_number,
    o.ordered_by_name,
    o.ordered_by_team,
    ...(o.technicians ?? []),
  ]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(needle));
}
