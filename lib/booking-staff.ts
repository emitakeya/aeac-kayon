// lib/booking-staff.ts
// Types, constants, and pure helpers for the Kayon staff booking flow
// (/booking-staff page + /api/booking-staff/create route).

export const GAS_URL =
  "https://script.google.com/macros/s/AKfycbw_F2761A5aCtbFBN2VzlQC4SIXiyAmbq9ohOPSuM0HadN0y7A93yEkhcgk-PaByMhyew/exec";

// ── RPC shapes (get_staff_booking_context) ─────────────────────────────
export type StaffMe = {
  email: string;
  role: string;
  team_code: string | null;
  name: string;
};

export type TeamMember = {
  staff_id: string;
  role: "marketing" | "tro";
  name: string;
  team_code?: string | null;
  is_self: boolean;
};

export type PrefillServiceItem = {
  name: string;
  qty: number;
  price: number;
  amount?: number;
};

export type Prefill = {
  ref_order_id: string;
  apartment: string | null;
  unit: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  standby_name: string | null;
  standby_phone: string | null;
  services: PrefillServiceItem[];
};

export type BookingContext = {
  me: StaffMe;
  team: TeamMember[];
  prefill: Prefill | null;
};

// ── Cart ───────────────────────────────────────────────────────────────
export type CartItem = { name: string; qty: number; price: number };

// ── Service catalog (built from public.services rows) ───────────────────
export type RawService = { id: number; name_id: string; price: number; category: string };

export type CatalogOption = { id: number; name: string; label: string; price: number };

export type CatalogCard =
  | { kind: "simple"; key: string; name: string; price: number; priceLabel: string }
  | { kind: "range"; key: string; name: string; minPrice: number; priceLabel: string }
  | { kind: "options"; key: string; name: string; options: CatalogOption[]; priceLabel: string };

export type CatalogSection = { title: string; cards: CatalogCard[] };

// ── API contract ─────────────────────────────────────────────────────────
export type CreateBookingBody = {
  ordered_by_staff_id: string;
  scheduled_date: string;
  services: string[];
  apartment: string;
  unit: string;
  tenant_name: string;
  tenant_email?: string | null;
  notes?: string | null;
  standby_name?: string | null;
  standby_phone?: string | null;
  ref_order_id?: string | null;
  total_estimate?: number;
};

export type CreateBookingResponse =
  | { ok: true; order_id: string }
  | { ok: false; error: string };

// ── Bongkar/Pasang service ids (rendered as a tiered "Pindah / Pasang" card) ──
const BONGKAR_PASANG_IDS = new Set([17, 18, 19]);

// Strip a trailing " (0.5–1 PK)" / " (1.5–2 PK)" style suffix to get the base name.
const PK_SUFFIX = /\s*\([^)]*PK\)\s*$/i;
function baseName(name: string): string {
  return name.replace(PK_SUFFIX, "").trim();
}
function pkLabel(name: string): string {
  const m = name.match(/\(([^)]*PK)\)/i);
  return m ? m[1].trim() : name;
}

export function formatRupiah(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

// Build the order.services string exactly like the existing system stores it:
//   qty > 1 : "<name> ×<qty> — Rp <total>"
//   qty = 1 : "<name> — Rp <price>"
export function buildServiceString(item: CartItem): string {
  const total = item.qty * item.price;
  return item.qty > 1
    ? `${item.name} ×${item.qty} — ${formatRupiah(total)}`
    : `${item.name} — ${formatRupiah(item.price)}`;
}

export function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, i) => sum + i.qty * i.price, 0);
}

// Group the raw services table into the sections the WP form presents.
export function buildCatalog(rows: RawService[]): CatalogSection[] {
  const cleaning = rows.filter((r) => r.category === "cleaning");
  const freon = rows.filter((r) => r.category === "freon");
  const repair = rows.filter((r) => r.category === "repair" && !BONGKAR_PASANG_IDS.has(r.id));
  const bongkar = rows.filter((r) => r.category === "repair" && BONGKAR_PASANG_IDS.has(r.id));

  // Cleaning: collapse PK variants into one card keyed by base name.
  const cleaningGroups = new Map<string, RawService[]>();
  for (const r of cleaning) {
    const base = baseName(r.name_id);
    if (!cleaningGroups.has(base)) cleaningGroups.set(base, []);
    cleaningGroups.get(base)!.push(r);
  }

  const splitCards: CatalogCard[] = [];
  const otherCards: CatalogCard[] = [];
  for (const [base, group] of cleaningGroups) {
    const prices = group.map((g) => g.price).sort((a, b) => a - b);
    const min = prices[0];
    const max = prices[prices.length - 1];
    const card: CatalogCard =
      group.length > 1
        ? {
            kind: "range",
            key: base,
            name: base,
            minPrice: min,
            priceLabel: `${formatRupiah(min)}–${formatRupiah(max)}`,
          }
        : { kind: "simple", key: base, name: base, price: min, priceLabel: formatRupiah(min) };
    if (base.toLowerCase().startsWith("ac split")) splitCards.push(card);
    else otherCards.push(card);
  }

  const sections: CatalogSection[] = [];
  if (splitCards.length) sections.push({ title: "Cuci AC Split", cards: splitCards });
  if (otherCards.length) sections.push({ title: "Cuci AC Lainnya", cards: otherCards });

  const extra: CatalogCard[] = [];
  if (freon.length) {
    extra.push({
      kind: "options",
      key: "freon",
      name: "Isi Ulang Freon",
      priceLabel: `${formatRupiah(Math.min(...freon.map((f) => f.price)))}–${formatRupiah(
        Math.max(...freon.map((f) => f.price))
      )}`,
      options: freon.map((f) => ({ id: f.id, name: f.name_id, label: pkLabel(f.name_id), price: f.price })),
    });
  }
  for (const r of repair) {
    extra.push({ kind: "simple", key: `r${r.id}`, name: r.name_id, price: r.price, priceLabel: formatRupiah(r.price) });
  }
  if (extra.length) sections.push({ title: "Layanan Tambahan", cards: extra });

  if (bongkar.length) {
    sections.push({
      title: "Pindah / Pasang Unit",
      cards: [
        {
          kind: "options",
          key: "bongkar",
          name: "AC — Bongkar / Pasang",
          priceLabel: `${formatRupiah(Math.min(...bongkar.map((b) => b.price)))}–${formatRupiah(
            Math.max(...bongkar.map((b) => b.price))
          )}`,
          options: bongkar
            .sort((a, b) => a.price - b.price)
            .map((b) => ({ id: b.id, name: b.name_id, label: b.name_id, price: b.price })),
        },
      ],
    });
  }

  return sections;
}

// ── Date / session rules (Sen–Sabtu; Sabtu AM only; closed Minggu) ──────
const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export function allowedSessions(isoDate: string): ("AM" | "PM")[] {
  if (!isoDate) return [];
  const d = new Date(isoDate + "T00:00:00");
  const dow = d.getDay(); // 0 = Sunday
  if (dow === 0) return []; // closed
  if (dow === 6) return ["AM"]; // Saturday AM only
  return ["AM", "PM"];
}

// Build "YYYY-MM-DD (Hari) AM|PM" from an ISO date + session.
export function formatScheduledDate(isoDate: string, session: "AM" | "PM"): string {
  const d = new Date(isoDate + "T00:00:00");
  const hari = HARI_ID[d.getDay()];
  return `${isoDate} (${hari}) ${session}`;
}

export function todayJakartaISO(): string {
  // Jakarta is UTC+7, no DST.
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}
