// lib/laporan.ts
// Types + helpers for /laporan-teknisi.
//
// Mirrors the WP form-laporan-teknisi structure but with the unit-name mapping
// fixed to match what's actually in services.name_id (the WP source had
// "AC Split Cuci Bongkar" which doesn't exist in the DB — the real names are
// "AC Split Semi Bongkar"). lib/invoices.ts already uses the correct names.

// ──────────────────────────────────────────
// Types — mirror the RPC return shape (get_laporan_initial_data).
// ──────────────────────────────────────────

export type CustomerLite = {
  name_roma: string | null;
  name_kanji: string | null;
  apartment: string | null;
  unit: string | null;
  mobile: string | null;
  email: string | null;
};

export type LaporanOrder = {
  order_id: string;
  scheduled_date: string | null;
  services: string[] | null;
  status: string;
  customer: CustomerLite;
};

export type LaporanService = {
  name_id: string;
  name_ja: string | null;
  category: string | null;
  price: number;
};

export type ChecklistOption = {
  text_id: string;
  text_ja: string | null;
};

export type LaporanChecklists = {
  kondisi: ChecklistOption[];
  tindakan: ChecklistOption[];
  rekomendasi: ChecklistOption[];
  perbaikan: ChecklistOption[];
};

export type LaporanTechnician = {
  id: string;
  name: string;
  email: string | null;
};

export type LaporanInitialData = {
  current_user: {
    technician_id: string | null;
    technician_name: string | null;
  };
  orders: LaporanOrder[];
  services: LaporanService[];
  checklists: LaporanChecklists;
  technicians: LaporanTechnician[];
};

// ──────────────────────────────────────────
// Constants
// ──────────────────────────────────────────

// BCC list that goes on the customer report email — fixed addresses only.
// The 4 technician emails get appended at submit time from the RPC's
// technicians list, so we don't hardcode them here.
export const BCC_FIXED = [
  "servisacapartemen@gmail.com",
  "aeac@maisonmap.com",
] as const;

// Maps each reports.unit_* column to the corresponding services.name_id.
// IMPORTANT: These names must match services.name_id EXACTLY (verified via
// MCP on 2026-05-12). The WP source incorrectly used "AC Split Cuci Bongkar"
// for the semi-bongkar entries — we fix that here. The unit_perbaikan column
// has no corresponding service (perbaikan items come from checklists.perbaikan
// and are stored in perbaikan_dilakukan), so its svc_id is null.
//
// Uses Unicode en-dash (U+2013) between the PK numbers — copy with care.
export const UNIT_KEYS: ReadonlyArray<{
  key: UnitKey;
  svc_id: string | null;
}> = [
  { key: "unit_split_standar_small",     svc_id: "AC Split Cuci Standar (0.5–1 PK)" },
  { key: "unit_split_standar_large",     svc_id: "AC Split Cuci Standar (1.5–2 PK)" },
  { key: "unit_split_semibongkar_small", svc_id: "AC Split Semi Bongkar (0.5–1 PK)" },
  { key: "unit_split_semibongkar_large", svc_id: "AC Split Semi Bongkar (1.5–2 PK)" },
  { key: "unit_cassette",                svc_id: "AC Cassette" },
  { key: "unit_ducting",                 svc_id: "AC Ducting" },
  { key: "unit_perbaikan",               svc_id: null }, // no direct service; comes from checklists.perbaikan
];

export type UnitKey =
  | "unit_split_standar_small"
  | "unit_split_standar_large"
  | "unit_split_semibongkar_small"
  | "unit_split_semibongkar_large"
  | "unit_cassette"
  | "unit_ducting"
  | "unit_perbaikan";

export type UnitCounts = Record<UnitKey, number>;

export const ZERO_UNIT_COUNTS: UnitCounts = {
  unit_split_standar_small: 0,
  unit_split_standar_large: 0,
  unit_split_semibongkar_small: 0,
  unit_split_semibongkar_large: 0,
  unit_cassette: 0,
  unit_ducting: 0,
  unit_perbaikan: 0,
};

// Max photos per side (matches WP).
export const MAX_PHOTOS_PER_SIDE = 4;

// ──────────────────────────────────────────
// Format helpers
// ──────────────────────────────────────────

// Indonesian Rupiah formatter — matches WP fmtRp.
// 150000 → "Rp 150.000"
export function fmtRp(n: number | null | undefined): string {
  const v = Number(n) || 0;
  return "Rp " + v.toLocaleString("id-ID");
}

// Title-case for customer names — matches WP toProper().
// "yamada taro" → "Yamada Taro"
export function toProper(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ──────────────────────────────────────────
// Service ↔ unit-count sync
// ──────────────────────────────────────────
//
// The form's primary state is `serviceCounts` (a name_id → qty map; what the
// user actually picked on Step 2). We derive two things from it on submit:
//   1. `pengerjaan` — array of service names where qty > 0
//   2. `unitCounts` — the 7 unit_* columns the reports table wants, derived
//      via UNIT_KEYS for backward compat with invoice line-item builders

export function deriveUnitCounts(
  serviceCounts: Record<string, number>,
): UnitCounts {
  const out: UnitCounts = { ...ZERO_UNIT_COUNTS };
  for (const u of UNIT_KEYS) {
    if (!u.svc_id) continue;
    const qty = serviceCounts[u.svc_id];
    if (typeof qty === "number" && qty > 0) {
      out[u.key] = qty;
    }
  }
  return out;
}

export function derivePengerjaan(
  serviceCounts: Record<string, number>,
): string[] {
  return Object.entries(serviceCounts)
    .filter(([, qty]) => (Number(qty) || 0) > 0)
    .map(([name]) => name);
}

// ──────────────────────────────────────────
// Image compression — matches WP compressImage()
// ──────────────────────────────────────────

export function compressImage(
  file: File,
  maxWidth = 1200,
  quality = 0.8,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File read failed"));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image decode failed"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas 2D context unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas toBlob returned null"));
          },
          "image/jpeg",
          quality,
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ──────────────────────────────────────────
// Photo upload to Supabase Storage `report-photos` bucket
// ──────────────────────────────────────────
//
// Uses anon key directly (matches WP). The bucket has anon insert policy.
// Returns the public URL on success.

export async function uploadPhoto(
  blob: Blob,
  filename: string,
  supabaseUrl: string,
  anonKey: string,
): Promise<string> {
  const res = await fetch(
    `${supabaseUrl}/storage/v1/object/report-photos/${filename}`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "image/jpeg",
        "x-upsert": "true",
      },
      body: blob,
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Photo upload failed (${res.status}): ${t.slice(0, 200)}`);
  }
  return `${supabaseUrl}/storage/v1/object/public/report-photos/${filename}`;
}

// Filename slug — same scheme as WP:
//   "aeac-20260510-001-FooBar" → "aeac-20260510-001-foobar-before-001.jpg"
export function photoFilename(
  orderId: string,
  side: "before" | "after",
  idx: number,
): string {
  const slug = orderId.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const num = String(idx + 1).padStart(3, "0");
  return `${slug}-${side}-${num}.jpg`;
}

// ──────────────────────────────────────────
// Invoice token — 24-char base64-ish random.
// Matches the WP-side length so the existing /tech-invoice page accepts both.
// 18 random bytes → 24 base64 chars after stripping +/=.
// ──────────────────────────────────────────

export function generateInvoiceToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  // btoa expects a binary string
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/[+/=]/g, "").slice(0, 24);
}

// ──────────────────────────────────────────
// Time helpers
// ──────────────────────────────────────────

// "08:30" / "8:30" / "08:30:00" → "08:30"  (normalises to HH:MM)
// Returns null if not parseable, so callers can drop bad input.
export function normaliseTime(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = String(Number(m[1])).padStart(2, "0");
  return `${hh}:${m[2]}`;
}

// ──────────────────────────────────────────
// Customer-email helper — primary customer email only (no ordered_by here;
// laporan email is for the customer, not the booker).
// ──────────────────────────────────────────

export function customerDisplayName(c: CustomerLite): string {
  return toProper(c.name_roma) || c.name_kanji || "—";
}
