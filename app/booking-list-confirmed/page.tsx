// app/booking-list-confirmed/page.tsx
// Server Component. Calls public.get_bookings_confirmed() and renders the page.
// Access control happens inside the RPC (raises 42501 for users without can_view_mm).

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  type BookingRow,
  groupByDate,
  statusCounts,
  todayInJakarta,
} from "@/lib/bookings";
import DateAccordion from "./date-accordion";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();

  // Auth gate: redirect to login if no session
  const { data: me } = await supabase.from("v_current_user").select("*").single();
  if (!me) redirect("/login");
  if (!me.can_view_mm) redirect("/403");

  const { data, error } = await supabase.rpc("get_bookings_confirmed");

  if (error) {
    return (
      <main className="aw">
        <PageStyles />
        <div className="a-topnav">
          <div>
            <h2>Daftar booking confirmed</h2>
            <p>Gagal memuat data</p>
          </div>
        </div>
        <div className="a-err-msg">⚠️ Gagal memuat: {error.message}</div>
      </main>
    );
  }

  const bookings: BookingRow[] = (data ?? []) as BookingRow[];
  const counts = statusCounts(bookings);
  const groups = groupByDate(bookings);
  const today = todayInJakarta();

  // Indonesian-formatted "now" stamp for the subheader
  const nowSub = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return (
    <main className="aw">
      <PageStyles />

      <div className="a-topnav">
        <div>
          <h2>Daftar booking confirmed</h2>
          <p>{nowSub} WIB</p>
        </div>
      </div>

      <div className="a-summary">
        <span className="a-pill-stat">Total: {counts.total}</span>
        {counts.pending > 0 && (
          <span className="a-pill-stat pending">Pending: {counts.pending}</span>
        )}
        {counts.confirmed > 0 && (
          <span className="a-pill-stat confirmed">Confirmed: {counts.confirmed}</span>
        )}
        {counts.completed > 0 && (
          <span className="a-pill-stat completed">Selesai: {counts.completed}</span>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="a-empty">😴 Tidak ada pesanan ditemukan.</div>
      ) : (
        <DateAccordion groups={groups} today={today} />
      )}
    </main>
  );
}

// Inline styles for this page only — scoped via the .aw class on root.
// Mirrors the WP shortcode look (amber accent, today-highlight border).
function PageStyles() {
  return (
    <style>{`
      .aw {
        --accent:  #f59e0b;
        --accent2: #d97706;
        --dark:    #111827;
        --text:    #1f2937;
        --muted:   #6b7280;
        --border:  #e5e7eb;
        --bg:      #f3f4f6;
        --card:    #ffffff;
        font-family: 'Roboto', system-ui, -apple-system, sans-serif;
        color: var(--text);
        background: var(--bg);
        max-width: 520px;
        margin: 0 auto;
        padding: 16px 12px 80px;
        min-height: 100vh;
      }
      .aw * { box-sizing: border-box; }
      .aw .a-topnav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
      .aw .a-topnav h2 { margin: 0; font-size: 17px; font-weight: 600; color: var(--dark); }
      .aw .a-topnav p { margin: 2px 0 0; font-size: 11px; color: var(--muted); }

      .aw .a-summary { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
      .aw .a-pill-stat { padding: 5px 12px; border-radius: 999px; font-size: 11px; font-weight: 500; background: #fff; border: 1px solid var(--border); color: var(--text); }
      .aw .a-pill-stat.pending   { background: rgba(245,158,11,0.1);  border-color: rgba(245,158,11,0.3); color: #92400e; }
      .aw .a-pill-stat.confirmed { background: rgba(22,163,74,0.08);  border-color: rgba(22,163,74,0.3);  color: #14532d; }
      .aw .a-pill-stat.completed { background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.25);color: #1e3a5f; }

      .aw .a-empty { text-align: center; padding: 40px 16px; color: var(--muted); font-size: 14px; background: #fff; border-radius: 12px; border: 1px solid var(--border); }
      .aw .a-err-msg { padding: 14px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 10px; font-size: 13px; }

      .aw .a-date-acc { background: var(--card); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
      .aw .a-date-acc.today { border-color: var(--accent); border-width: 1.5px; box-shadow: 0 2px 12px rgba(245,158,11,0.12); }
      .aw .a-date-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; cursor: pointer; user-select: none; transition: background 0.15s; -webkit-tap-highlight-color: transparent; border: 0; width: 100%; background: transparent; font-family: inherit; }
      .aw .a-date-header:hover { background: rgba(0,0,0,0.015); }
      .aw .a-date-header:active { background: rgba(0,0,0,0.03); }
      .aw .a-date-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; text-align: left; }
      .aw .a-date-label { font-size: 14px; font-weight: 600; color: var(--dark); white-space: nowrap; }
      .aw .a-date-sub { font-size: 11px; color: var(--muted); font-weight: 400; }
      .aw .a-date-count { padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; background: rgba(17,24,39,0.06); color: var(--muted); flex-shrink: 0; }
      .aw .a-date-acc.today .a-date-count { background: rgba(245,158,11,0.15); color: #92400e; }
      .aw .a-date-chevron { font-size: 14px; color: var(--muted); transition: transform 0.25s ease; flex-shrink: 0; margin-left: 8px; display: inline-block; }
      .aw .a-date-acc.open .a-date-chevron { transform: rotate(180deg); }
      .aw .a-date-body { overflow: hidden; transition: max-height 0.3s ease; }
      .aw .a-date-body-inner { padding: 0 12px 12px; }

      .aw .a-bcard { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 8px; }
      .aw .a-bcard:last-child { margin-bottom: 0; }
      .aw .a-bcard.past { background: #f9fafb; border-color: #e5e7eb; opacity: 0.7; }

      .aw .a-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; gap: 8px; }
      .aw .a-order-id { font-family: monospace; font-size: 11px; background: rgba(17,24,39,0.06); padding: 3px 8px; border-radius: 6px; color: var(--dark); font-weight: 500; }

      .aw .a-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
      .aw .badge-pending   { background: rgba(245,158,11,0.12); color: #92400e; }
      .aw .badge-confirmed { background: rgba(22,163,74,0.1);   color: #14532d; }
      .aw .badge-completed { background: rgba(59,130,246,0.1);  color: #1e3a5f; }

      .aw .a-session-pill { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; margin-left: 6px; }
      .aw .session-am { background: #fef3c7; color: #92400e; }
      .aw .session-pm { background: #dbeafe; color: #1e3a5f; }

      .aw .a-card-name { font-size: 15px; font-weight: 600; color: var(--dark); margin-bottom: 2px; line-height: 1.3; }
      .aw .a-card-apt { font-size: 13px; color: var(--muted); margin-bottom: 10px; }
      .aw .a-card-apt strong { color: var(--text); font-weight: 500; }

      .aw .a-card-rows { display: flex; flex-direction: column; gap: 6px; padding-top: 10px; border-top: 1px solid var(--border); }
      .aw .a-card-section { font-size: 11px; color: var(--muted); font-weight: 600; letter-spacing: 0.04em; margin-top: 4px; }
      .aw .a-card-section:first-child { margin-top: 0; }
      .aw .a-card-row { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
      .aw .a-card-row-key { color: var(--muted); flex-shrink: 0; }
      .aw .a-card-row-val { text-align: right; word-break: break-word; }
      .aw .a-card-row-val a { color: #1e3a5f; text-decoration: none; }
      .aw .a-card-row-val a:hover { text-decoration: underline; }
      .aw .a-services-list { font-size: 12px; line-height: 1.6; }

      .aw .a-notes { margin-top: 10px; padding: 8px 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 12px; color: #78350f; line-height: 1.5; }
      .aw .a-notes-label { font-size: 10px; font-weight: 600; color: #92400e; letter-spacing: 0.04em; margin-bottom: 3px; }
    `}</style>
  );
}
