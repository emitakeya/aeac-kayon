// app/cancel/page.tsx
// Server Component for /cancel page.
// Fetches the list of cancellable orders via get_cancellable_orders() RPC
// and hands them off to CancelClient. Role-gated to admin OR finance.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/types";
import type { CancellableOrder } from "@/lib/cancel";
import CancelClient from "./cancel-client";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ order_id?: string }>;
};

export default async function CancelPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const preselectOrderId = (sp.order_id ?? "").trim();

  const supabase = await createClient();

  // Auth gate
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("v_current_user")
    .select("*")
    .maybeSingle<CurrentUser>();

  if (!me) redirect("/login");
  if (!(me.can_admin || me.can_view_finance)) redirect("/403");

  // Fetch cancellable orders
  const { data, error } = await supabase.rpc("get_cancellable_orders");

  return (
    <main className="cw">
      <PageStyles />

      <div className="c-topnav">
        <Link href="/dashboard" className="c-back-btn" aria-label="Kembali ke dashboard">
          ← Kembali
        </Link>
        <div className="c-topnav-title">
          <h2>Batalkan Pesanan</h2>
          <p>Hanya admin & finance</p>
        </div>
        <div className="c-topnav-spacer" aria-hidden="true" />
      </div>

      {error ? (
        <div className="c-err-msg">
          ⚠️ Gagal memuat pesanan: {error.message}
        </div>
      ) : (
        <CancelClient
          orders={(data ?? []) as CancellableOrder[]}
          preselectOrderId={preselectOrderId || null}
        />
      )}
    </main>
  );
}

// Inline styles — scoped via .cw class on root.
// Mirrors the WP cancel form's visual identity:
//   • Red topbar accent on the main card
//   • Amber preview card
//   • Red confirm button
function PageStyles() {
  return (
    <style>{`
      .cw {
        --accent:  #f59e0b;
        --accent2: #d97706;
        --dark:    #111827;
        --text:    #1f2937;
        --muted:   #6b7280;
        --border:  #e5e7eb;
        --bg:      #f3f4f6;
        --card:    #ffffff;
        --danger:  #dc2626;
        --danger2: #b91c1c;
        --success: #16a34a;
        font-family: 'Roboto', system-ui, -apple-system, sans-serif;
        color: var(--text);
        background: var(--bg);
        max-width: 520px;
        margin: 0 auto;
        padding: 16px 12px 80px;
        min-height: 100vh;
      }
      .cw * { box-sizing: border-box; }

      /* ── Top nav ── */
      .cw .c-topnav {
        display: grid;
        grid-template-columns: 84px 1fr 84px;
        align-items: center;
        margin-bottom: 14px;
        gap: 8px;
      }
      .cw .c-back-btn {
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
      .cw .c-back-btn:hover { border-color: var(--danger); color: var(--danger2); }
      .cw .c-back-btn:active { transform: scale(0.97); }
      .cw .c-topnav-title { text-align: center; min-width: 0; }
      .cw .c-topnav-title h2 { margin: 0; font-size: 17px; font-weight: 600; color: var(--dark); line-height: 1.2; }
      .cw .c-topnav-title p { margin: 2px 0 0; font-size: 11px; color: var(--muted); line-height: 1.3; }
      .cw .c-topnav-spacer { width: 84px; }

      /* ── Main card ── */
      .cw .c-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 14px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.06);
        overflow: hidden;
        margin-bottom: 16px;
      }
      .cw .c-topbar { height: 5px; background: linear-gradient(90deg, #dc2626, #b91c1c); }
      .cw .c-header { padding: 18px 20px 12px; border-bottom: 1px solid var(--border); }
      .cw .c-header h3 { margin: 0 0 4px; font-size: 16px; font-weight: 600; color: var(--dark); }
      .cw .c-header p { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.5; }
      .cw .c-body { padding: 18px 20px; }

      /* ── Form controls ── */
      .cw .c-label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: #4b5563;
        margin-bottom: 6px;
      }
      .cw .c-label .c-optional { color: var(--muted); font-weight: 400; }
      .cw .c-select, .cw .c-textarea {
        width: 100%;
        padding: 11px 13px;
        border: 1.5px solid var(--border);
        border-radius: 10px;
        font-size: 14px;
        font-family: inherit;
        background: #fff;
        color: var(--text);
        outline: none;
        transition: border-color 0.15s;
      }
      .cw .c-select { appearance: none; padding-right: 32px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%236b7280' d='M6 8L0 0h12z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
      }
      .cw .c-select:focus { border-color: var(--accent); }
      .cw .c-textarea { min-height: 80px; resize: vertical; }
      .cw .c-textarea:focus { border-color: var(--danger); }
      .cw .c-field { margin-bottom: 16px; }

      /* ── Order preview ── */
      .cw .c-preview {
        background: #fff7ed;
        border: 1.5px solid #fed7aa;
        border-radius: 12px;
        padding: 14px 16px;
        margin-top: 14px;
        font-size: 13px;
        line-height: 1.6;
      }
      .cw .c-preview-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 6px 0;
        border-bottom: 1px solid #fde68a;
        gap: 12px;
      }
      .cw .c-preview-row:last-child { border-bottom: none; }
      .cw .c-preview-key { font-size: 12px; color: var(--muted); min-width: 110px; flex-shrink: 0; }
      .cw .c-preview-val { font-size: 13px; font-weight: 500; text-align: right; flex: 1; word-break: break-word; }
      .cw .c-preview-val .c-mono { font-family: monospace; }
      .cw .c-preview-val .c-status { color: var(--accent2); font-weight: 600; }
      .cw .c-preview-val .c-services { display: block; text-align: right; }
      .cw .c-preview-val .c-services > div { margin-top: 2px; }
      .cw .c-preview-val .c-services > div:first-child { margin-top: 0; }

      /* ── Buttons ── */
      .cw .c-btn-row { display: flex; gap: 10px; margin-top: 18px; }
      .cw .c-btn {
        padding: 12px 16px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        font-family: inherit;
        transition: all 0.15s;
      }
      .cw .c-btn-cancel { background: var(--danger); color: #fff; flex: 1; }
      .cw .c-btn-cancel:hover { background: var(--danger2); }
      .cw .c-btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
      .cw .c-btn-ghost { background: transparent; border: 1.5px solid var(--border); color: var(--dark); }
      .cw .c-btn-ghost:hover { border-color: #9ca3af; }

      /* ── Alerts ── */
      .cw .c-err {
        background: rgba(220,38,38,0.07);
        border: 1px solid rgba(220,38,38,0.25);
        border-radius: 10px;
        padding: 12px 14px;
        font-size: 13px;
        line-height: 1.5;
        margin-top: 12px;
        color: #991b1b;
      }
      .cw .c-err-msg {
        padding: 14px;
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #991b1b;
        border-radius: 10px;
        font-size: 13px;
      }

      /* ── Spinner ── */
      .cw .c-spinner {
        display: inline-block;
        width: 14px; height: 14px;
        border: 2px solid rgba(255,255,255,0.4);
        border-top-color: #fff;
        border-radius: 50%;
        animation: cw-spin 0.7s linear infinite;
        vertical-align: middle;
        margin-right: 6px;
      }
      @keyframes cw-spin { to { transform: rotate(360deg); } }

      /* ── Empty list (no cancellable orders) ── */
      .cw .c-empty {
        text-align: center;
        padding: 32px 20px;
        color: var(--muted);
        font-size: 14px;
        background: #fff;
        border-radius: 12px;
        border: 1px solid var(--border);
      }

      /* ── Success state ── */
      .cw .c-success { text-align: center; padding: 32px 20px; }
      .cw .c-success-icon { font-size: 48px; margin-bottom: 12px; display: block; }
      .cw .c-success h3 { font-size: 20px; font-weight: 500; margin: 0 0 8px; color: var(--dark); }
      .cw .c-success p { color: var(--muted); font-size: 14px; line-height: 1.6; margin: 0 0 20px; }
      .cw .c-order-badge {
        display: inline-block;
        background: rgba(220,38,38,0.08);
        border: 1px solid rgba(220,38,38,0.2);
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 500;
        color: var(--danger);
        margin-bottom: 20px;
        font-family: monospace;
      }

      .cw .c-hidden { display: none !important; }
    `}</style>
  );
}
