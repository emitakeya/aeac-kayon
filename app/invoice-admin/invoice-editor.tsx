// app/invoice-admin/invoice-editor.tsx
"use client";

import { useState } from "react";
import {
  type LineItem,
  type OrderForInvoicing,
  type ServiceRow,
  type TechnicianRow,
  fmtRp,
  toProper,
  buildInvoiceNumber,
  buildLineItemsFromReport,
  calcSubtotal,
  calcTotal,
  combineCustomerEmails,
} from "@/lib/invoices";
import InvoicePreviewModal from "./invoice-preview-modal";

export default function InvoiceEditor({
  loaded,
  services,
  technicians,
  onCancel,
  onSent,
}: {
  loaded: OrderForInvoicing;
  services: ServiceRow[];
  technicians: TechnicianRow[];
  onCancel: () => void;
  onSent: () => void | Promise<void>;
}) {
  const order = loaded.order;
  const report = loaded.report;
  const c = order.customer;

  const [items, setItems] = useState<LineItem[]>(() =>
    buildLineItemsFromReport(report, services)
  );
  const [discount, setDiscount] = useState<number>(0);
  const [addServiceId, setAddServiceId] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const subtotal = calcSubtotal(items);
  const total = calcTotal(items, discount);
  const invoiceNumber = buildInvoiceNumber(order.order_id);
  const customerEmail = combineCustomerEmails(c);
  const customerName = toProper(c.name_roma) || c.name_kanji || "—";

  // ──────────────────────────────────────────
  function updateRow(idx: number, patch: Partial<LineItem>) {
    setItems((prev) => {
      const next = [...prev];
      const cur = { ...next[idx], ...patch };
      cur.amount = (Number(cur.qty) || 0) * (Number(cur.price) || 0);
      next[idx] = cur;
      return next;
    });
  }

  function removeRow(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addBlankRow() {
    setItems((prev) => [
      ...prev,
      { name: "", qty: 1, price: 0, amount: 0 },
    ]);
  }

  function addServiceRow() {
    const id = Number(addServiceId);
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    setItems((prev) => [
      ...prev,
      { name: svc.name_id, qty: 1, price: svc.price, amount: svc.price },
    ]);
    setAddServiceId("");
  }

  // ──────────────────────────────────────────
  return (
    <main className="max-w-3xl mx-auto px-3 pb-16 pt-6">
      {/* Header card */}
      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden mb-3">
        <div className="h-1.5 bg-gradient-to-r from-amber-500 to-amber-600" />
        <div className="px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900 mb-1"
            >
              ← Kembali ke daftar
            </button>
            <h1 className="text-lg font-semibold text-neutral-900 leading-tight truncate">
              📝 Buat Invoice
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Order:{" "}
              <code className="font-mono text-[11px] bg-neutral-100 px-1 py-0.5 rounded">
                {order.order_id}
              </code>
            </p>
          </div>
        </div>
      </section>

      {/* Customer card */}
      <section className="rounded-xl border border-neutral-200 bg-white p-3.5 mb-3">
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          Customer
        </h2>
        <p className="text-sm font-semibold text-neutral-900">{customerName}</p>
        {c.name_kanji ? (
          <p className="text-xs text-neutral-600 mt-0.5">{c.name_kanji}</p>
        ) : null}
        <p className="text-xs text-neutral-600 mt-0.5">
          {[c.apartment, c.unit].filter(Boolean).join(" / ") || "—"}
        </p>
        {customerEmail ? (
          <p className="text-xs text-neutral-500 mt-2 break-all">
            ✉ {customerEmail}
          </p>
        ) : (
          <p className="text-xs text-red-600 mt-2 font-medium">
            ⚠ Email customer kosong! Invoice tidak bisa dikirim ke customer.
          </p>
        )}
        {order.scheduled_date ? (
          <p className="text-xs text-neutral-500 mt-1">
            📅 {order.scheduled_date}
          </p>
        ) : null}
        {report?.technicians && report.technicians.length > 0 ? (
          <p className="text-xs text-neutral-500 mt-1">
            👷 {(report.technicians as string[]).join(", ")}
          </p>
        ) : null}
      </section>

      {/* Line items */}
      <section className="rounded-xl border border-neutral-200 bg-white p-3.5 mb-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
            Line Items
          </h2>
          <span className="text-[11px] text-neutral-500">
            {items.length} item
          </span>
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-neutral-500 italic py-3 text-center">
            Belum ada item. Tambahkan dari daftar service di bawah.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {items.map((item, idx) => (
              <li key={idx} className="py-2.5">
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateRow(idx, { name: e.target.value })}
                    className="flex-1 min-w-0 text-sm border border-neutral-200 rounded-md px-2 py-1.5 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-200"
                    placeholder="Nama service"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    aria-label={`Hapus baris ${idx + 1}`}
                    className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md w-7 h-7 flex items-center justify-center text-sm"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <label className="text-[11px] text-neutral-500 shrink-0">
                    Qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={item.qty}
                    onChange={(e) =>
                      updateRow(idx, { qty: Number(e.target.value) || 0 })
                    }
                    className="w-16 text-sm border border-neutral-200 rounded-md px-2 py-1 focus:border-amber-500 focus:outline-none"
                  />
                  <label className="text-[11px] text-neutral-500 shrink-0 ml-1">
                    Harga
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={item.price}
                    onChange={(e) =>
                      updateRow(idx, { price: Number(e.target.value) || 0 })
                    }
                    className="flex-1 min-w-0 text-sm border border-neutral-200 rounded-md px-2 py-1 focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-xs font-semibold text-neutral-900 shrink-0 ml-auto">
                    {fmtRp(item.amount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Add row controls */}
        <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={addServiceId}
              onChange={(e) => setAddServiceId(e.target.value)}
              className="flex-1 min-w-0 text-sm border border-neutral-200 rounded-md px-2 py-1.5 focus:border-amber-500 focus:outline-none bg-white"
            >
              <option value="">— Pilih service untuk ditambahkan —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name_id} — {fmtRp(s.price)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addServiceRow}
              disabled={!addServiceId}
              className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-1.5 transition"
            >
              + Tambah
            </button>
          </div>
          <button
            type="button"
            onClick={addBlankRow}
            className="text-xs text-neutral-600 hover:text-neutral-900 underline-offset-2 hover:underline"
          >
            + Tambah baris kosong (custom)
          </button>
        </div>
      </section>

      {/* Totals */}
      <section className="rounded-xl border border-neutral-200 bg-white p-3.5 mb-3">
        <div className="flex items-center justify-between text-sm py-1">
          <span className="text-neutral-600">Subtotal</span>
          <span className="font-semibold text-neutral-900">{fmtRp(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 py-1">
          <label htmlFor="ai-discount" className="text-sm text-neutral-600 shrink-0">
            Diskon
          </label>
          <input
            id="ai-discount"
            type="number"
            min={0}
            step={1000}
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            className="flex-1 min-w-0 max-w-[180px] text-sm text-right border border-neutral-200 rounded-md px-2 py-1 focus:border-amber-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-between text-base pt-2 mt-2 border-t border-neutral-200">
          <span className="font-semibold text-neutral-900">Total</span>
          <span className="font-bold text-amber-700 text-lg">{fmtRp(total)}</span>
        </div>
      </section>

      {/* Action buttons */}
      <section className="flex items-center gap-2 sticky bottom-0 bg-gradient-to-t from-neutral-50 via-neutral-50 to-transparent pt-4 pb-2 -mx-3 px-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-sm font-semibold px-4 py-2.5 transition"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          disabled={items.length === 0 || total <= 0}
          className="flex-[2] inline-flex items-center justify-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 active:scale-[0.98] transition"
        >
          👁 Preview Invoice
        </button>
      </section>

      {previewOpen ? (
        <InvoicePreviewModal
          invoiceNumber={invoiceNumber}
          order={order}
          report={report}
          technicians={technicians}
          items={items}
          subtotal={subtotal}
          discount={discount}
          total={total}
          onClose={() => setPreviewOpen(false)}
          onSent={onSent}
        />
      ) : null}
    </main>
  );
}
