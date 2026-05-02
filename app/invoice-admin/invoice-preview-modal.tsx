// app/invoice-admin/invoice-preview-modal.tsx
"use client";

import { useState } from "react";
import {
  type LineItem,
  type OrderForInvoicing,
  type TechnicianRow,
  fmtRp,
  toProper,
  combineCustomerEmails,
} from "@/lib/invoices";

// ── Constants ported from WP (kept in sync with the WP page) ─────────────
const BANK = {
  name: "BCA (KCU Kebayoran Baru)",
  account: "0700435393",
  holder: "Hafiz Fauzan",
};
const RECEIPT_WA = "+62 856-8310-419";
const CC_EMAIL = "servisacapartemen@gmail.com";

const XENDIT_ENABLED = true;
const XENDIT_MIN_AMOUNT = 10000;

// ──────────────────────────────────────────
export default function InvoicePreviewModal({
  invoiceNumber,
  order,
  report,
  technicians,
  items,
  subtotal,
  discount,
  total,
  onClose,
  onSent,
}: {
  invoiceNumber: string;
  order: OrderForInvoicing["order"];
  report: OrderForInvoicing["report"];
  technicians: TechnicianRow[];
  items: LineItem[];
  subtotal: number;
  discount: number;
  total: number;
  onClose: () => void;
  onSent: () => void | Promise<void>;
}) {
  const c = order.customer;
  const customerName = toProper(c.name_roma) || c.name_kanji || "—";
  const customerEmail = combineCustomerEmails(c);
  const reportTechs: string[] = (report?.technicians as string[] | null) ?? [];

  const bccTechEmails = reportTechs
    .map((name) => technicians.find((t) => t.name === name)?.email ?? null)
    .filter((e): e is string => !!e && e.trim().length > 0);

  const [step, setStep] = useState<
    "preview" | "creating-xendit" | "saving" | "sending-email" | "done" | "error"
  >("preview");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultPaymentUrl, setResultPaymentUrl] = useState<string | null>(null);

  const busy =
    step === "creating-xendit" || step === "saving" || step === "sending-email";

  // ──────────────────────────────────────────
  async function confirmSend() {
    setErrorMsg(null);

    // ── 1. Create Xendit invoice (if eligible) ────────────────
    let xenditInvoiceId: string | null = null;
    let xenditPaymentUrl: string | null = null;
    let xenditStatus: string | null = null;
    let paymentMethod = "bank_transfer";

    if (XENDIT_ENABLED && total >= XENDIT_MIN_AMOUNT && customerEmail) {
      setStep("creating-xendit");
      try {
        const res = await fetch("/api/xendit/create-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.order_id,
            invoiceNumber,
            amount: total,
            email: customerEmail.split(",")[0]?.trim(),
            customerName,
            description: `AEAC Invoice ${invoiceNumber}`,
            items: items.map((i) => ({
              name: i.name,
              qty: i.qty,
              price: i.price,
            })),
          }),
        });
        const json = await res.json();
        if (res.ok && json.ok && json.data?.invoice_url) {
          xenditInvoiceId = json.data.xendit_id ?? null;
          xenditPaymentUrl = json.data.invoice_url;
          xenditStatus = "PENDING";
          paymentMethod = "xendit";
        } else {
          // Don't block the whole flow — fall back to bank transfer
          console.warn("Xendit creation failed, falling back to bank transfer:", json);
        }
      } catch (e) {
        console.warn("Xendit fetch failed, falling back:", e);
      }
    }

    // ── 2. Save invoice to Supabase ───────────────────────────
    setStep("saving");
    let invoiceId: number | null = null;
    try {
      const payload = {
        invoice_number: invoiceNumber,
        order_id: order.order_id,
        customer_name: customerName,
        ordered_by_name: c.name_kanji ?? "",
        customer_email: customerEmail,
        apartment: c.apartment ?? "",
        unit: c.unit ?? "",
        scheduled_date: order.scheduled_date ?? "",
        technicians: reportTechs,
        line_items: items,
        subtotal,
        discount,
        total_amount: total,
        status: "pending_payment",
        payment_method: paymentMethod,
        xendit_invoice_id: xenditInvoiceId,
        xendit_payment_url: xenditPaymentUrl,
        xendit_status: xenditStatus,
      };

      const res = await fetch("/api/invoice-admin/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      invoiceId = json.data?.invoice_id ?? null;
      if (json.data?.duplicate) {
        // Not fatal — surface it but proceed
        console.warn("create_invoice returned duplicate:", json.data);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStep("error");
      setErrorMsg(`Gagal menyimpan invoice: ${msg}`);
      return;
    }

    // ── 3. Send email via GAS proxy (non-blocking on error) ───
    setStep("sending-email");
    try {
      const emailPayload = {
        endpoint: "invoice",
        invoiceNumber,
        orderId: order.order_id,
        customerName,
        customerEmail, // comma-separated: customer + ordered_by
        apartment: c.apartment ?? "",
        unit: c.unit ?? "",
        scheduledDate: order.scheduled_date ?? "",
        technicians: reportTechs.join(", "),
        jamMulai: (report?.jam_mulai as string) ?? "",
        jamSelesai: (report?.jam_selesai as string) ?? "",
        subtotal,
        discount,
        total,
        cc: CC_EMAIL,
        bcc: bccTechEmails.join(","),
        bankName: BANK.name,
        bankAccount: BANK.account,
        bankHolder: BANK.holder,
        receiptWa: RECEIPT_WA,
        lineItems: items,
        xenditPaymentUrl: xenditPaymentUrl ?? "",
      };
      const res = await fetch("/api/email/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      });
      // Email failure is non-fatal — invoice was saved, finance can resend later.
      if (!res.ok) {
        console.warn("Email send returned non-OK:", res.status);
      }
    } catch (e) {
      console.warn("Email send failed (non-fatal):", e);
    }

    // ── 4. Done ───────────────────────────────────────────────
    setResultPaymentUrl(xenditPaymentUrl);
    setStep("done");

    // Let the parent refresh the list and close the editor
    await onSent();
  }

  // ──────────────────────────────────────────
  const stepLabels: Record<string, string> = {
    "creating-xendit": "Membuat link pembayaran...",
    saving: "Menyimpan invoice...",
    "sending-email": "Mengirim email...",
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
          <h3 className="text-base font-semibold text-neutral-900">
            {step === "done" ? "✓ Terkirim" : "Preview Invoice"}
          </h3>
          <button
            type="button"
            onClick={busy ? undefined : onClose}
            disabled={busy}
            aria-label="Tutup"
            className="text-neutral-400 hover:text-neutral-700 disabled:opacity-30 text-xl leading-none w-7 h-7 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {step === "done" ? (
            <SuccessView
              invoiceNumber={invoiceNumber}
              total={total}
              paymentUrl={resultPaymentUrl}
            />
          ) : step === "error" ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              ⚠ {errorMsg}
            </div>
          ) : (
            <PreviewBody
              invoiceNumber={invoiceNumber}
              customerName={customerName}
              customerEmail={customerEmail}
              order={order}
              reportTechs={reportTechs}
              bccTechEmails={bccTechEmails}
              items={items}
              subtotal={subtotal}
              discount={discount}
              total={total}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-neutral-200">
          {step === "done" ? (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 inline-flex items-center justify-center rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2.5 transition"
            >
              Selesai
            </button>
          ) : step === "error" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-sm font-semibold px-4 py-2.5 transition"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("preview");
                  setErrorMsg(null);
                }}
                className="flex-1 inline-flex items-center justify-center rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2.5 transition"
              >
                Coba Lagi
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 disabled:opacity-50 text-neutral-700 text-sm font-semibold px-4 py-2.5 transition"
              >
                Kembali & Edit
              </button>
              <button
                type="button"
                onClick={confirmSend}
                disabled={busy || items.length === 0 || total <= 0}
                className="flex-[2] inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 active:scale-[0.98] transition"
              >
                {busy ? (
                  <>
                    <span className="inline-block animate-spin">⟳</span>
                    <span>{stepLabels[step] ?? "Memproses..."}</span>
                  </>
                ) : (
                  <span>✓ Kirim Invoice Sekarang</span>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
function PreviewBody({
  invoiceNumber,
  customerName,
  customerEmail,
  order,
  reportTechs,
  bccTechEmails,
  items,
  subtotal,
  discount,
  total,
}: {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  order: OrderForInvoicing["order"];
  reportTechs: string[];
  bccTechEmails: string[];
  items: LineItem[];
  subtotal: number;
  discount: number;
  total: number;
}) {
  const c = order.customer;

  return (
    <div className="space-y-4 text-sm">
      {/* Email destination notice */}
      {customerEmail ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          📧 Akan dikirim ke: <strong>{customerEmail}</strong>
          <br />
          <span className="opacity-80">
            CC: {CC_EMAIL}
            {bccTechEmails.length > 0
              ? ` · BCC: ${bccTechEmails.join(", ")}`
              : ""}
          </span>
        </div>
      ) : (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          ⚠ Email customer kosong. Invoice akan tetap disimpan dan dikirim ke CC ({CC_EMAIL}).
        </div>
      )}

      {/* Header */}
      <div className="border-b border-neutral-200 pb-3">
        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
          Invoice
        </p>
        <p className="text-base font-semibold text-neutral-900">
          {invoiceNumber}
        </p>
      </div>

      {/* Customer */}
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
          Untuk
        </p>
        <p className="font-semibold text-neutral-900">{customerName}</p>
        {c.name_kanji ? (
          <p className="text-xs text-neutral-600">{c.name_kanji}</p>
        ) : null}
        <p className="text-xs text-neutral-600">
          {[c.apartment, c.unit].filter(Boolean).join(" / ") || "—"}
        </p>
        {order.scheduled_date ? (
          <p className="text-xs text-neutral-500">📅 {order.scheduled_date}</p>
        ) : null}
        {reportTechs.length > 0 ? (
          <p className="text-xs text-neutral-500">
            👷 {reportTechs.join(", ")}
          </p>
        ) : null}
      </div>

      {/* Line items */}
      <div>
        <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Rincian
        </p>
        <ul className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg overflow-hidden">
          {items.map((it, i) => (
            <li key={i} className="px-3 py-2 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-900">{it.name}</p>
                <p className="text-[11px] text-neutral-500">
                  {it.qty} × {fmtRp(it.price)}
                </p>
              </div>
              <p className="text-sm font-semibold text-neutral-900 shrink-0">
                {fmtRp(it.amount)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Totals */}
      <div className="space-y-1.5 pt-2 border-t border-neutral-200">
        <Row label="Subtotal" value={fmtRp(subtotal)} />
        {discount > 0 ? (
          <Row label="Diskon" value={`− ${fmtRp(discount)}`} muted />
        ) : null}
        <Row
          label="Total"
          value={fmtRp(total)}
          className="text-base font-bold text-amber-700 pt-1.5 border-t border-neutral-200"
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  className,
}: {
  label: string;
  value: string;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between ${className ?? ""}`}>
      <span className={muted ? "text-neutral-500" : "text-neutral-700"}>{label}</span>
      <span className={muted ? "text-neutral-500" : "font-semibold text-neutral-900"}>
        {value}
      </span>
    </div>
  );
}

// ──────────────────────────────────────────
function SuccessView({
  invoiceNumber,
  total,
  paymentUrl,
}: {
  invoiceNumber: string;
  total: number;
  paymentUrl: string | null;
}) {
  return (
    <div className="text-center py-4">
      <div className="text-5xl mb-3">🎉</div>
      <h4 className="text-base font-semibold text-neutral-900">
        Invoice berhasil dikirim
      </h4>
      <p className="text-sm text-neutral-600 mt-1">
        <code className="font-mono text-[11px] bg-neutral-100 px-1.5 py-0.5 rounded">
          {invoiceNumber}
        </code>{" "}
        — {fmtRp(total)}
      </p>
      {paymentUrl ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
          <p className="text-[11px] font-semibold text-amber-900 uppercase tracking-wider mb-1">
            Link pembayaran Xendit
          </p>
          <a
            href={paymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-700 hover:text-amber-800 underline-offset-2 hover:underline break-all"
          >
            {paymentUrl}
          </a>
        </div>
      ) : (
        <p className="text-xs text-neutral-500 mt-3">
          Pembayaran via bank transfer (info ada di email).
        </p>
      )}
    </div>
  );
}
