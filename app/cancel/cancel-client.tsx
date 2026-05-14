"use client";

// app/cancel/cancel-client.tsx
// Cancel form client. Receives the pre-fetched list of cancellable orders
// and a possible pre-selected order_id (from ?order_id= query param).
//
// Flow:
//   1. User picks (or arrives with a pre-selected) order from the dropdown
//   2. Preview card shows order details
//   3. User optionally fills in a reason
//   4. Click "Konfirmasi Pembatalan" → POST /api/cancel
//   5. Success → success card (with "Batalkan Pesanan Lain" reset button)

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CancellableOrder, CancelApiResponse } from "@/lib/cancel";

type Props = {
  orders: CancellableOrder[];
  preselectOrderId: string | null;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success"; cancelledOrderId: string };

export default function CancelClient({ orders, preselectOrderId }: Props) {
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });

  // Build a lookup once
  const orderMap = useMemo(() => {
    const m = new Map<string, CancellableOrder>();
    for (const o of orders) m.set(o.order_id, o);
    return m;
  }, [orders]);

  // Pre-select from ?order_id= on mount, but only if it's actually in the
  // cancellable list. If not (already cancelled, completed, or out of window),
  // silently fall back to no selection.
  useEffect(() => {
    if (preselectOrderId && orderMap.has(preselectOrderId)) {
      setSelectedId(preselectOrderId);
    }
  }, [preselectOrderId, orderMap]);

  const selectedOrder = selectedId ? orderMap.get(selectedId) ?? null : null;

  function resetSelection() {
    setSelectedId("");
    setReason("");
    setSubmit({ kind: "idle" });
  }

  function startOver() {
    // After a successful cancellation, refresh the page so the dropdown
    // re-fetches and the cancelled order disappears from the list.
    router.refresh();
    resetSelection();
  }

  async function handleConfirm() {
    if (!selectedOrder) return;

    setSubmit({ kind: "submitting" });

    try {
      const res = await fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: selectedOrder.order_id,
          reason: reason.trim() || null,
        }),
      });

      const data = (await res.json()) as CancelApiResponse;

      if (!res.ok || !data.ok) {
        const message =
          data.ok === false ? data.error : `Gagal membatalkan (HTTP ${res.status})`;
        setSubmit({ kind: "error", message });
        return;
      }

      setSubmit({ kind: "success", cancelledOrderId: data.order_id });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error";
      setSubmit({ kind: "error", message });
    }
  }

  // ─────────────────────────────────────────────────────────
  // SUCCESS STATE
  // ─────────────────────────────────────────────────────────
  if (submit.kind === "success") {
    return (
      <div className="c-card">
        <div className="c-topbar"></div>
        <div className="c-success">
          <span className="c-success-icon">✅</span>
          <h3>Pesanan Dibatalkan</h3>
          <p>Notifikasi pembatalan telah dikirim ke customer dan teknisi.</p>
          <div className="c-order-badge">{submit.cancelledOrderId}</div>
          <br />
          <button
            type="button"
            className="c-btn c-btn-ghost"
            onClick={startOver}
            style={{ maxWidth: 240, margin: "0 auto" }}
          >
            Batalkan Pesanan Lain
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // EMPTY STATE (no cancellable orders at all)
  // ─────────────────────────────────────────────────────────
  if (orders.length === 0) {
    return (
      <div className="c-empty">
        😴 Tidak ada pesanan yang bisa dibatalkan saat ini.
        <br />
        <span style={{ fontSize: 12, color: "#9ca3af" }}>
          (Hanya pesanan <em>pending</em> atau <em>confirmed</em> dalam 7 hari terakhir + mendatang.)
        </span>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // MAIN FORM
  // ─────────────────────────────────────────────────────────
  const isSubmitting = submit.kind === "submitting";

  return (
    <div className="c-card">
      <div className="c-topbar"></div>
      <div className="c-header">
        <h3>Pilih Pesanan untuk Dibatalkan</h3>
        <p>
          Hanya pesanan dengan status <strong>Pending</strong> atau{" "}
          <strong>Konfirmasi</strong> yang muncul di daftar. Pembatalan akan
          mengirim email otomatis ke customer dan teknisi.
        </p>
      </div>

      <div className="c-body">
        <div className="c-field">
          <label className="c-label" htmlFor="c-order-select">
            Order ID <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <select
            id="c-order-select"
            className="c-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="" disabled>
              — Pilih Order ID —
            </option>
            {orders.map((o) => {
              const label = formatOrderOption(o);
              return (
                <option key={o.order_id} value={o.order_id}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        {selectedOrder && (
          <>
            <OrderPreview order={selectedOrder} />

            <div className="c-field" style={{ marginTop: 16 }}>
              <label className="c-label" htmlFor="c-reason">
                Alasan Pembatalan <span className="c-optional">(opsional)</span>
              </label>
              <textarea
                id="c-reason"
                className="c-textarea"
                placeholder="Contoh: Customer meminta reschedule, teknisi tidak tersedia, dll."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {submit.kind === "error" && (
              <div className="c-err">{submit.message}</div>
            )}

            <div className="c-btn-row">
              <button
                type="button"
                className="c-btn c-btn-ghost"
                onClick={resetSelection}
                disabled={isSubmitting}
              >
                ↺ Pilih Lain
              </button>
              <button
                type="button"
                className="c-btn c-btn-cancel"
                onClick={handleConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="c-spinner"></span>Membatalkan…
                  </>
                ) : (
                  <>🚫 Konfirmasi Pembatalan</>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

function formatOrderOption(o: CancellableOrder): string {
  const parts: string[] = [o.order_id];
  if (o.name_roma) parts.push(o.name_roma);
  const apt = [o.apartment, o.unit].filter(Boolean).join(" ");
  if (apt) parts.push(apt);
  const tail = o.scheduled_date ? `  [${o.scheduled_date}]` : "";
  return parts.join("  —  ") + tail;
}

function OrderPreview({ order }: { order: CancellableOrder }) {
  const tenant = order.name_roma || "—";
  const phone = order.mobile || "—";
  const email = order.email || "—";
  const apt = order.apartment || "—";
  const unit = order.unit || "—";
  const services = order.services ?? [];
  const status = order.status;

  return (
    <div className="c-preview">
      <div className="c-preview-row">
        <span className="c-preview-key">Order ID</span>
        <span className="c-preview-val">
          <span className="c-mono">{order.order_id}</span>
        </span>
      </div>
      <div className="c-preview-row">
        <span className="c-preview-key">Tanggal</span>
        <span className="c-preview-val">{order.scheduled_date || "—"}</span>
      </div>
      <div className="c-preview-row">
        <span className="c-preview-key">Nama Tenant</span>
        <span className="c-preview-val">{tenant}</span>
      </div>
      <div className="c-preview-row">
        <span className="c-preview-key">Nomor HP</span>
        <span className="c-preview-val">{phone}</span>
      </div>
      <div className="c-preview-row">
        <span className="c-preview-key">Email</span>
        <span className="c-preview-val">{email}</span>
      </div>
      <div className="c-preview-row">
        <span className="c-preview-key">Apartemen</span>
        <span className="c-preview-val">
          {apt} — Unit {unit}
        </span>
      </div>
      <div className="c-preview-row">
        <span className="c-preview-key">Layanan</span>
        <span className="c-preview-val">
          {services.length > 0 ? (
            <span className="c-services">
              {services.map((s, i) => (
                <div key={i}>{s}</div>
              ))}
            </span>
          ) : (
            "—"
          )}
        </span>
      </div>
      <div className="c-preview-row">
        <span className="c-preview-key">Status</span>
        <span className="c-preview-val">
          <span className="c-status">{status}</span>
        </span>
      </div>
    </div>
  );
}
