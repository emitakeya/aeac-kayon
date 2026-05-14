"use client";

// app/booking-list-confirmed/date-accordion.tsx
// MERGED VERSION (May 2026) — incorporates mobile-version features.
// Only "today" starts open (past + future closed). Includes:
//   • Cancelled status badge + faded card background
//   • Date-tile icon (12 / SEL) in each accordion header
//   • Green "WA" pill next to phone numbers that link to WhatsApp
//
// May 14, 2026 update (Phase 2 of enhancement):
//   • Indonesian status badge labels (uses STATUS_LABEL_ID from lib/bookings)
//   • "✅ Sudah Bayar" pill rendered on card top when b.is_paid === true
//
// This component is now a pure renderer; filter state lives in
// BookingListClient (parent). It receives already-filtered+grouped data.

import { useState } from "react";
import {
  type BookingRow,
  type DayGroup,
  dayLabel,
  dateSubLabel,
  isPastDate,
  extractSession,
  waLink,
  STATUS_LABEL_ID,
} from "@/lib/bookings";

type Props = {
  groups: DayGroup[];
  today: string;
};

// Indonesian weekday abbreviations for the date tile
const DOW_SHORT = ["MIN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB"];

function getDateNumAndDow(dateKey: string): { num: string; dow: string } {
  const m = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return { num: "?", dow: "" };
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return {
    num: String(Number(m[3])),
    dow: DOW_SHORT[d.getUTCDay()],
  };
}

export default function DateAccordion({ groups, today }: Props) {
  // Store ONLY user-toggled overrides. The default "open/closed" state is
  // computed fresh on every render from (g.dateKey === today). This avoids
  // a class of bugs where useState's initial value would be a snapshot of
  // `groups` taken at first mount — if the parent re-renders with a different
  // groups array (e.g. after a filter change) we'd end up with stale or
  // missing keys in the openMap.
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const toggle = (dateKey: string, currentlyOpen: boolean) => {
    setOverrides((prev) => ({ ...prev, [dateKey]: !currentlyOpen }));
  };

  return (
    <>
      {groups.map((g) => {
        const isToday = g.dateKey === today;
        const isPast = isPastDate(g.dateKey, today);
        // Default: only today opens automatically. User toggles win.
        const defaultOpen = g.dateKey === today;
        const isOpen = overrides[g.dateKey] ?? defaultOpen;
        const { num, dow } = getDateNumAndDow(g.dateKey);

        return (
          <section
            key={g.dateKey}
            className={[
              "a-date-acc",
              isToday ? "today" : "",
              isPast ? "past" : "",
              isOpen ? "open" : "",
            ].filter(Boolean).join(" ")}
          >
            <button
              type="button"
              className="a-date-header"
              onClick={() => toggle(g.dateKey, isOpen)}
              aria-expanded={isOpen}
            >
              <div className="a-date-left">
                <div className="a-date-icon">
                  <div className="a-date-num">{num}</div>
                  <div className="a-date-dow">{dow}</div>
                </div>
                <div className="a-date-info">
                  <div className="a-date-label">{dayLabel(g.dateKey, today)}</div>
                  <div className="a-date-sub">{dateSubLabel(g.dateKey)}</div>
                </div>
              </div>
              <span className="a-date-count">{g.bookings.length}</span>
              <span className="a-date-chevron" aria-hidden="true">▼</span>
            </button>

            <div
              className="a-date-body"
              style={{ maxHeight: isOpen ? "10000px" : "0px" }}
            >
              <div className="a-date-body-inner">
                {g.bookings.map((b) => (
                  <BookingCard key={b.order_id} b={b} />
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}

// ──────────────────────────────────────────
// Single booking card
// ──────────────────────────────────────────
function BookingCard({ b }: { b: BookingRow }) {
  const session = extractSession(b.scheduled_date);
  const status = (b.status ?? "pending") as string;
  // Use Indonesian label when status is a recognized BookingStatus; otherwise
  // fall back to the raw string (defensive).
  const badgeLabel =
    (STATUS_LABEL_ID as Record<string, string>)[status] ?? status;

  const tenant = b.name_roma ?? "—";
  const apartment = b.apartment ?? "—";
  const unit = b.unit ?? "";
  const orderedBy = b.name_kanji ?? "";
  const obEmail = b.ordered_by_email ?? "";
  const phone = b.mobile ?? "";
  const email = b.email ?? "";
  const waitName = b.wait_name ?? "";
  const waitPhone = b.wait_phone ?? "";
  const notes = b.notes ?? "";
  const services = b.services ?? [];
  const isPaid = b.is_paid === true;

  const phoneWa = waLink(phone);
  const waitPhoneWa = waLink(waitPhone);

  const cardClass = status === "cancelled" ? "a-bcard cancelled" : "a-bcard";

  return (
    <div className={cardClass}>
      <div className="a-card-top">
        <div className="a-card-top-left">
          <span className="a-order-id">{b.order_id}</span>
          {isPaid && (
            <span className="a-paid-pill" aria-label="Sudah dibayar">
              ✅ Sudah Bayar
            </span>
          )}
        </div>
        <span className={`a-badge badge-${status}`}>{badgeLabel}</span>
      </div>

      <div className="a-card-name">
        {tenant}
        {session && (
          <span className={`a-session-pill ${session === "AM" ? "session-am" : "session-pm"}`}>
            {session}
          </span>
        )}
      </div>
      <div className="a-card-apt">
        <strong>{apartment}</strong>{unit ? ` · Unit ${unit}` : ""}
      </div>

      <div className="a-card-rows">
        <div className="a-card-section">📞 Kontak</div>
        <div className="a-card-row">
          <span className="a-card-row-key">HP / WA</span>
          <span className="a-card-row-val">
            {phone ? <span>{phone}</span> : <span>—</span>}
            {phoneWa && (
              <a className="a-wa-pill" href={phoneWa} target="_blank" rel="noopener noreferrer" aria-label="Buka WhatsApp">
                💬 WA
              </a>
            )}
          </span>
        </div>
        {email && (
          <div className="a-card-row">
            <span className="a-card-row-key">Email</span>
            <span className="a-card-row-val">
              <a href={`mailto:${email}`}>{email}</a>
            </span>
          </div>
        )}
        {orderedBy && (
          <div className="a-card-row">
            <span className="a-card-row-key">Dipesan oleh</span>
            <span className="a-card-row-val">{orderedBy}</span>
          </div>
        )}
        {obEmail && (
          <div className="a-card-row">
            <span className="a-card-row-key">Email pemesan</span>
            <span className="a-card-row-val">
              <a href={`mailto:${obEmail}`}>{obEmail}</a>
            </span>
          </div>
        )}

        {(waitName || waitPhone) && (
          <>
            <div className="a-card-section">🏠 Yang di Lokasi</div>
            {waitName && (
              <div className="a-card-row">
                <span className="a-card-row-key">Nama</span>
                <span className="a-card-row-val">{waitName}</span>
              </div>
            )}
            {waitPhone && (
              <div className="a-card-row">
                <span className="a-card-row-key">HP / WA</span>
                <span className="a-card-row-val">
                  <span>{waitPhone}</span>
                  {waitPhoneWa && (
                    <a className="a-wa-pill" href={waitPhoneWa} target="_blank" rel="noopener noreferrer" aria-label="Buka WhatsApp">
                      💬 WA
                    </a>
                  )}
                </span>
              </div>
            )}
          </>
        )}

        <div className="a-card-section">🛠️ Layanan</div>
        <div className="a-services-list">
          {services.length > 0
            ? services.map((s, i) => <div key={i}>{s}</div>)
            : "—"}
        </div>
      </div>

      {notes && (
        <div className="a-notes">
          <div className="a-notes-label">📝 Catatan</div>
          {notes}
        </div>
      )}
    </div>
  );
}
