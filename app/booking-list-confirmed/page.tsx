// app/booking-list-confirmed/page.tsx
// MERGED VERSION (May 2026) — combines the old /booking-list-mobile with the
// original /booking-list-confirmed into one page.
//
// Changes from the previous /booking-list-confirmed:
//   • Auth gate now accepts can_view_mm OR can_view_tech_pages
//     (was: can_view_mm only)
//   • Includes cancelled status (RPC change, plus new pill + badge styles)
//   • Date accordion: only "today" auto-opens (was: today + future)
//   • Added back-to-dashboard button at top-left
//   • Added date-tile icon (12 / SEL) on each accordion header
//   • Added Suspense loading skeleton
//   • Added green "WA" badge pills next to WhatsApp-capable phone numbers
//
// May 14, 2026 update (Phase 2 of enhancement):
//   • RPC now returns today + 14 days only (was: today - 3 onwards)
//   • RPC now returns is_paid boolean (joined from invoices.status='paid')
//   • Filter state (search + status checkboxes) moved into new
//     BookingListClient wrapper, which calls DateAccordion internally.
//     Server-side this file is now data-fetch only.
//
// URL kept as /booking-list-confirmed for bookmark compatibility — the name
// is slightly stale now ("confirmed" no longer accurate), but renaming the
// route would break any saved links. Dashboard label changed to "Daftar Booking".

import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  type BookingRow,
  todayInJakarta,
} from "@/lib/bookings";
import BookingListClient from "./booking-list-client";
import BookingListSkeleton from "./loading-skeleton";

export const dynamic = "force-dynamic";

export default function Page() {
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
        <Link href="/dashboard" className="a-back-btn" aria-label="Kembali ke dashboard">
          ← Kembali
        </Link>
        <div className="a-topnav-title">
          <h2>Daftar Booking</h2>
          <p>{nowSub} WIB</p>
        </div>
        <div className="a-topnav-spacer" aria-hidden="true" />
      </div>

      <Suspense fallback={<BookingListSkeleton />}>
        <BookingListContent />
      </Suspense>
    </main>
  );
}

// ──────────────────────────────────────────
// Async data-fetching content, wrapped in Suspense above.
// All filter / sort / grouping happens in BookingListClient (a Client Component).
// ──────────────────────────────────────────
async function BookingListContent() {
  const supabase = await createClient();

  // Auth gate: redirect to login if no session
  const { data: me } = await supabase.from("v_current_user").select("*").single();
  if (!me) redirect("/login");
  if (!me.can_view_mm && !me.can_view_tech_pages) redirect("/403");

  const { data, error } = await supabase.rpc("get_bookings_confirmed");

  if (error) {
    return <div className="a-err-msg">⚠️ Gagal memuat: {error.message}</div>;
  }

  const bookings: BookingRow[] = (data ?? []) as BookingRow[];
  const today = todayInJakarta();

  return <BookingListClient bookings={bookings} today={today} />;
}

// Inline styles for this page only — scoped via the .aw class on root.
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
        --danger:  #dc2626;
        --wa:      #16a34a;
        font-family: 'Roboto', system-ui, -apple-system, sans-serif;
        color: var(--text);
        background: var(--bg);
        max-width: 520px;
        margin: 0 auto;
        padding: 16px 12px 80px;
        min-height: 100vh;
      }
      .aw * { box-sizing: border-box; }

      /* ── Top nav with back button ── */
      .aw .a-topnav {
        display: grid;
        grid-template-columns: 84px 1fr 84px;
        align-items: center;
        margin-bottom: 14px;
        gap: 8px;
      }
      .aw .a-back-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 500;
        background: #fff;
        border: 1px solid var(--border);
        color: var(--muted);
        text-decoration: none;
        white-space: nowrap;
        justify-self: start;
        transition: all 0.15s;
      }
      .aw .a-back-btn:hover { border-color: var(--accent); color: var(--accent2); }
      .aw .a-back-btn:active { transform: scale(0.97); }
      .aw .a-topnav-title { text-align: center; min-width: 0; }
      .aw .a-topnav-title h2 { margin: 0; font-size: 17px; font-weight: 600; color: var(--dark); line-height: 1.2; }
      .aw .a-topnav-title p { margin: 2px 0 0; font-size: 11px; color: var(--muted); line-height: 1.3; }
      .aw .a-topnav-spacer { width: 84px; }

      /* ── Summary pills ── */
      .aw .a-summary { display: flex; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; }
      .aw .a-pill-stat { padding: 5px 12px; border-radius: 999px; font-size: 11px; font-weight: 500; background: #fff; border: 1px solid var(--border); color: var(--text); }
      .aw .a-pill-stat.pending   { background: rgba(245,158,11,0.1);  border-color: rgba(245,158,11,0.3); color: #92400e; }
      .aw .a-pill-stat.confirmed { background: rgba(22,163,74,0.08);  border-color: rgba(22,163,74,0.3);  color: #14532d; }
      .aw .a-pill-stat.completed { background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.25);color: #1e3a5f; }
      .aw .a-pill-stat.cancelled { background: rgba(220,38,38,0.08);  border-color: rgba(220,38,38,0.25); color: #991b1b; }

      /* ── Sticky filter bar (NEW May 14, 2026) ── */
      .aw .a-filter-bar {
        position: sticky;
        top: 0;
        z-index: 10;
        background: var(--bg);
        padding: 8px 0 10px;
        margin: -2px 0 12px;
        border-bottom: 1px solid var(--border);
      }
      .aw .a-search-wrap {
        position: relative;
        margin-bottom: 8px;
      }
      .aw .a-search-input {
        width: 100%;
        padding: 9px 12px 9px 32px;
        font-size: 13px;
        font-family: inherit;
        background: #fff;
        border: 1px solid var(--border);
        border-radius: 10px;
        color: var(--text);
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .aw .a-search-input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgba(245,158,11,0.12);
      }
      .aw .a-search-icon {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 13px;
        color: var(--muted);
        pointer-events: none;
      }
      .aw .a-search-clear {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        width: 22px;
        height: 22px;
        border: 0;
        background: rgba(0,0,0,0.06);
        color: var(--muted);
        border-radius: 50%;
        font-size: 14px;
        line-height: 1;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        font-family: inherit;
      }
      .aw .a-search-clear:hover { background: rgba(0,0,0,0.12); color: var(--text); }
      .aw .a-status-checks {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .aw .a-check-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 5px 10px 5px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 500;
        background: #fff;
        border: 1px solid var(--border);
        color: var(--muted);
        cursor: pointer;
        user-select: none;
        transition: all 0.12s;
        -webkit-tap-highlight-color: transparent;
      }
      .aw .a-check-pill input { margin: 0; cursor: pointer; accent-color: var(--accent2); }
      .aw .a-check-pill.checked.pending   { background: rgba(245,158,11,0.12); border-color: rgba(245,158,11,0.35); color: #92400e; }
      .aw .a-check-pill.checked.confirmed { background: rgba(22,163,74,0.1);   border-color: rgba(22,163,74,0.35);  color: #14532d; }
      .aw .a-check-pill.checked.completed { background: rgba(59,130,246,0.1);  border-color: rgba(59,130,246,0.35); color: #1e3a5f; }
      .aw .a-check-pill.checked.cancelled { background: rgba(220,38,38,0.1);   border-color: rgba(220,38,38,0.35);  color: #991b1b; }

      /* ── States ── */
      .aw .a-empty { text-align: center; padding: 40px 16px; color: var(--muted); font-size: 14px; background: #fff; border-radius: 12px; border: 1px solid var(--border); }
      .aw .a-err-msg { padding: 14px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 10px; font-size: 13px; }

      /* ── Date accordion ── */
      .aw .a-date-acc { background: var(--card); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
      .aw .a-date-acc.today { border-color: var(--accent); border-width: 1.5px; box-shadow: 0 2px 12px rgba(245,158,11,0.12); }
      .aw .a-date-acc.past { opacity: 0.75; }
      .aw .a-date-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; cursor: pointer; user-select: none; transition: background 0.15s; -webkit-tap-highlight-color: transparent; border: 0; width: 100%; background: transparent; font-family: inherit; }
      .aw .a-date-header:hover { background: rgba(0,0,0,0.015); }
      .aw .a-date-header:active { background: rgba(0,0,0,0.03); }
      .aw .a-date-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; text-align: left; }
      .aw .a-date-icon { width: 40px; height: 40px; border-radius: 10px; background: var(--bg); display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; line-height: 1; }
      .aw .a-date-acc.today .a-date-icon { background: var(--accent2); }
      .aw .a-date-num { font-size: 15px; font-weight: 700; color: var(--dark); }
      .aw .a-date-acc.today .a-date-num { color: #fff; }
      .aw .a-date-dow { font-size: 8px; font-weight: 700; text-transform: uppercase; color: var(--muted); letter-spacing: 0.5px; margin-top: 1px; }
      .aw .a-date-acc.today .a-date-dow { color: rgba(255,255,255,0.85); }
      .aw .a-date-info { flex: 1; min-width: 0; }
      .aw .a-date-label { font-size: 14px; font-weight: 600; color: var(--dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aw .a-date-sub { font-size: 11px; color: var(--muted); font-weight: 400; }
      .aw .a-date-count { padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; background: rgba(17,24,39,0.06); color: var(--muted); flex-shrink: 0; }
      .aw .a-date-acc.today .a-date-count { background: rgba(245,158,11,0.15); color: #92400e; }
      .aw .a-date-chevron { font-size: 13px; color: var(--muted); transition: transform 0.25s ease; flex-shrink: 0; margin-left: 8px; display: inline-block; }
      .aw .a-date-acc.open .a-date-chevron { transform: rotate(180deg); }
      .aw .a-date-body { overflow: hidden; transition: max-height 0.3s ease; }
      .aw .a-date-body-inner { padding: 0 12px 12px; }

      /* ── Booking card ── */
      .aw .a-bcard { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 8px; }
      .aw .a-bcard:last-child { margin-bottom: 0; }
      .aw .a-bcard.cancelled { background: #fef2f2; border-color: #fecaca; }

      .aw .a-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; gap: 6px; flex-wrap: wrap; }
      .aw .a-card-top-left { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .aw .a-order-id { font-family: monospace; font-size: 11px; background: rgba(17,24,39,0.06); padding: 3px 8px; border-radius: 6px; color: var(--dark); font-weight: 500; }

      .aw .a-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
      .aw .badge-pending   { background: rgba(245,158,11,0.12); color: #92400e; }
      .aw .badge-confirmed { background: rgba(22,163,74,0.1);   color: #14532d; }
      .aw .badge-completed { background: rgba(59,130,246,0.1);  color: #1e3a5f; }
      .aw .badge-cancelled { background: rgba(220,38,38,0.1);   color: #991b1b; }

      /* ── Paid pill (NEW May 14, 2026) ── */
      .aw .a-paid-pill {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        padding: 3px 9px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 700;
        background: rgba(22,163,74,0.12);
        color: #14532d;
        letter-spacing: 0.3px;
        white-space: nowrap;
        flex-shrink: 0;
      }

      .aw .a-session-pill { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; margin-left: 6px; }
      .aw .session-am { background: #fef3c7; color: #92400e; }
      .aw .session-pm { background: #dbeafe; color: #1e3a5f; }

      .aw .a-card-name { font-size: 15px; font-weight: 600; color: var(--dark); margin-bottom: 2px; line-height: 1.3; }
      .aw .a-card-apt { font-size: 13px; color: var(--muted); margin-bottom: 10px; }
      .aw .a-card-apt strong { color: var(--text); font-weight: 500; }

      .aw .a-card-rows { display: flex; flex-direction: column; gap: 6px; padding-top: 10px; border-top: 1px solid var(--border); }
      .aw .a-card-section { font-size: 11px; color: var(--muted); font-weight: 600; letter-spacing: 0.04em; margin-top: 4px; text-transform: uppercase; }
      .aw .a-card-section:first-child { margin-top: 0; }
      .aw .a-card-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 12px; }
      .aw .a-card-row-key { color: var(--muted); flex-shrink: 0; }
      .aw .a-card-row-val { text-align: right; word-break: break-word; display: inline-flex; align-items: center; gap: 6px; justify-content: flex-end; }
      .aw .a-card-row-val a { color: #1e3a5f; text-decoration: none; }
      .aw .a-card-row-val a:hover { text-decoration: underline; }
      .aw .a-services-list { font-size: 12px; line-height: 1.6; text-align: left; }

      /* ── WhatsApp pill ── */
      .aw .a-wa-pill { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; background: rgba(22,163,74,0.12); color: #14532d; text-decoration: none; letter-spacing: 0.5px; }
      .aw .a-wa-pill:hover { background: rgba(22,163,74,0.2); text-decoration: none; }

      .aw .a-notes { margin-top: 10px; padding: 8px 10px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; font-size: 12px; color: #78350f; line-height: 1.5; }
      .aw .a-notes-label { font-size: 10px; font-weight: 600; color: #92400e; letter-spacing: 0.04em; margin-bottom: 3px; text-transform: uppercase; }

      /* ── Skeleton loader ── */
      .aw .a-skel-pill { display: inline-block; width: 80px; height: 22px; border-radius: 999px; background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%); background-size: 200% 100%; animation: aw-shimmer 1.4s ease-in-out infinite; margin-right: 6px; }
      .aw .a-skel-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-bottom: 8px; height: 120px; background: linear-gradient(90deg, #f3f4f6 25%, #ffffff 50%, #f3f4f6 75%); background-size: 200% 100%; animation: aw-shimmer 1.4s ease-in-out infinite; }
      @keyframes aw-shimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  );
}
