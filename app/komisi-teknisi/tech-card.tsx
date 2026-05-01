'use client';

import { useState, type ReactNode } from 'react';
import {
  fmtRp,
  bulanShort,
  fmtRatePct,
  quarterOf,
  initials,
  type TechAggregate,
} from '@/lib/komisi';

type Props = {
  pt: TechAggregate;
  year: number;
  team_monthly_basis: Record<number, number>;
  months_desc: number[];
  total_team_sales: number;
  defaultOpen: boolean;
};

export default function TechCard({
  pt,
  year,
  team_monthly_basis,
  months_desc,
  total_team_sales,
  defaultOpen,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const e = pt.earner;
  const avatarClass = e.is_trainee
    ? 'bg-amber-100 text-amber-800'
    : 'bg-blue-100 text-blue-800';
  const roleLine = e.is_trainee ? 'Trainee' : 'Senior';

  const rows = renderTableRows({
    pt,
    year,
    team_monthly_basis,
    months_desc,
    total_team_sales,
  });

  return (
    <div className="bg-white border border-neutral-200 rounded-xl mb-2 overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-amber-50 transition-colors"
      >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${avatarClass}`}>
          {initials(e.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-neutral-900">{e.name}</div>
          <div className="text-[10px] text-neutral-500">{roleLine}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[10px] text-neutral-500">Total {year}</div>
          <div className="text-sm font-semibold text-neutral-900">{fmtRp(pt.total)}</div>
        </div>
        <div
          className={`text-neutral-400 text-sm pl-2 transition-transform ${open ? 'rotate-90' : ''}`}
        >
          ▸
        </div>
      </div>

      {open && (
        <div className="border-t border-neutral-200 bg-neutral-50">
          <table className="w-full text-xs table-fixed">
            <thead>
              <tr className="bg-neutral-100">
                <th className="text-left text-[10px] text-neutral-500 font-medium uppercase tracking-wider px-3 py-2 w-[34%]">Bulan</th>
                <th className="text-right text-[10px] text-neutral-500 font-medium uppercase tracking-wider px-3 py-2 w-[34%]">Penjualan Tim</th>
                <th className="text-right text-[10px] text-neutral-500 font-medium uppercase tracking-wider px-3 py-2 w-[32%]">Komisi</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Table row renderer (mirrors PHP's loop with quarterly subtotals)
// ──────────────────────────────────────────────────────────

function renderTableRows({
  pt,
  year,
  team_monthly_basis,
  months_desc,
  total_team_sales,
}: {
  pt: TechAggregate;
  year: number;
  team_monthly_basis: Record<number, number>;
  months_desc: number[];
  total_team_sales: number;
}): ReactNode[] {
  const rows: ReactNode[] = [];
  let last_q: number | null = null;
  let q_running = { team: 0, komisi: 0 };

  for (const m of months_desc) {
    const month_data = pt.monthly[m] ?? null;
    const team_basis = team_monthly_basis[m] ?? 0;
    const this_q = quarterOf(m);

    // Emit quarter subtotal when we cross a quarter boundary (descending)
    if (last_q !== null && this_q !== last_q) {
      rows.push(
        <tr key={`q-${last_q}-${m}`} className="bg-amber-50 border-y border-amber-200">
          <td className="px-3 py-2 text-amber-700 font-medium">Subtotal Q{last_q}</td>
          <td className="text-right px-3 py-2 text-amber-700 font-medium">{fmtRp(q_running.team)}</td>
          <td className="text-right px-3 py-2 text-amber-700 font-medium">{fmtRp(q_running.komisi)}</td>
        </tr>
      );
      q_running = { team: 0, komisi: 0 };
    }
    last_q = this_q;

    q_running.team += team_basis;
    if (month_data) q_running.komisi += month_data.amount_sum;

    const bulan_label = `${bulanShort(m)} ${year}`;
    let subLabel: string | null = null;
    let amt_label = '—';
    let rate_hint: string | null = null;

    if (month_data) {
      amt_label = fmtRp(month_data.amount_sum);
      if (month_data.has_summary_row && month_data.rates_seen.length > 0) {
        const r_val = parseFloat(month_data.rates_seen[0]);
        rate_hint = `@ ${fmtRatePct(r_val)}%`;
      } else if (month_data.job_count > 0) {
        subLabel = `${month_data.job_count} pekerjaan`;
      }
      if (month_data.has_summary_row) subLabel = 'ringkasan bulanan';
    }

    rows.push(
      <tr key={`m-${m}`} className="border-b border-neutral-200">
        <td className="px-3 py-2.5 align-top">
          {bulan_label}
          {subLabel && (
            <span className="block text-[9px] text-neutral-500 font-normal mt-0.5">
              {subLabel}
            </span>
          )}
        </td>
        <td className="text-right px-3 py-2.5 text-neutral-500">{fmtRp(team_basis)}</td>
        <td className="text-right px-3 py-2.5 font-medium text-neutral-900">
          {amt_label}
          {rate_hint && (
            <span className="block text-[9px] text-neutral-500 font-normal mt-0.5">
              {rate_hint}
            </span>
          )}
        </td>
      </tr>
    );
  }

  // Final quarter subtotal
  if (last_q !== null) {
    rows.push(
      <tr key={`q-final-${last_q}`} className="bg-amber-50 border-y border-amber-200">
        <td className="px-3 py-2 text-amber-700 font-medium">Subtotal Q{last_q}</td>
        <td className="text-right px-3 py-2 text-amber-700 font-medium">{fmtRp(q_running.team)}</td>
        <td className="text-right px-3 py-2 text-amber-700 font-medium">{fmtRp(q_running.komisi)}</td>
      </tr>
    );
  }

  // Year total
  rows.push(
    <tr key="total" className="border-t-2 border-neutral-300 bg-white">
      <td className="px-3 py-3 font-semibold text-neutral-900">Total {year}</td>
      <td className="text-right px-3 py-3 font-semibold text-neutral-500">{fmtRp(total_team_sales)}</td>
      <td className="text-right px-3 py-3 font-semibold text-neutral-900">{fmtRp(pt.total)}</td>
    </tr>
  );

  return rows;
}
