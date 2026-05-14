"use client";

// app/booking-list-confirmed/booking-list-client.tsx
// NEW (May 14, 2026) — Wrapper Client Component that owns filter state.
//
// Renders:
//   1. Summary pills (using FILTERED counts so they react to the filter UI)
//   2. Sticky filter bar — search input + 4 status checkboxes
//   3. Empty state OR DateAccordion (with filtered+grouped data)
//
// Filter state is in-memory (no URL params yet). Both filters apply together:
//   • Status: bookings whose status is in the checked set
//   • Search: case-insensitive match against name_roma / name_kanji /
//             apartment / unit / order_id
//
// May 14, 2026 update (Cancel integration):
//   • Accepts canCancel prop and threads it down to DateAccordion so that
//     admin/finance users see a "Batalkan" link inside each cancellable card.

import { useMemo, useState } from "react";
import {
  type BookingRow,
  type BookingStatus,
  filterBookings,
  groupByDate,
  statusCounts,
  STATUS_LABEL_ID,
} from "@/lib/bookings";
import DateAccordion from "./date-accordion";

const ALL_STATUSES: BookingStatus[] = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
];

type Props = {
  bookings: BookingRow[];
  today: string;
  /** When true, render a "Batalkan" link on cancellable cards. */
  canCancel?: boolean;
};

export default function BookingListClient({
  bookings,
  today,
  canCancel = false,
}: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<BookingStatus>>(
    () => new Set(ALL_STATUSES)
  );

  // Filtered list — recomputed only when inputs change
  const filtered = useMemo(
    () => filterBookings(bookings, searchTerm, statusFilter),
    [bookings, searchTerm, statusFilter]
  );

  // Counts for summary pills are based on the FILTERED list — so the user
  // sees their query reflected in the totals.
  const counts = useMemo(() => statusCounts(filtered), [filtered]);
  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  // Total of UNFILTERED bookings (for "no results" message context)
  const totalUnfiltered = bookings.length;
  const isFiltering =
    searchTerm.trim().length > 0 || statusFilter.size < ALL_STATUSES.length;

  function toggleStatus(s: BookingStatus) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  function clearSearch() {
    setSearchTerm("");
  }

  function resetFilters() {
    setSearchTerm("");
    setStatusFilter(new Set(ALL_STATUSES));
  }

  return (
    <>
      {/* Summary pills (filtered counts) */}
      <div className="a-summary">
        <span className="a-pill-stat">Total: {counts.total}</span>
        {counts.pending > 0 && (
          <span className="a-pill-stat pending">Pending: {counts.pending}</span>
        )}
        {counts.confirmed > 0 && (
          <span className="a-pill-stat confirmed">Konfirmasi: {counts.confirmed}</span>
        )}
        {counts.completed > 0 && (
          <span className="a-pill-stat completed">Selesai: {counts.completed}</span>
        )}
        {counts.cancelled > 0 && (
          <span className="a-pill-stat cancelled">Batal: {counts.cancelled}</span>
        )}
      </div>

      {/* Sticky filter bar */}
      <div className="a-filter-bar">
        <div className="a-search-wrap">
          <span className="a-search-icon" aria-hidden="true">🔍</span>
          <input
            type="text"
            inputMode="search"
            className="a-search-input"
            placeholder="Cari nama, apartemen, unit, atau order ID…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Cari booking"
          />
          {searchTerm.length > 0 && (
            <button
              type="button"
              className="a-search-clear"
              onClick={clearSearch}
              aria-label="Hapus pencarian"
            >
              ×
            </button>
          )}
        </div>

        <div className="a-status-checks" role="group" aria-label="Filter status">
          {ALL_STATUSES.map((s) => {
            const checked = statusFilter.has(s);
            return (
              <label
                key={s}
                className={`a-check-pill ${s} ${checked ? "checked" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStatus(s)}
                />
                {STATUS_LABEL_ID[s]}
              </label>
            );
          })}
        </div>
      </div>

      {/* Body: empty state OR accordion */}
      {groups.length === 0 ? (
        <div className="a-empty">
          {totalUnfiltered === 0 ? (
            <>😴 Tidak ada booking dalam 14 hari ke depan.</>
          ) : isFiltering ? (
            <>
              🔍 Tidak ada booking yang cocok dengan filter.
              <br />
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  marginTop: 12,
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  color: "#6b7280",
                }}
              >
                Hapus filter
              </button>
            </>
          ) : (
            <>😴 Tidak ada booking dalam 14 hari ke depan.</>
          )}
        </div>
      ) : (
        <DateAccordion groups={groups} today={today} canCancel={canCancel} />
      )}
    </>
  );
}
