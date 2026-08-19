// lib/riwayat.ts
// Types + helpers for /riwayat-customer (customer service history + PDF).
//
// Mirrors the RPC return shapes:
//   - search_customers_for_history(p_query)
//   - get_customer_history(p_customer_ids, p_from, p_unpaid_only)
// See migrations/aeac_kayon_riwayat_customer_rpcs.sql

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────

export type CustomerSearchRow = {
  id: string;
  name_roma: string | null;
  name_kanji: string | null;
  apartment: string | null;
  unit: string | null;
  email: string | null;
  order_count: number;
  unpaid_count: number;
  last_service_date: string | null; // YYYY-MM-DD
};

export type HistoryCustomer = {
  id: string;
  name_roma: string | null;
  name_kanji: string | null;
  apartment: string | null;
  unit: string | null;
  email: string | null;
  mobile: string | null;
};

export type HistoryReport = {
  technicians: string[] | null;
  jam_mulai: string | null;
  jam_selesai: string | null;
  pengerjaan: string[] | null;
  unit_split_standar_small: number | null;
  unit_split_standar_large: number | null;
  unit_split_semibongkar_small: number | null;
  unit_split_semibongkar_large: number | null;
  unit_cassette: number | null;
  unit_ducting: number | null;
  unit_perbaikan: number | null;
  perbaikan_dilakukan: string[] | null;
  kondisi_sebelum: string[] | null;
  tindakan_dilakukan: string[] | null;
  opsi_rekomendasi: string[] | null;
  photo_sebelum: string[] | null;
  photo_sesudah: string[] | null;
};

export type HistoryInvoiceLineItem = {
  name?: string;
  qty?: number;
  price?: number;
  // WP-era line items sometimes use different keys; keep it loose.
  [key: string]: unknown;
};

export type HistoryInvoice = {
  invoice_number: string | null;
  line_items: HistoryInvoiceLineItem[] | null;
  subtotal: number | null;
  discount: number | null;
  total_amount: number | null;
  status: string | null; // 'paid' | 'payment_expired' | ...
  paid_date: string | null;
  payment_method: string | null;
  xendit_payment_url: string | null;
};

export type HistoryVisit = {
  order_id: string;
  service_date: string | null; // YYYY-MM-DD
  session: string | null; // 'pagi' | 'siang'
  status: string;
  services: string[] | null;
  has_report: boolean;
  has_invoice: boolean;
  is_unpaid: boolean;
  report: HistoryReport | null;
  invoice: HistoryInvoice | null;
  total_amount: number;
};

export type HistorySummary = {
  visit_count: number;
  total_periode: number;
  total_belum_dibayar: number;
  unpaid_count: number;
  from_date: string | null;
  generated_at: string; // 'YYYY-MM-DD HH:MM' Asia/Jakarta
};

export type CustomerHistory = {
  customers: HistoryCustomer[];
  visits: HistoryVisit[];
  summary: HistorySummary;
};

// ──────────────────────────────────────────
// Formatting helpers (Indonesian)
// ──────────────────────────────────────────

const BULAN_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const BULAN_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/** "2026-08-12" → "12 Agu 2026". Returns "—" for null/bad input. */
export function fmtDateID(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${Number(m[3])} ${BULAN_SHORT[Number(m[2]) - 1]} ${m[1]}`;
}

/** "2026-08-12" → "12 AGUSTUS 2026" (PDF visit header). */
export function fmtDateIDLong(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${Number(m[3])} ${BULAN_LONG[Number(m[2]) - 1].toUpperCase()} ${m[1]}`;
}

/** 4585000 → "Rp 4.585.000" */
export function fmtRupiah(n: number | null | undefined): string {
  if (n == null) return '—';
  return 'Rp ' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const EN_MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * invoices.paid_date is legacy free text — usually "30 March 2026" (English)
 * but occasionally ISO. Normalise both to Indonesian "30 Mar 2026"; return the
 * raw string if unparseable.
 */
export function fmtPaidDate(raw: string | null | undefined): string {
  if (!raw) return '';
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return fmtDateID(raw);
  const en = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (en) {
    const m = EN_MONTHS[en[2].toLowerCase()];
    if (m) return `${Number(en[1])} ${BULAN_SHORT[m - 1]} ${en[3]}`;
  }
  return raw;
}

/**
 * orders.services entries embed booking-time prices ("AC Split Basic ×10 —
 * Rp 1.200.000"). Strip the price for the customer PDF so the invoice stays
 * the only money source. Keeps the "×N" quantity.
 */
export function cleanServiceLabel(s: string): string {
  return s.replace(/\s+—\s+Rp[\s\d.,]+$/u, '').trim();
}

/** 'pagi' → 'Pagi', 'siang' → 'Siang' */
export function fmtSession(s: string | null | undefined): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** invoice.status → customer-facing Indonesian label. */
export function invoiceStatusLabel(status: string | null | undefined): {
  label: string;
  paid: boolean;
} {
  if (status === 'paid') return { label: 'LUNAS', paid: true };
  // payment_expired, pending, sent, anything else non-paid → unpaid.
  return { label: 'BELUM BAYAR', paid: false };
}

/** Unit-count columns → readable lines for the PDF report section. */
export function unitLines(r: HistoryReport): string[] {
  const map: Array<[keyof HistoryReport, string]> = [
    ['unit_split_standar_small', 'AC Split Cuci Standar (kecil)'],
    ['unit_split_standar_large', 'AC Split Cuci Standar (besar)'],
    ['unit_split_semibongkar_small', 'AC Split Semi Bongkar (kecil)'],
    ['unit_split_semibongkar_large', 'AC Split Semi Bongkar (besar)'],
    ['unit_cassette', 'AC Cassette'],
    ['unit_ducting', 'AC Ducting'],
    ['unit_perbaikan', 'Perbaikan'],
  ];
  const out: string[] = [];
  for (const [key, label] of map) {
    const v = r[key];
    if (typeof v === 'number' && v > 0) out.push(`${label} — ${v} unit`);
  }
  return out;
}

/** Normalise an invoice line item (WP-era key variants) into name/qty/price. */
export function normaliseLineItem(li: HistoryInvoiceLineItem): {
  name: string;
  qty: number;
  price: number;
  amount: number;
} {
  const name =
    (typeof li.name === 'string' && li.name) ||
    (typeof li.item === 'string' && (li.item as string)) ||
    (typeof li.description === 'string' && (li.description as string)) ||
    '—';
  const qty = Number(li.qty ?? li.quantity ?? 1) || 1;
  const price = Number(li.price ?? li.unit_price ?? li.amount ?? 0) || 0;
  return { name, qty, price, amount: qty * price };
}

/** Compute the p_from date for a period in months. null = all time. */
export function periodFromDate(months: number | null): string | null {
  if (months == null) return null;
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Display name for a set of selected customers (PDF header + page title). */
export function displayName(customers: HistoryCustomer[]): string {
  for (const c of customers) {
    if (c.name_roma && c.name_roma.trim()) return c.name_roma.trim();
  }
  for (const c of customers) {
    if (c.name_kanji && c.name_kanji.trim()) return c.name_kanji.trim();
  }
  return 'Customer';
}

/** Distinct non-empty values across selected customers, joined. */
export function distinctJoin(
  customers: HistoryCustomer[],
  key: 'apartment' | 'unit' | 'email' | 'mobile',
  sep = ' · ',
): string {
  const seen = new Set<string>();
  for (const c of customers) {
    const v = c[key];
    if (v && v.trim()) seen.add(v.trim());
  }
  return Array.from(seen).join(sep);
}
