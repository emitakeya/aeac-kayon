/**
 * Tech commission recap — types and aggregation.
 *
 * Mirrors the per-tech-per-month aggregation from the legacy PHP shortcode
 * `aeac_tech_commission_recap`. All amounts are in IDR (integer), matching
 * the database column types.
 *
 * Data source: public.get_tech_commission_recap(year) — see migration
 * `aeac_kayon_get_tech_commission_recap_fix_column`.
 */

// ──────────────────────────────────────────────────────────
// Raw shapes returned by the RPC
// ──────────────────────────────────────────────────────────

export type RawEarner = {
  id: string;
  name: string;
  is_trainee: boolean;
  default_rate: number;
  start_date: string;
  active: boolean;
};

export type RawCommission = {
  earner_id: string;
  earned_date: string; // 'YYYY-MM-DD'
  basis_amount: number;
  rate: number;
  amount: number;
  status: 'pending' | 'available' | 'paid_out' | string;
  order_id: string | null;
  invoice_id: number | null;
};

export type RecapPayload = {
  earners: RawEarner[];
  commissions: RawCommission[];
};

// ──────────────────────────────────────────────────────────
// Aggregated shapes used by the page
// ──────────────────────────────────────────────────────────

export type MonthCell = {
  amount_sum: number;
  basis_sum: number;
  job_count: number;
  rates_seen: string[];
  has_summary_row: boolean;
};

export type TechAggregate = {
  earner: RawEarner;
  monthly: Record<number, MonthCell>; // keyed by month 1..12
  total: number;
  paid_out: number;
  available: number;
  pending: number;
  jobs: number;
};

export type QuarterCell = {
  team_sales: number;
  commission: number;
  has_data: boolean;
};

export type Aggregated = {
  per_tech: Record<string, TechAggregate>; // keyed by earner_id
  techs_with_data: TechAggregate[];        // sorted: senior first, then alpha
  team_monthly_basis: Record<number, number>;
  months_desc: number[];                   // present months, newest first
  total_team_sales: number;
  total_commission: number;
  total_paid_out: number;
  total_available: number;
  quarterly: Record<number, QuarterCell>;  // keyed 1..4
};

// ──────────────────────────────────────────────────────────
// Aggregation
// ──────────────────────────────────────────────────────────

export function aggregate(payload: RecapPayload): Aggregated {
  const earners = payload.earners ?? [];
  const commissions = payload.commissions ?? [];

  // Initialize per-tech buckets
  const per_tech: Record<string, TechAggregate> = {};
  for (const e of earners) {
    per_tech[e.id] = {
      earner: e,
      monthly: {},
      total: 0,
      paid_out: 0,
      available: 0,
      pending: 0,
      jobs: 0,
    };
  }

  const team_monthly_basis: Record<number, number> = {};
  // Tracks which invoice_ids (or summary keys) we've already counted for team_monthly_basis
  // — basis_amount is the WHOLE TEAM's portion, so we must only add it once per invoice/summary.
  const monthly_seen: Record<number, Set<string>> = {};

  for (const c of commissions) {
    const bucket = per_tech[c.earner_id];
    if (!bucket) continue;

    const month = parseInt(c.earned_date.slice(5, 7), 10);
    const basis = Number(c.basis_amount);
    const amt = Number(c.amount);
    const rate = Number(c.rate);
    const invoice_id = c.invoice_id;

    if (!bucket.monthly[month]) {
      bucket.monthly[month] = {
        amount_sum: 0,
        basis_sum: 0,
        job_count: 0,
        rates_seen: [],
        has_summary_row: false,
      };
    }
    bucket.monthly[month].amount_sum += amt;

    if (!monthly_seen[month]) monthly_seen[month] = new Set<string>();

    if (invoice_id != null) {
      // Per-job commission row
      bucket.monthly[month].job_count += 1;
      bucket.monthly[month].basis_sum += basis;
      const rate_key = String(rate);
      if (!bucket.monthly[month].rates_seen.includes(rate_key)) {
        bucket.monthly[month].rates_seen.push(rate_key);
      }
      bucket.jobs += 1;

      const seen_key = `inv:${invoice_id}`;
      if (!monthly_seen[month].has(seen_key)) {
        monthly_seen[month].add(seen_key);
        team_monthly_basis[month] = (team_monthly_basis[month] ?? 0) + basis;
      }
    } else {
      // Monthly summary row (Jan / early Feb 2026 backfill)
      bucket.monthly[month].has_summary_row = true;
      bucket.monthly[month].basis_sum = basis;
      bucket.monthly[month].rates_seen.push(String(rate));

      const seen_key = `sum:${c.order_id ?? ''}`;
      if (!monthly_seen[month].has(seen_key)) {
        monthly_seen[month].add(seen_key);
        team_monthly_basis[month] = (team_monthly_basis[month] ?? 0) + basis;
      }
    }

    bucket.total += amt;
    if (c.status === 'paid_out') bucket.paid_out += amt;
    if (c.status === 'available') bucket.available += amt;
    if (c.status === 'pending') bucket.pending += amt;
  }

  // Year-scoped totals
  let total_team_sales = 0;
  for (const m of Object.keys(team_monthly_basis)) {
    total_team_sales += team_monthly_basis[Number(m)];
  }

  let total_commission = 0;
  let total_paid_out = 0;
  let total_available = 0;
  for (const eid of Object.keys(per_tech)) {
    const pt = per_tech[eid];
    total_commission += pt.total;
    total_paid_out += pt.paid_out;
    total_available += pt.available;
  }

  // Quarterly subtotals
  const quarterly: Record<number, QuarterCell> = {
    1: { team_sales: 0, commission: 0, has_data: false },
    2: { team_sales: 0, commission: 0, has_data: false },
    3: { team_sales: 0, commission: 0, has_data: false },
    4: { team_sales: 0, commission: 0, has_data: false },
  };

  for (const m of Object.keys(team_monthly_basis)) {
    const month = Number(m);
    const q = quarterOf(month);
    quarterly[q].team_sales += team_monthly_basis[month];
    quarterly[q].has_data = true;
  }

  for (const eid of Object.keys(per_tech)) {
    for (const m of Object.keys(per_tech[eid].monthly)) {
      const month = Number(m);
      const q = quarterOf(month);
      quarterly[q].commission += per_tech[eid].monthly[month].amount_sum;
      quarterly[q].has_data = true;
    }
  }

  // Techs with data, ordered: seniors first, then trainees, alpha within each
  const techs_with_data = Object.values(per_tech)
    .filter((pt) => Object.keys(pt.monthly).length > 0)
    .sort((a, b) => {
      if (a.earner.is_trainee !== b.earner.is_trainee) {
        return a.earner.is_trainee ? 1 : -1;
      }
      return a.earner.name.localeCompare(b.earner.name);
    });

  // Months present, sorted descending (newest first)
  const months_desc = Object.keys(team_monthly_basis)
    .map(Number)
    .sort((a, b) => b - a);

  return {
    per_tech,
    techs_with_data,
    team_monthly_basis,
    months_desc,
    total_team_sales,
    total_commission,
    total_paid_out,
    total_available,
    quarterly,
  };
}

// ──────────────────────────────────────────────────────────
// Formatters
// ──────────────────────────────────────────────────────────

export function fmtRp(n: number): string {
  return 'Rp ' + new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n || 0));
}

export function bulanShort(month: number): string {
  const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return months[month] ?? '';
}

export function quarterOf(month: number): number {
  return Math.ceil(month / 3);
}

/**
 * Format a rate (e.g. 0.075) as a clean Indonesian-style percent ("7,5%").
 * Trailing zeros and trailing comma are stripped.
 */
export function fmtRatePct(rate: number): string {
  const pct = (rate * 100).toFixed(2);
  // Normalize "7.50" → "7,5", "0.00" → "0", "2.50" → "2,5"
  let cleaned = pct.replace(/0+$/, '').replace(/\.$/, '');
  if (cleaned === '' || cleaned === '0') return '0';
  return cleaned.replace('.', ',');
}

export function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

// Year selector options (matches PHP)
export function yearOptions(currentYear: number): number[] {
  const base = [2025, 2026];
  if (!base.includes(currentYear)) base.push(currentYear);
  return base.sort((a, b) => b - a);
}
