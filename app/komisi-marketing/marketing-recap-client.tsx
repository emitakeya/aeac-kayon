"use client";

// app/komisi-marketing/marketing-recap-client.tsx
//
// Client Component. Renders the marketing commission recap page:
//   - Header with back link + user pill
//   - Year selector (form GETs ?year=…)
//   - Akumulasi 2025 baseline strip
//   - 4 summary tiles (Penjualan, Total Komisi, Sudah Dibayar, Saldo)
//   - Quarterly subtotal bar
//   - Per-team accordion list (sorted per spec)
//
// All UI strings in Bahasa Indonesia. Mobile-first, scales up to desktop.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type MarketingRecapData,
  type MarketingTeamRollup,
  type MarketingOrderRow,
  formatRp,
  formatTanggalId,
  teamInitials,
  TEAM_COLOR_CLASSES,
  sortTeams,
  groupOrdersByMonth,
} from "@/lib/marketing";

export default function MarketingRecapClient({
  data,
  meName,
}: {
  data: MarketingRecapData;
  meName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [yearDraft, setYearDraft] = useState<number>(data.year);

  // All team cards start closed; user opens whichever they want
  const [openTeamCode, setOpenTeamCode] = useState<string | null>(null);

  function applyYear(y: number) {
    if (y === data.year) return;
    startTransition(() => {
      router.push(`/komisi-marketing?year=${y}`);
    });
  }

  const sorted = sortTeams(data.per_team, data.year);
  const is2025 = data.year === 2025;

  const totalAkumulasi2025 = data.akumulasi_2025.reduce(
    (s, a) => s + a.total_2025,
    0
  );

  return (
    <main className="max-w-3xl mx-auto px-4 py-5 pb-20">
      {/* Header strip with back link + user pill */}
      <header className="flex items-center justify-between mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900"
        >
          ← Dashboard
        </Link>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
          {meName} / AEAC
        </span>
      </header>

      {/* Title section */}
      <section className="rounded-xl overflow-hidden border border-neutral-200 bg-white mb-4">
        <div className="h-1.5 bg-gradient-to-r from-amber-500 to-amber-600" />
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold text-neutral-900 leading-tight">
            Rekap Komisi Marketing
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Berdasarkan bulan penerimaan pembayaran
          </p>
        </div>
      </section>

      {/* Year selector */}
      <section className="mb-4 flex items-center gap-2">
        <label
          htmlFor="km-year"
          className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider"
        >
          Tahun
        </label>
        <select
          id="km-year"
          value={yearDraft}
          onChange={(e) => setYearDraft(parseInt(e.target.value, 10))}
          className="text-sm rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
          disabled={pending}
        >
          {data.year_options.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => applyYear(yearDraft)}
          disabled={pending || yearDraft === data.year}
          className="text-sm rounded-lg bg-amber-500 hover:bg-amber-600 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white px-3 py-1.5 font-medium transition-colors"
        >
          {pending ? "Memuat…" : "Tampilkan"}
        </button>
      </section>

      {/* Akumulasi 2025 baseline strip — always shown */}
      <section className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
            Akumulasi 2025 (Per Tim — Baseline Tetap)
          </span>
          <span className="text-[11px] font-semibold text-neutral-700">
            Total: {formatRp(totalAkumulasi2025)}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {data.akumulasi_2025.map((a) => {
            const colors = TEAM_COLOR_CLASSES[a.team_code];
            return (
              <div
                key={a.team_code}
                className={`rounded-md border ${colors.border} ${colors.bg} px-2 py-1.5`}
              >
                <div className={`text-[10px] font-semibold ${colors.text}`}>
                  {a.team_code}
                </div>
                <div className="text-[12px] font-semibold text-neutral-900 mt-0.5 truncate">
                  {formatRp(a.total_2025)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Summary tiles */}
      <section className="grid grid-cols-2 gap-2 mb-3">
        <Tile
          label={`Penjualan ${data.year}`}
          value={formatRp(data.summary.penjualan)}
        />
        <Tile
          label="Total Komisi"
          value={formatRp(data.summary.total_komisi)}
          sublabel={`Tahun ${data.year}`}
        />
        <Tile
          label="Sudah Dibayar"
          value={formatRp(data.summary.sudah_dibayar)}
          tone="success"
          sublabel="Total seluruh waktu"
        />
        <Tile
          label="Saldo"
          value={formatRp(data.summary.saldo)}
          tone="warning"
          sublabel="Belum terbayar"
        />
      </section>

      {/* Quarterly subtotals — only when there's data for the year */}
      {data.summary.total_komisi > 0 && (
        <section className="rounded-xl border border-neutral-200 bg-white px-3.5 py-3 mb-4">
          <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
            Total Komisi per Kuartal
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {data.quarterly.map((q) => (
              <div
                key={q.quarter}
                className="rounded-md bg-neutral-50 border border-neutral-200 text-center py-2"
              >
                <div className="text-[10px] text-neutral-500 font-medium">
                  Q{q.quarter}
                </div>
                <div
                  className={`text-[12px] font-semibold mt-0.5 ${
                    q.has_data && q.commission_total > 0
                      ? "text-neutral-900"
                      : "text-neutral-300"
                  }`}
                >
                  {q.has_data && q.commission_total > 0
                    ? formatRp(q.commission_total)
                    : "—"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Per-team accordion */}
      <section>
        <h2 className="text-[11px] font-medium text-neutral-500 uppercase tracking-wider mb-2 px-1">
          Per Tim
        </h2>

        {sorted.length === 0 ? (
          <div className="text-sm text-neutral-500 italic px-3 py-6 text-center bg-neutral-50 rounded-xl border border-neutral-200">
            Belum ada data komisi untuk tahun {data.year}.
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((team) => (
              <TeamCard
                key={team.team_code}
                team={team}
                year={data.year}
                isOpen={openTeamCode === team.team_code}
                onToggle={() =>
                  setOpenTeamCode((cur) =>
                    cur === team.team_code ? null : team.team_code
                  )
                }
                orders={data.team_orders[team.team_code] ?? []}
                disableExpansion={is2025}
              />
            ))}
          </div>
        )}
      </section>

      {/* Footer note */}
      <footer className="mt-6 text-[11px] text-neutral-500 leading-relaxed px-1">
        <strong className="text-neutral-700">Catatan:</strong> Komisi marketing
        dihitung 10% dari nilai gross invoice (sebelum potongan biaya Xendit).
        Hanya invoice yang sudah dibayar yang masuk hitungan.
        <br />
        <strong className="text-neutral-700">Saldo</strong> = Total komisi
        terkumpul (2025 + tahun berjalan) dikurangi yang sudah dibayarkan ke
        tim. Pembayaran dilakukan setelah saldo tim mencapai Rp 500.000.
        {is2025 && (
          <>
            <br />
            <span className="text-amber-700">
              <strong>2025</strong> menampilkan ringkasan bulanan saja (tidak
              ada rincian per pesanan untuk tahun tersebut).
            </span>
          </>
        )}
      </footer>
    </main>
  );
}

// ─── Components ─────────────────────────────────────────────────────────────

function Tile({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "success" | "warning";
}) {
  const valueClass =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
      ? "text-amber-700"
      : "text-neutral-900";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3.5 py-3">
      <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-base font-semibold mt-1 ${valueClass}`}>
        {value}
      </div>
      {sublabel && (
        <div className="text-[10px] text-neutral-400 mt-0.5">{sublabel}</div>
      )}
    </div>
  );
}

function TeamCard({
  team,
  year,
  isOpen,
  onToggle,
  orders,
  disableExpansion,
}: {
  team: MarketingTeamRollup;
  year: number;
  isOpen: boolean;
  onToggle: () => void;
  orders: MarketingOrderRow[];
  disableExpansion: boolean;
}) {
  const colors = TEAM_COLOR_CLASSES[team.team_code];
  const initials = teamInitials(team.display_name, team.team_code);
  const expandable = !disableExpansion;

  const handleHeadClick = () => {
    if (expandable) onToggle();
  };
  const handleHeadKey = (e: React.KeyboardEvent) => {
    if (!expandable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div
      className={`rounded-xl overflow-hidden border bg-white transition-shadow ${
        isOpen ? "border-neutral-300 shadow-sm" : "border-neutral-200"
      }`}
    >
      {/* Head */}
      <div
        role={expandable ? "button" : undefined}
        tabIndex={expandable ? 0 : undefined}
        aria-expanded={expandable ? isOpen : undefined}
        onClick={handleHeadClick}
        onKeyDown={handleHeadKey}
        className={`px-3 py-3 flex items-center gap-3 select-none ${
          expandable ? "cursor-pointer hover:bg-neutral-50" : "cursor-default"
        }`}
      >
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-9 h-9 rounded-full ${colors.bg} ${colors.text} border ${colors.border} flex items-center justify-center text-xs font-semibold`}
          aria-hidden="true"
        >
          {initials}
        </div>

        {/* Identity */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-neutral-900 truncate">
            {team.display_name}
          </div>
          <div className="text-[11px] text-neutral-500 mt-0.5 flex items-center gap-1.5">
            <span>Tim Marketing</span>
            <span className="text-neutral-300">·</span>
            <span className={colors.text}>{team.team_code}</span>
          </div>
        </div>

        {/* Year total */}
        <div className="flex-shrink-0 text-right">
          <div className="text-[10px] text-neutral-500">Total {year}</div>
          <div className="text-sm font-semibold text-neutral-900 mt-0.5">
            {formatRp(team.commission_total)}
          </div>
          {team.rows_count > 0 && (
            <div className="text-[10px] text-neutral-400 mt-0.5">
              {team.rows_count} pesanan
            </div>
          )}
        </div>

        {/* Chevron */}
        {expandable && (
          <div
            className={`flex-shrink-0 text-neutral-400 text-sm pl-1 transition-transform ${
              isOpen ? "rotate-90" : ""
            }`}
            aria-hidden="true"
          >
            ▸
          </div>
        )}
      </div>

      {/* Body */}
      {expandable && isOpen && (
        <div className="border-t border-neutral-200 bg-neutral-50">
          {/* Sub-summary strip: 3 stats side-by-side */}
          <div className="flex items-stretch px-3 py-3 bg-white border-b border-neutral-200">
            <SubStat
              label="Akumulasi 2025"
              value={formatRp(team.total_2025)}
            />
            <div className="w-px bg-neutral-200 mx-2" aria-hidden="true" />
            <SubStat
              label="Sudah Dibayar"
              value={formatRp(team.paid_out)}
              tone="success"
            />
            <div className="w-px bg-neutral-200 mx-2" aria-hidden="true" />
            <SubStat
              label="Saldo"
              value={formatRp(team.saldo_inc_2025)}
              tone="warning"
            />
          </div>

          {/* Orders list */}
          {orders.length === 0 ? (
            <div className="text-xs text-neutral-500 italic px-3 py-6 text-center">
              Belum ada pesanan untuk tahun {year}.
            </div>
          ) : (
            <OrdersList orders={orders} />
          )}
        </div>
      )}
    </div>
  );
}

function SubStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning";
}) {
  const valueClass =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
      ? "text-amber-700"
      : "text-neutral-900";
  return (
    <div className="flex-1 min-w-0 text-center">
      <div className="text-[9px] font-medium text-neutral-500 uppercase tracking-wider truncate">
        {label}
      </div>
      <div className={`text-xs font-semibold mt-1 truncate ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function OrdersList({ orders }: { orders: MarketingOrderRow[] }) {
  const grouped = groupOrdersByMonth(orders);
  return (
    <div className="divide-y divide-neutral-200">
      {grouped.map((g) => (
        <div key={g.monthKey}>
          <div className="px-3 py-1.5 bg-neutral-100 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wider">
              {g.monthLabel}
            </span>
            <span className="text-[10px] font-semibold text-neutral-700 text-right">
              {formatRp(g.totalCommission)}
              <span className="ml-1 text-neutral-400 font-normal">
                ({g.unpaidCount === 0
                  ? `${g.paidCount}`
                  : `${g.paidCount} lunas + ${g.unpaidCount} belum`})
              </span>
            </span>
          </div>
          <ul className="divide-y divide-neutral-200">
            {g.rows.map((r, i) => (
              <OrderRow key={`${r.order_id}-${r.earned_date}-${i}`} row={r} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function OrderRow({ row }: { row: MarketingOrderRow }) {
  const customerLabel = row.customer_name?.trim() || null;
  const placeLabel = [row.apartment, row.unit].filter(Boolean).join(" / ") || null;

  // Primary identifier strategy:
  //   1. BCA voucher when available (most informative)
  //   2. Invoice number if present
  //   3. order_id as fallback
  const primaryId = row.bca_voucher
    ? row.bca_voucher
    : row.invoice_number
    ? row.invoice_number
    : row.order_id;

  // Secondary muted label = order_id when distinct from primary
  const showSecondary = primaryId !== row.order_id;

  return (
    <li className="px-3 py-2.5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-mono font-semibold text-neutral-900 truncate">
            {primaryId}
          </div>
          {showSecondary && !row.is_synthetic_order_id && (
            <div className="text-[10px] font-mono text-neutral-400 truncate mt-0.5">
              {row.order_id}
            </div>
          )}
          {row.is_synthetic_order_id && (
            <div className="text-[10px] text-neutral-400 italic mt-0.5">
              Sebelum sistem invoice
            </div>
          )}
        </div>
        <StatusPill status={row.status} />
      </div>

      {(customerLabel || placeLabel) && (
        <div className="text-[11px] text-neutral-600 leading-snug">
          {customerLabel && (
            <span className="font-medium">{customerLabel}</span>
          )}
          {customerLabel && placeLabel && (
            <span className="text-neutral-400"> · </span>
          )}
          {placeLabel && <span>{placeLabel}</span>}
        </div>
      )}

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-neutral-500">
          {formatTanggalId(row.earned_date)}
        </span>
        <div className="text-right">
          {row.status === "unpaid" ? (
            <span className="text-xs font-semibold text-neutral-500">
              {formatRp(row.basis_amount)}
            </span>
          ) : (
            <>
              <span className="text-[10px] text-neutral-500">
                {formatRp(row.basis_amount)}
              </span>
              <span className="text-neutral-300 mx-1">→</span>
              <span className="text-xs font-semibold text-neutral-900">
                {formatRp(row.commission_amount)}
              </span>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function StatusPill({ status }: { status: "paid" | "unpaid" }) {
  if (status === "paid") {
    return (
      <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
        Lunas
      </span>
    );
  }
  return (
    <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
      Belum Bayar
    </span>
  );
}
