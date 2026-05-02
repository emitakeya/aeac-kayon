// app/invoice-admin/invoiced-list.tsx
"use client";

import { useState } from "react";
import { type InvoiceRow, fmtRp } from "@/lib/invoices";

export default function InvoicedList({
  invoices,
  onChange,
}: {
  invoices: InvoiceRow[];
  onChange: () => void | Promise<void>;
}) {
  if (invoices.length === 0) {
    return (
      <section className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
        <div className="text-3xl mb-2">📋</div>
        <h2 className="text-base font-semibold text-neutral-900">
          Belum ada invoice
        </h2>
        <p className="text-sm text-neutral-600 mt-1">
          Invoice yang dikirim akan muncul di sini.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2.5">
      {invoices.map((inv) => (
        <InvoicedCard key={inv.id} invoice={inv} onChange={onChange} />
      ))}
    </section>
  );
}

// ──────────────────────────────────────────
function StatusPill({ invoice }: { invoice: InvoiceRow }) {
  if (invoice.status === "paid") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
        ✓ Lunas
      </span>
    );
  }
  if (invoice.xendit_status === "EXPIRED") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600 border border-neutral-200">
        Kedaluwarsa
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
      ⏳ Menunggu Pembayaran
    </span>
  );
}

// ──────────────────────────────────────────
function InvoicedCard({
  invoice,
  onChange,
}: {
  invoice: InvoiceRow;
  onChange: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<null | "mark-paid" | "resend">(null);
  const isPaid = invoice.status === "paid";

  async function handleMarkPaid() {
    if (isPaid) return;
    const sure = confirm(
      `Tandai invoice ${invoice.invoice_number} sebagai LUNAS?\n\n` +
        `Total: ${fmtRp(invoice.total_amount)}\n` +
        `Customer: ${invoice.customer_name || "—"}\n\n` +
        `Aksi ini akan mencatat tanggal pembayaran hari ini dan ` +
        `(untuk order baru) menggenerate komisi teknisi & marketing.`
    );
    if (!sure) return;

    setBusy("mark-paid");
    try {
      const res = await fetch("/api/invoice-admin/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoice.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      let msg = `✓ Invoice ${invoice.invoice_number} ditandai LUNAS.`;
      if (json.data?.commission_eligible) {
        const cr = json.data.commission_result;
        if (cr?.success) {
          msg += `\n\nKomisi dibuat: ${cr.tech_commissions_created || 0} teknisi, ${
            cr.marketing_commissions_created || 0
          } marketing.`;
        }
      } else {
        msg += `\n\n(Order lama — komisi sudah masuk dalam backfill April 2026.)`;
      }
      alert(msg);
      await onChange();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Gagal menandai lunas: ${msg}`);
    } finally {
      setBusy(null);
    }
  }

  async function handleResend() {
    alert("(Coming next) Resend email invoice");
  }

  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <code className="text-[11px] font-mono bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded truncate">
              {invoice.invoice_number}
            </code>
            <StatusPill invoice={invoice} />
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 leading-tight truncate">
            {invoice.customer_name || "—"}
          </h3>
          <p className="text-xs text-neutral-600 mt-0.5 truncate">
            {[invoice.apartment, invoice.unit].filter(Boolean).join(" / ") || "—"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-neutral-900 leading-none">
            {fmtRp(invoice.total_amount)}
          </p>
          {invoice.paid_date ? (
            <p className="text-[11px] text-emerald-700 font-medium mt-1">
              {invoice.paid_date}
            </p>
          ) : null}
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 flex-wrap">
        {invoice.xendit_payment_url ? (
          <a
            href={invoice.xendit_payment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800 underline-offset-2 hover:underline"
          >
            🔗 Link Xendit
          </a>
        ) : null}

        <div className="flex-1" />

        {!isPaid ? (
          <button
            type="button"
            onClick={handleMarkPaid}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {busy === "mark-paid" ? "Memproses..." : "✓ Tandai Lunas"}
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleResend}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold px-2.5 py-1.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {busy === "resend" ? "Mengirim..." : "✉ Kirim Ulang"}
        </button>
      </div>
    </article>
  );
}
