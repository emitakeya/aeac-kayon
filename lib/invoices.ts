// lib/invoices.ts
// Types + helpers for /invoice-admin.
// Mirrors the data shape returned by public.get_invoice_admin_data().

// ──────────────────────────────────────────
// Types — mirror the RPC return shape exactly.
// ──────────────────────────────────────────

export type CustomerLite = {
  name_roma: string | null;
  name_kanji: string | null;
  apartment: string | null;
  unit: string | null;
  mobile: string | null;
  email: string | null;
  ordered_by_email: string | null;
};

export type CompletedOrder = {
  order_id: string;
  scheduled_date: string | null;
  services: string[] | null;
  status: string;
  customer: CustomerLite;
};

export type LineItem = {
  name: string;
  qty: number;
  price: number;
  amount: number;
};

export type InvoiceRow = {
  id: number;
  created_at: string;
  invoice_number: string;
  order_id: string;
  customer_name: string | null;
  customer_email: string | null;
  ordered_by_name: string | null;
  apartment: string | null;
  unit: string | null;
  scheduled_date: string | null;
  technicians: string[] | null;
  line_items: LineItem[];
  subtotal: number;
  discount: number;
  total_amount: number;
  payment_method: string;
  status: string; // 'pending_payment' | 'paid' | etc.
  paid_date: string | null;
  xendit_invoice_id: string | null;
  xendit_payment_url: string | null;
  xendit_status: string | null;
};

export type ServiceRow = {
  id: number;
  name_id: string;
  price: number;
  category: string | null;
};

export type TechnicianRow = {
  name: string;
  email: string | null;
};

export type InvoiceAdminData = {
  completed_orders: CompletedOrder[];
  invoices: InvoiceRow[];
  services: ServiceRow[];
  technicians: TechnicianRow[];
};

// Loaded lazily when finance picks an order from the pending list.
export type OrderForInvoicing = {
  order: {
    order_id: string;
    scheduled_date: string | null;
    services: string[] | null;
    status: string;
    notes: string | null;
    customer: CustomerLite;
  };
  report:
    | ({
        id: number;
        order_id: string;
        technicians: string[] | null;
        services: number[] | string[] | null;
        // (other fields exist; we only need a few for invoicing)
      } & Record<string, unknown>)
    | null;
};

// ──────────────────────────────────────────
// Format helpers
// ──────────────────────────────────────────

// Indonesian Rupiah formatter — matches WP fmtRp.
// 150000 → "Rp 150.000"
export function fmtRp(n: number | null | undefined): string {
  const v = Number(n) || 0;
  return "Rp " + v.toLocaleString("id-ID");
}

// Title-case for customer names that come in as "yamada taro" → "Yamada Taro".
// Matches WP toProper().
export function toProper(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Build invoice number from order_id, mirroring WP buildInvoiceNumber():
// "aeac-20260502-001-mahardika" → "INV-20260502-001-MAHARDIKA"
export function buildInvoiceNumber(orderId: string): string {
  return "INV-" + orderId.replace(/^aeac-/i, "").toUpperCase();
}

// Today as ISO date in Asia/Jakarta (YYYY-MM-DD). Same helper as bookings.ts;
// duplicated here so this module is standalone.
export function todayInJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ──────────────────────────────────────────
// Comma-separated email list — customer + ordered_by, deduped.
// Matches the WP composeCustomerEmails() pattern.
// ──────────────────────────────────────────
export function combineCustomerEmails(c: CustomerLite): string {
  const list: string[] = [];
  if (c.email) list.push(c.email.trim());
  if (c.ordered_by_email && c.ordered_by_email.trim().toLowerCase() !== (c.email || "").trim().toLowerCase()) {
    list.push(c.ordered_by_email.trim());
  }
  return list.filter(Boolean).join(", ");
}

// ──────────────────────────────────────────
// Filter completed orders that don't yet have an invoice.
// "Pending" tab on the WP page.
// ──────────────────────────────────────────
export function filterPendingInvoice(
  orders: CompletedOrder[],
  invoices: InvoiceRow[],
): CompletedOrder[] {
  const invoicedOrderIds = new Set(invoices.map((i) => i.order_id));
  return orders.filter((o) => !invoicedOrderIds.has(o.order_id));
}

// ──────────────────────────────────────────
// Totals — derived rather than stored, so the editor can recompute live.
// ──────────────────────────────────────────
export function calcSubtotal(items: LineItem[]): number {
  return items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
}

export function calcTotal(items: LineItem[], discount: number): number {
  return Math.max(0, calcSubtotal(items) - (Number(discount) || 0));
}

// ──────────────────────────────────────────
// Month grouping (Indonesian).
// monthKey is "YYYY-MM" (sortable, lexicographically descending = newest first).
// ──────────────────────────────────────────

const BULAN_ID_FULL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Returns "YYYY-MM" from any ISO-ish timestamp / date string.
// Uses Asia/Jakarta so a 23:30 UTC paid_date doesn't roll into the next month.
export function monthKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const ymd = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return ymd.slice(0, 7); // "YYYY-MM"
}

// "YYYY-MM" → "Mei 2026"
export function monthLabel(monthKey: string): string {
  const m = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!m) return monthKey;
  const monthIdx = Number(m[2]) - 1;
  return `${BULAN_ID_FULL[monthIdx] ?? m[2]} ${m[1]}`;
}

// Current month in Asia/Jakarta as "YYYY-MM".
export function currentMonthKey(): string {
  return todayInJakarta().slice(0, 7);
}

// ──────────────────────────────────────────
// Group invoices by created_at month, newest month first.
// Includes a paid/unpaid count for header pills.
// ──────────────────────────────────────────
export type InvoiceMonthGroup = {
  monthKey: string; // "YYYY-MM"
  invoices: InvoiceRow[];
  paidCount: number;
  unpaidCount: number;
};

export function groupInvoicesByMonth(invoices: InvoiceRow[]): InvoiceMonthGroup[] {
  const map = new Map<string, InvoiceRow[]>();
  for (const inv of invoices) {
    const key = monthKeyFromIso(inv.created_at) ?? "unknown";
    const arr = map.get(key);
    if (arr) arr.push(inv);
    else map.set(key, [inv]);
  }
  // sort keys: known months desc by string ("2026-05" > "2026-04"), unknown last
  const keys = Array.from(map.keys()).sort((a, b) => {
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return a < b ? 1 : a > b ? -1 : 0; // desc
  });
  return keys.map((monthKey) => {
    const list = map.get(monthKey)!;
    let paid = 0;
    let unpaid = 0;
    for (const i of list) {
      if (i.status === "paid") paid++;
      else unpaid++;
    }
    return {
      monthKey,
      invoices: list,
      paidCount: paid,
      unpaidCount: unpaid,
    };
  });
}

// ──────────────────────────────────────────
// Group completed-but-unpaid orders by service date month.
// Service date is encoded in order_id: aeac-YYYYMMDD-NNN-...
// ──────────────────────────────────────────
export type OrderMonthGroup = {
  monthKey: string;
  orders: CompletedOrder[];
};

function monthKeyFromOrderId(orderId: string): string | null {
  const m = orderId.match(/^aeac-(\d{4})(\d{2})\d{2}-/);
  if (!m) return null;
  return `${m[1]}-${m[2]}`;
}

export function groupOrdersByMonth(orders: CompletedOrder[]): OrderMonthGroup[] {
  const map = new Map<string, CompletedOrder[]>();
  for (const o of orders) {
    const key = monthKeyFromOrderId(o.order_id) ?? "unknown";
    const arr = map.get(key);
    if (arr) arr.push(o);
    else map.set(key, [o]);
  }
  const keys = Array.from(map.keys()).sort((a, b) => {
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return a < b ? 1 : a > b ? -1 : 0;
  });
  return keys.map((monthKey) => ({
    monthKey,
    orders: map.get(monthKey)!,
  }));
}
