// lib/marketing.ts
// Types + format helpers for the /komisi-marketing page.

export type MarketingTeamCode = "DES" | "ERF" | "ERI" | "EVE" | "WID";

export type MarketingSummary = {
  penjualan: number;        // SUM(basis) for selected year
  total_komisi: number;     // SUM(amount) for selected year
  akumulasi_2025: number;   // SUM(amount) for 2025 across all marketing pairs
  total_komisi_all: number; // SUM(amount) all-time across all years (for saldo math)
  sudah_dibayar: number;    // SUM(payouts.total_amount) all-time, status='paid'
  saldo: number;            // total_komisi_all - sudah_dibayar
};

export type AkumulasiRow = {
  team_code: MarketingTeamCode;
  display_name: string;     // "Desti & Cucum"
  earner_id: string;
  total_2025: number;
};

export type MarketingTeamRollup = {
  team_code: MarketingTeamCode;
  display_name: string;
  earner_id: string;
  rows_count: number;       // # commission rows in selected year
  basis_total: number;      // SUM(basis) selected year
  commission_total: number; // SUM(amount) selected year
  total_2025: number;       // SUM(amount) 2025 (independent of selected year)
  total_komisi_all: number; // SUM(amount) all years (for saldo_inc_2025)
  paid_out: number;         // payouts to this team, all-time
  saldo_year: number;       // commission_total - paid_out (informational, may go negative)
  saldo_inc_2025: number;   // total_komisi_all - paid_out (the "headline" balance)
};

export type QuarterStat = {
  quarter: 1 | 2 | 3 | 4;
  commission_total: number;
  basis_total: number;
  rows_count: number;
  has_data: boolean;
};

export type MarketingOrderRow = {
  earned_date: string;             // 'YYYY-MM-DD'
  order_id: string;
  is_synthetic_order_id: boolean;  // true for 'bca-pre-xendit-*' placeholders
  bca_voucher: string | null;      // 'AEAC 2026-04-017' from notes
  notes: string | null;
  basis_amount: number;
  commission_amount: number;
  invoice_id: number | null;
  invoice_number: string | null;
  customer_name: string | null;
  apartment: string | null;
  unit: string | null;
  status: "paid" | "unpaid";
};

export type MarketingTeamOrders = Partial<Record<MarketingTeamCode, MarketingOrderRow[]>>;

export type MarketingRecapData = {
  year: number;
  year_options: number[];
  summary: MarketingSummary;
  akumulasi_2025: AkumulasiRow[];
  quarterly: QuarterStat[];
  per_team: MarketingTeamRollup[];
  team_orders: MarketingTeamOrders;
};

// ─── Format helpers ────────────────────────────────────────────────────────

export function formatRp(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return "Rp " + v.toLocaleString("id-ID");
}

const BULAN_ID_FULL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/**
 * Format an ISO date 'YYYY-MM-DD' as Indonesian: "02 Februari 2026".
 * Returns the input unchanged if it doesn't match the expected pattern.
 */
export function formatTanggalId(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mm, dd] = m;
  const monthIdx = parseInt(mm, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return iso;
  return `${dd} ${BULAN_ID_FULL[monthIdx]} ${y}`;
}

/**
 * Returns the canonical avatar initials for a marketing team display_name.
 * "Desti & Cucum" → "DC", "Erfi & Agasi" → "EA", etc.
 * Falls back to the first 2 chars of team_code if parsing fails.
 */
export function teamInitials(displayName: string, teamCode: string): string {
  const parts = displayName.split("&").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2 && parts[0][0] && parts[1][0]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return teamCode.slice(0, 2).toUpperCase();
}

/**
 * Stable color slot per team_code, used for the avatar circle accent.
 * Five marketing pairs → five hue families. Deliberately not amber (which is
 * reserved for the page accent) and not red/green (which are status colors).
 */
export const TEAM_COLOR_CLASSES: Record<MarketingTeamCode, { bg: string; text: string; border: string }> = {
  DES: { bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200"    }, // pink/rose
  ERF: { bg: "bg-violet-50",  text: "text-violet-700",  border: "border-violet-200"  }, // violet
  ERI: { bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200"     }, // sky blue
  EVE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" }, // green
  WID: { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200"  }, // orange
};

/**
 * Sort rule for the per-team accordion: always alphabetical by team_code,
 * which corresponds to alphabetical by display_name for the five marketing
 * pairs (Desti & Cucum / Erfi & Agasi / Eris & Okta / Evelyn & Are / Widya
 * & Rizky → DES, ERF, ERI, EVE, WID). The `year` parameter is preserved in
 * the signature for forward compatibility but is not used.
 */
export function sortTeams(
  teams: MarketingTeamRollup[],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _year: number
): MarketingTeamRollup[] {
  const arr = [...teams];
  arr.sort((a, b) => a.team_code.localeCompare(b.team_code));
  return arr;
}

/**
 * Group order rows by month-key (YYYY-MM) for sub-grouping in the accordion
 * expansion. Returns months in DESC order (most recent first). Within each
 * month, paid rows come first (DESC by date), then unpaid rows (DESC by date).
 * Counts are split so the month header can show "5 lunas + 2 belum".
 */
export function groupOrdersByMonth(rows: MarketingOrderRow[]): Array<{
  monthKey: string;        // 'YYYY-MM'
  monthLabel: string;      // 'Februari 2026'
  rows: MarketingOrderRow[];
  totalCommission: number; // sum from paid rows only (unpaid contribute 0)
  paidCount: number;
  unpaidCount: number;
}> {
  const buckets = new Map<string, MarketingOrderRow[]>();
  for (const r of rows) {
    const k = r.earned_date.slice(0, 7); // 'YYYY-MM'
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }
  const out: Array<{
    monthKey: string;
    monthLabel: string;
    rows: MarketingOrderRow[];
    totalCommission: number;
    paidCount: number;
    unpaidCount: number;
  }> = [];
  const sortedKeys = [...buckets.keys()].sort().reverse(); // DESC
  for (const k of sortedKeys) {
    const m = /^(\d{4})-(\d{2})$/.exec(k);
    let label = k;
    if (m) {
      const [, y, mm] = m;
      const idx = parseInt(mm, 10) - 1;
      if (idx >= 0 && idx < 12) label = `${BULAN_ID_FULL[idx]} ${y}`;
    }
    const rs = buckets.get(k)!;
    // Sort: paid first, then unpaid; each subgroup DESC by date.
    rs.sort((a, b) => {
      if (a.status !== b.status) return a.status === "paid" ? -1 : 1;
      return b.earned_date.localeCompare(a.earned_date);
    });
    const paidCount = rs.filter((r) => r.status === "paid").length;
    const unpaidCount = rs.length - paidCount;
    const totalCommission = rs.reduce((s, r) => s + r.commission_amount, 0);
    out.push({
      monthKey: k,
      monthLabel: label,
      rows: rs,
      totalCommission,
      paidCount,
      unpaidCount,
    });
  }
  return out;
}
