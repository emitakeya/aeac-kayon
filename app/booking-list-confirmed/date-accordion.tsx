"use client";

// app/booking-list-confirmed/date-accordion.tsx
// Client Component. Renders the date-grouped accordion with expand/collapse.
// Past dates start collapsed, today + future start open (matches WP).

import { useState } from "react";
import {
  type BookingRow,
  type DayGroup,
  dayLabel,
  dateSubLabel,
  isPastDate,
  extractSession,
  waLink,
} from "@/lib/bookings";

type Props = {
  groups: DayGroup[];
  today: string;
};

export default function DateAccordion({ groups, today }: Props) {
  // Initial open-state: today + future open, past closed
  const initialOpen: Record<string, boolean> = {};
  for (const g of groups) {
    initialOpen[g.dateKey] = !isPastDate(g.dateKey, today);
  }
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(initialOpen);

  const toggle = (dateKey: string) => {
    setOpenMap((prev) => ({ ...prev, [dateKey]: !prev[dateKey] }));
  };

  return (
    <>
      {groups.map((g) => {
        const isToday = g.dateKey === today;
        const isPast = isPastDate(g.dateKey, today);
        const isOpen = openMap[g.dateKey] ?? !isPast;

        return (
          <section
            key={g.dateKey}
            className={[
              "a-date-acc",
              isToday ? "today" : "",
              isOpen ? "open" : "",
            ].filter(Boolean).join(" ")}
          >
            <button
              type="button"
              className="a-date-header"
              onClick={() => toggle(g.dateKey)}
              aria-expanded={isOpen}
            >
              <div className="a-date-left">
                <div>
                  <div className="a-date-label">{dayLabel(g.dateKey, today)}</div>
                  <div className="a-date-sub">{dateSubLabel(g.dateKey)}</div>
                </div>
              </div>
              <span className="a-date-count">{g.bookings.length} pesanan</span>
              <span className="a-date-chevron" aria-hidden="true">▼</span>
            </button>

            <div
              className="a-date-body"
              style={{ maxHeight: isOpen ? "10000px" : "0px" }}
            >
              <div className="a-date-body-inner">
                {g.bookings.map((b) => (
                  <BookingCard key={b.order_id} b={b} isPast={isPast} />
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
function BookingCard({ b, isPast }: { b: BookingRow; isPast: boolean }) {
  const session = extractSession(b.scheduled_date);
  const status = (b.status ?? "pending") as string;
  const badgeLabel =
    status === "pending"   ? "Pending"
  : status === "confirmed" ? "Confirmed"
  : status === "completed" ? "Selesai"
  : status;

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

  const phoneWa = waLink(phone);
  const waitPhoneWa = waLink(waitPhone);

  return (
    <div className={`a-bcard${isPast ? " past" : ""}`}>
      <div className="a-card-top">
        <span className="a-order-id">{b.order_id}</span>
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
            {phone ? (
              <span className="a-phone-block">
                <span className="a-phone-num">{phone}</span>
                {phoneWa && (
                  <a
                    className="a-wa-pill"
                    href={phoneWa}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Buka WhatsApp ${phone}`}
                  >
                    💬 WA
                  </a>
                )}
              </span>
            ) : "—"}
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
                  <span className="a-phone-block">
                    <span className="a-phone-num">{waitPhone}</span>
                    {waitPhoneWa && (
                      <a
                        className="a-wa-pill"
                        href={waitPhoneWa}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Buka WhatsApp ${waitPhone}`}
                      >
                        💬 WA
                      </a>
                    )}
                  </span>
                </span>
              </div>
            )}
          </>
        )}

        <div className="a-card-section">🛠️ Layanan</div>
        <div className="a-services-list">
          {services.length > 0
            ? services.map((s, i) => (
                <div key={i}>{s}</div>
              ))
            : "—"}
        </div>
      </div>

      {notes && (
        <div className="a-notes">
          <div className="a-notes-label">📝 CATATAN</div>
          {notes}
        </div>
      )}
    </div>
  );
}
