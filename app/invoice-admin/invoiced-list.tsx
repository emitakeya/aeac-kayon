// app/invoice-admin/invoiced-list.tsx
"use client";

import { useState } from "react";
import {
  type InvoiceRow,
  fmtRp,
  fmtJadwalInvoice,
  fmtPesananOleh,
  groupInvoicesByMonth,
  currentMonthKey,
} from "@/lib/invoices";
import MonthAccordion, { type MonthAccordionItem } from "./month-accordion";
import MarkPaidModal from "./mark-paid-modal";

export default function InvoicedList({
  invoices,
  onChange,
  readOnly = false,
}: {
  invoices: InvoiceRow[];
  onChange: () => void | Promise<void>;
  readOnly?: boolean;
}) {
  // Lifted to the list so only one modal exists at a time.
  const [markPaidFor, setMarkPaidFor] = useState<InvoiceRow | null>(null);

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

  const groups = groupInvoicesByMonth(invoices);

  // Default-open: the current Jakarta month if it appears, else newest.
  const cur = currentMonthKey();
  const defaultOpenKey =
    groups.find((g) => g.monthKey === cur)?.monthKey
    ?? groups[0]?.monthKey
    ?? null;

  const items: MonthAccordionItem[] = groups.map((g) => {
    const badges: MonthAccordionItem["badges"] = [];
    if (g.paidCount > 0) {
      badges.push({ label: `✓ ${g.paidCount}`, tone: "paid" });
    }
    if (g.unpaidCount > 0) {
      badges.push({ label: `⏳ ${g.unpaidCount}`, tone: "unpaid" });
    }
    return {
      monthKey: g.monthKey,
      count: g.invoices.length,
      badges,
      children: (
        <>
          {g.invoices.map((inv) => (
            <InvoicedCard
              key={inv.id}
              invoice={inv}
              readOnly={readOnly}
              onMarkPaid={() => setMarkPaidFor(inv)}
            />
          ))}
        </>
      ),
    };
  });

  return (
    <>
      <MonthAccordion items={items} defaultOpenKey={defaultOpenKey} />

      {markPaidFor ? (
        <MarkPaidModal
          invoice={markPaidFor}
          onClose={() => setMarkPaidFor(null)}
          onDone={onChange}
        />
      ) : null}
    </>
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
  readOnly = false,
  onMarkPaid,
}: {
  invoice: InvoiceRow;
  readOnly?: boolean;
  onMarkPaid: () => void;
}) {
  const [busy, setBusy] = useState<null | "resend">(null);
  const [open, setOpen] = useState(false);
  const isPaid = invoice.status === "paid";
  const detailId = `inv-detail-${invoice.id}`;

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
          {/* Session 40 — schedule + who ordered (staff MM), always visible */}
          <p className="text-xs text-neutral-600 mt-1.5 flex items-center gap-1.5 flex-wrap">
            <span>📅 {fmtJadwalInvoice(invoice.scheduled_date)}</span>
            <span className="text-neutral-300">|</span>
            <span>
              👤 Pesanan:{" "}
              <span className="font-semibold text-neutral-900">
                {fmtPesananOleh(invoice)}
              </span>
            </span>
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

      {/* Action row. For read-only users we keep the Xendit link (read) but
          drop the mark-paid / resend controls. If there's also no Xendit link,
          the whole row is skipped so we don't render an empty bordered strip. */}
      <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 flex-wrap">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls={detailId}
            className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold px-2.5 py-1.5 active:scale-[0.98] transition"
          >
            {open ? "▴ Tutup" : "▾ Detail"}
          </button>

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

          {!readOnly && !isPaid ? (
            <button
              type="button"
              onClick={onMarkPaid}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              ✓ Tandai Lunas
            </button>
          ) : null}

          {!readOnly ? (
            <button
              type="button"
              onClick={handleResend}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold px-2.5 py-1.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {busy === "resend" ? "Mengirim..." : "✉ Kirim Ulang"}
            </button>
          ) : null}
        </div>

      {open ? <InvoiceDetail id={detailId} invoice={invoice} /> : null}
    </article>
  );
}

// ──────────────────────────────────────────
// Session 40 — inline detail block (read-only)
function InvoiceDetail({ id, invoice }: { id: string; invoice: InvoiceRow }) {
  const items = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const techs = (invoice.technicians ?? []).filter(Boolean);

  return (
    <div
      id={id}
      className="mt-2.5 pt-2.5 border-t border-dashed border-neutral-300 text-xs"
    >
      {/* Line items */}
      <table className="w-full">
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td className="py-1 text-neutral-500" colSpan={2}>
                Tidak ada rincian item.
              </td>
            </tr>
          ) : (
            items.map((li, idx) => (
              <tr key={idx} className="border-b border-neutral-100">
                <td className="py-1 pr-2 text-neutral-800">
                  {li.name}
                  {li.qty > 1 ? (
                    <span className="text-neutral-500"> × {li.qty}</span>
                  ) : null}
                </td>
                <td className="py-1 text-right whitespace-nowrap text-neutral-800">
                  {fmtRp(li.amount)}
                </td>
              </tr>
            ))
          )}
          <tr>
            <td className="pt-1.5 text-right text-neutral-500">Subtotal</td>
            <td className="pt-1.5 text-right whitespace-nowrap">
              {fmtRp(invoice.subtotal)}
            </td>
          </tr>
          <tr>
            <td className="py-0.5 text-right text-neutral-500">Diskon</td>
            <td className="py-0.5 text-right whitespace-nowrap">
              {fmtRp(invoice.discount)}
            </td>
          </tr>
          <tr>
            <td className="py-0.5 text-right font-semibold text-neutral-900">Total</td>
            <td className="py-0.5 text-right whitespace-nowrap font-semibold text-neutral-900">
              {fmtRp(invoice.total_amount)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Facts */}
      <table className="w-full mt-2">
        <tbody>
          <tr>
            <td className="py-0.5 pr-2 align-top text-neutral-500 w-[110px]">Teknisi</td>
            <td className="py-0.5 align-top text-neutral-800">
              {techs.length ? techs.join(", ") : "—"}
            </td>
          </tr>
          <tr>
            <td className="py-0.5 pr-2 align-top text-neutral-500">Pesanan oleh</td>
            <td className="py-0.5 align-top text-neutral-800">
              {fmtPesananOleh(invoice)}
              {invoice.ordered_by_email ? (
                <span className="text-neutral-400"> ({invoice.ordered_by_email})</span>
              ) : null}
            </td>
          </tr>
          <tr>
            <td className="py-0.5 pr-2 align-top text-neutral-500">Catatan order</td>
            <td className="py-0.5 align-top whitespace-pre-line">
              {invoice.order_notes ? (
                <span className="text-neutral-800">{invoice.order_notes}</span>
              ) : (
                <span className="text-neutral-400">—</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
