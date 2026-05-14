// lib/bookings.ts
// Types + helpers for /booking-list-confirmed.
// Parses order_id and scheduled_date the same way the WP shortcode does.
//
// History:
//   • Originally added for /booking-list-confirmed (MM staff, no cancelled)
//   • Extended May 12, 2026 for /booking-list-mobile (techs see all statuses
//     including cancelled). Both pages share the same types and helpers.
//   • /booking-list-mobile merged into /booking-list-confirmed (May 12, 2026).
//   • May 14, 2026: added `is_paid` field (from invoices.status='paid') and
//     filterBookings() helper for client-side search + status filter UI.

export type BookingStatus = "pending" | "confirmed" | "completed" | "cancelled";

export type BookingRow = {
  order_id: string;
  scheduled_date: string | null; // text like "2026-04-29 (Rabu) AM"
  status: BookingStatus | string;
  services: string[] | null;
  notes: string | null;
  wait_name: string | null;
  wait_phone: string | null;
  name_roma: string | null;
  name_kanji: string | null;
  ordered_by_email: string | null;
  mobile: string | null;
  email: string | null;
  apartment: string | null;
  unit: string | null;
  is_paid: boolean; // NEW (May 14, 2026): true when public.invoices.status='paid'
};

export type DayGroup = {
  dateKey: string; // "YYYY-MM-DD"
  bookings: BookingRow[];
};

// ──────────────────────────────────────────
// order_id → "YYYY-MM-DD"
// Matches the WP regex: /^aeac-(\d{4})(\d{2})(\d{2})-/
// ──────────────────────────────────────────
export function orderIdToDate(orderId: string): string | null {
  const m = orderId?.match(/^aeac-(\d{4})(\d{2})(\d{2})-/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

// ──────────────────────────────────────────
// scheduled_date "2026-04-29 (Rabu) AM" → "AM" | "PM" | null
// ──────────────────────────────────────────
export function extractSession(scheduled: string | null): "AM" | "PM" | null {
  if (!scheduled) return null;
  const m = scheduled.match(/\b(AM|PM)\b/i);
  if (!m) return null;
  return m[1].toUpperCase() as "AM" | "PM";
}

// ──────────────────────────────────────────
// Today in WIB (Jakarta) — server time can be UTC.
// Booking dates are local Jakarta dates; using UTC-based "today" can
// flip to the next day at 17:00 WIB. Force WIB.
// ──────────────────────────────────────────
export function todayInJakarta(): string {
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ──────────────────────────────────────────
// Group bookings by service date (parsed from order_id).
// Already sorted ASC by order_id from the RPC, so per-date order is preserved.
// ──────────────────────────────────────────
export function groupByDate(bookings: BookingRow[]): DayGroup[] {
  const map = new Map<string, BookingRow[]>();
  for (const b of bookings) {
    const key = orderIdToDate(b.order_id) ?? "unknown";
    const arr = map.get(key);
    if (arr) arr.push(b);
    else map.set(key, [b]);
  }
  // sort dateKeys asc; "unknown" goes last
  const keys = Array.from(map.keys()).sort((a, b) => {
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return keys.map((dateKey) => ({ dateKey, bookings: map.get(dateKey)! }));
}

// ──────────────────────────────────────────
// Status counts for the summary pills.
// ──────────────────────────────────────────
export type StatusCounts = {
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
};

export function statusCounts(bookings: BookingRow[]): StatusCounts {
  const c: StatusCounts = {
    total: bookings.length,
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const b of bookings) {
    if (b.status === "pending") c.pending++;
    else if (b.status === "confirmed") c.confirmed++;
    else if (b.status === "completed") c.completed++;
    else if (b.status === "cancelled") c.cancelled++;
  }
  return c;
}

// ──────────────────────────────────────────
// Client-side filter for booking list.
// Combines a free-text search (matches name_roma, name_kanji, apartment, unit,
// and order_id) with a status whitelist. Empty searchTerm = no text filter;
// statusFilter must contain at least one status (UI enforces this with a
// "clear filters" hint if zero are checked).
// ──────────────────────────────────────────
export function filterBookings(
  bookings: BookingRow[],
  searchTerm: string,
  statusFilter: Set<BookingStatus>
): BookingRow[] {
  const q = searchTerm.trim().toLowerCase();
  const hasSearch = q.length > 0;

  return bookings.filter((b) => {
    // Status filter
    if (!statusFilter.has(b.status as BookingStatus)) return false;

    // Search filter — match any of the customer-identifying fields
    if (hasSearch) {
      const haystack = [
        b.name_roma,
        b.name_kanji,
        b.apartment,
        b.unit,
        b.order_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

// ──────────────────────────────────────────
// Indonesian status labels for badges and filter checkboxes.
// Mirrors the wording used elsewhere in Kayon staff UI.
// ──────────────────────────────────────────
export const STATUS_LABEL_ID: Record<BookingStatus, string> = {
  pending:   "Pending",
  confirmed: "Konfirmasi",
  completed: "Selesai",
  cancelled: "Batal",
};

// ──────────────────────────────────────────
// "Hari ini" / "Besok" / "Lusa" / "N hari lalu" / weekday name in Indonesian.
// dateKey is "YYYY-MM-DD".
// ──────────────────────────────────────────
const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

function parseYmdToUTCDate(ymd: string): Date | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  // Use UTC midnight to avoid TZ drift; we only need day arithmetic + weekday.
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function dayLabel(dateKey: string, today: string): string {
  if (dateKey === "unknown") return "Tanggal tidak diketahui";
  const d = parseYmdToUTCDate(dateKey);
  const t = parseYmdToUTCDate(today);
  if (!d || !t) return dateKey;
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return "Hari ini";
  if (diff === 1) return "Besok";
  if (diff === 2) return "Lusa";
  if (diff === -1) return "Kemarin";
  if (diff < 0) return `${Math.abs(diff)} hari lalu`;
  // Future > 2 days: weekday name
  return HARI_ID[d.getUTCDay()];
}

export function dateSubLabel(dateKey: string): string {
  if (dateKey === "unknown") return "—";
  const d = parseYmdToUTCDate(dateKey);
  if (!d) return dateKey;
  const dd = d.getUTCDate();
  const mm = BULAN_ID[d.getUTCMonth()];
  const yyyy = d.getUTCFullYear();
  const hari = HARI_ID[d.getUTCDay()];
  return `${dd} ${mm} ${yyyy}, ${hari}`;
}

export function isPastDate(dateKey: string, today: string): boolean {
  if (dateKey === "unknown") return false;
  return dateKey < today;
}

// ──────────────────────────────────────────
// WhatsApp link helper: strip non-digits, prefix with wa.me
// ──────────────────────────────────────────
export function waLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

// ──────────────────────────────────────────
// Phone-call link helper: tel: URI, strip non-digits.
// Some Indonesian numbers come in with leading "0" (local) or "+62" (intl).
// We keep the digits as-is (no normalization) so the dialer shows what's stored.
// ──────────────────────────────────────────
export function telLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `tel:${digits}`;
}
