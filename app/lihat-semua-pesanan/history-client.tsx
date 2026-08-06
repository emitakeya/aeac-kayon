'use client';

// app/lihat-semua-pesanan/history-client.tsx
//
// Structure:
//   current year  -> month accordions at the top level, newest first
//   older years   -> a year accordion, opening to reveal its month accordions
//
// Months load their orders on first open (get_orders_history_month). Turning on
// search or a status filter pulls every remaining month in one go, because you
// can't filter what hasn't been fetched. At today's volume (~300 orders across
// 7 months) that's a handful of small calls; if the archive ever reaches tens of
// thousands of rows this is the thing to revisit — move filtering server-side.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  matchesSearch,
  matchesStatus,
  monthLabel,
  orderBadge,
  paymentBadge,
  rupiah,
  STATUS_FILTERS,
  type HistoryOrder,
  type HistorySummaryRow,
  type StatusFilter,
} from '@/lib/orders-history';

type Props = {
  summary: HistorySummaryRow[];
  currentYear: number;
};

export function OrdersHistoryClient({ summary, currentYear }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [orders, setOrders] = useState<Record<string, HistoryOrder[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set());
  const [openYears, setOpenYears] = useState<Set<number>>(new Set());

  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('semua');

  const filterActive = q.trim() !== '' || statusFilter !== 'semua';

  // Guard against duplicate in-flight fetches for the same month.
  const inFlight = useRef<Set<string>>(new Set());

  const loadMonth = useCallback(
    async (ym: string) => {
      if (orders[ym] || inFlight.current.has(ym)) return;
      inFlight.current.add(ym);
      setLoading((s) => ({ ...s, [ym]: true }));

      const { data, error } = await supabase.rpc('get_orders_history_month', { p_ym: ym });

      inFlight.current.delete(ym);
      setLoading((s) => ({ ...s, [ym]: false }));

      if (error) {
        setErrors((s) => ({ ...s, [ym]: error.message }));
        return;
      }
      setErrors((s) => {
        const next = { ...s };
        delete next[ym];
        return next;
      });
      setOrders((s) => ({ ...s, [ym]: (data ?? []) as HistoryOrder[] }));
    },
    [orders, supabase],
  );

  // Filtering needs the whole archive in memory.
  useEffect(() => {
    if (!filterActive) return;
    for (const row of summary) void loadMonth(row.ym);
  }, [filterActive, summary, loadMonth]);

  // Open the newest month on first paint so the page isn't a wall of closed bars.
  useEffect(() => {
    const newest = summary[0]?.ym;
    if (!newest) return;
    setOpenMonths(new Set([newest]));
    void loadMonth(newest);
    // Intentionally first-mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMonth = (ym: string) => {
    setOpenMonths((s) => {
      const next = new Set(s);
      if (next.has(ym)) {
        next.delete(ym);
      } else {
        next.add(ym);
        void loadMonth(ym);
      }
      return next;
    });
  };

  const toggleYear = (yr: number) => {
    setOpenYears((s) => {
      const next = new Set(s);
      if (next.has(yr)) next.delete(yr);
      else next.add(yr);
      return next;
    });
  };

  const visibleOrders = useCallback(
    (ym: string): HistoryOrder[] => {
      const rows = orders[ym] ?? [];
      if (!filterActive) return rows;
      return rows.filter((o) => matchesStatus(o, statusFilter) && matchesSearch(o, q));
    },
    [orders, filterActive, statusFilter, q],
  );

  const currentYearRows = summary.filter((r) => r.yr === currentYear);
  const olderYears = useMemo(() => {
    const map = new Map<number, HistorySummaryRow[]>();
    for (const r of summary) {
      if (r.yr === currentYear) continue;
      const list = map.get(r.yr) ?? [];
      list.push(r);
      map.set(r.yr, list);
    }
    return [...map.entries()].sort((a, b) => b[0] - a[0]);
  }, [summary, currentYear]);

  const totalMatches = filterActive
    ? summary.reduce((n, r) => n + visibleOrders(r.ym).length, 0)
    : 0;
  const stillLoading = filterActive && summary.some((r) => loading[r.ym]);

  const renderMonth = (row: HistorySummaryRow) => {
    const rows = visibleOrders(row.ym);
    if (filterActive && rows.length === 0 && !loading[row.ym]) return null;

    const isOpen = filterActive || openMonths.has(row.ym);

    return (
      <div
        key={row.ym}
        className="border border-neutral-200 rounded-xl bg-white overflow-hidden mb-2"
      >
        <button
          type="button"
          onClick={() => !filterActive && toggleMonth(row.ym)}
          aria-expanded={isOpen}
          className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left hover:bg-neutral-50 transition"
        >
          <Caret open={isOpen} />
          <span className="flex-1 text-sm font-semibold text-neutral-900">
            {monthLabel(row.mon)} {row.yr}
          </span>
          <span className="text-right text-[11px] text-neutral-500 leading-snug">
            {filterActive ? (
              <>{rows.length} cocok</>
            ) : (
              <>
                {row.n_orders} pesanan
                {row.n_cancelled > 0 ? ` · ${row.n_cancelled} batal` : ''}
                {row.paid_total > 0 ? (
                  <span className="block text-emerald-700 font-semibold">
                    {rupiah(row.paid_total)} lunas
                  </span>
                ) : null}
              </>
            )}
          </span>
        </button>

        {isOpen && (
          <div className="px-3 pb-3 border-t border-neutral-100">
            {loading[row.ym] && <SkeletonRows />}
            {errors[row.ym] && (
              <p className="text-xs text-red-700 mt-3">Gagal memuat: {errors[row.ym]}</p>
            )}
            {!loading[row.ym] && !errors[row.ym] && rows.length === 0 && (
              <p className="text-xs text-neutral-500 mt-3">Tidak ada pesanan.</p>
            )}
            {rows.map((o) => (
              <OrderCard key={o.order_id} o={o} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari order ID, nama, apartemen, unit…"
        className="w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white
                   focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-300"
      />

      <div className="flex flex-wrap gap-1.5 mt-2 mb-4">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={`text-[11px] px-3 py-1.5 rounded-full border transition ${
              statusFilter === f.key
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filterActive && (
        <p className="text-[11px] text-neutral-500 mb-3 px-1">
          {stillLoading ? 'Mencari di semua bulan…' : `${totalMatches} pesanan cocok`}
        </p>
      )}

      {summary.length === 0 && (
        <p className="text-sm text-neutral-500">Belum ada pesanan.</p>
      )}

      {currentYearRows.map(renderMonth)}

      {olderYears.map(([yr, months]) => {
        const yearOpen = filterActive || openYears.has(yr);
        const monthNodes = months.map(renderMonth).filter(Boolean);
        if (filterActive && monthNodes.length === 0) return null;

        const totals = months.reduce(
          (acc, m) => ({
            n: acc.n + m.n_orders,
            c: acc.c + m.n_cancelled,
            paid: acc.paid + m.paid_total,
          }),
          { n: 0, c: 0, paid: 0 },
        );

        return (
          <div
            key={yr}
            className="border border-neutral-300 rounded-xl bg-neutral-100 overflow-hidden mt-4 mb-2"
          >
            <button
              type="button"
              onClick={() => !filterActive && toggleYear(yr)}
              aria-expanded={yearOpen}
              className="w-full flex items-center gap-2.5 px-3.5 py-3 text-left hover:bg-neutral-200/60 transition"
            >
              <Caret open={yearOpen} />
              <span className="flex-1 text-[15px] font-semibold text-neutral-900">{yr}</span>
              <span className="text-right text-[11px] text-neutral-500 leading-snug">
                {totals.n} pesanan
                {totals.c > 0 ? ` · ${totals.c} batal` : ''}
                {totals.paid > 0 ? (
                  <span className="block text-emerald-700 font-semibold">
                    {rupiah(totals.paid)} lunas
                  </span>
                ) : null}
              </span>
            </button>

            {yearOpen && <div className="px-2.5 pb-2.5">{monthNodes}</div>}
          </div>
        );
      })}
    </>
  );
}

// ── Pieces ───────────────────────────────────────────────────────────────────

function Caret({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`w-2 h-2 shrink-0 border-r-2 border-b-2 border-neutral-400 transition-transform ${
        open ? 'rotate-45' : '-rotate-45'
      }`}
    />
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2 mt-3" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="h-20 rounded-lg bg-neutral-100 animate-pulse" />
      ))}
    </div>
  );
}

function OrderCard({ o }: { o: HistoryOrder }) {
  const cancelled = o.status === 'cancelled';
  const ob = orderBadge(o.status);
  const pb = paymentBadge(o);

  const techs = (o.technicians ?? []).filter(Boolean);
  const orderedBy = o.ordered_by_name
    ? `${o.ordered_by_name}${o.ordered_by_team ? ` (Tim ${o.ordered_by_team})` : ''}`
    : null;

  return (
    <div
      className={`rounded-lg border p-3 mt-2 ${
        cancelled ? 'bg-red-50/60 border-red-200' : 'bg-white border-neutral-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-neutral-500 truncate">{o.order_id}</div>
          <div
            className={`text-[13.5px] font-semibold mt-0.5 ${
              cancelled ? 'line-through text-neutral-500' : 'text-neutral-900'
            }`}
          >
            {o.name_roma ?? o.name_kanji ?? '—'}
          </div>
          <div className="text-[11.5px] text-neutral-500 mt-0.5 leading-relaxed">
            {o.scheduled_date ?? '—'}
            {o.apartment ? ` · ${o.apartment}` : ''}
            {o.unit ? ` — Unit ${o.unit}` : ''}
            {techs.length > 0 && (
              <>
                <br />
                Teknisi: {techs.join(', ')}
              </>
            )}
            {orderedBy && (
              <>
                <br />
                Dipesan oleh: {orderedBy}
              </>
            )}
          </div>

          {(o.services ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(o.services ?? []).map((s, i) => (
                <span
                  key={`${s}-${i}`}
                  className="text-[10px] bg-neutral-100 text-neutral-600 rounded px-1.5 py-0.5"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          {cancelled && o.notes && (
            <p className="text-[11px] text-red-700 italic mt-1.5">{o.notes}</p>
          )}
        </div>

        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${ob.cls}`}
        >
          {ob.label}
        </span>
      </div>

      {/* Payment strip — a cancelled order owes nothing, so it gets none. */}
      {!cancelled && (
        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-dashed border-neutral-200">
          <div className="min-w-0">
            <div className="text-[13px] font-bold tabular-nums text-neutral-900">
              {o.invoice_total != null ? rupiah(o.invoice_total) : '—'}
            </div>
            <div className="text-[10.5px] text-neutral-500 truncate">
              {o.invoice_number
                ? [o.invoice_number, o.paid_date, o.payment_method].filter(Boolean).join(' · ')
                : 'Belum ada invoice'}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${pb.cls}`}
            >
              {pb.label}
            </span>
            {o.xendit_payment_url && o.invoice_status !== 'paid' && (
              <a
                href={o.xendit_payment_url}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-amber-700 underline underline-offset-2"
              >
                Link Xendit
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
