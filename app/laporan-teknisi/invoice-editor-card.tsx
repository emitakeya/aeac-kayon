// app/laporan-teknisi/invoice-editor-card.tsx
// Editable invoice ("bill") card folded into Step 5 of the technician report.
//
// The PARENT (laporan-form.tsx) owns the line-item + discount state and the
// autofill source (it seeds `items` from the report via
// buildLineItemsFromReport in @/lib/invoices). This component is purely
// presentational: it renders the editable rows + the add/discount/reset
// controls and reports edits up through the setters. Keeping the state in the
// parent lets both Step 5's submit-gating and the submit chain read the same
// authoritative `items`/`discount`.
//
// Repair lines (and anything else) that come in at Rp 0 are highlighted red so
// the technician prices them on-site before sending — this lines up with the
// submit gate in step5-review.tsx, which blocks any zero-price row.

"use client";

import {
  type LineItem,
  calcSubtotal,
  calcTotal,
  fmtRp,
} from "@/lib/invoices";
import type { LaporanService } from "@/lib/laporan";

export default function InvoiceEditorCard({
  items,
  setItems,
  discount,
  setDiscount,
  services,
  onReset,
}: {
  items: LineItem[];
  setItems: React.Dispatch<React.SetStateAction<LineItem[]>>;
  discount: number;
  setDiscount: React.Dispatch<React.SetStateAction<number>>;
  services: LaporanService[];
  onReset: () => void;
}) {
  const subtotal = calcSubtotal(items);
  const total = calcTotal(items, discount);

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
    setItems((prev) => [...prev, { name: "", qty: 1, price: 0, amount: 0 }]);
  }

  function addServiceByName(nameId: string) {
    if (!nameId) return;
    const svc = services.find((s) => s.name_id === nameId);
    if (!svc) return;
    setItems((prev) => [
      ...prev,
      {
        name: svc.name_id,
        qty: 1,
        price: svc.price,
        amount: svc.price,
      },
    ]);
  }

  const zeroPriceCount = items.filter((it) => (Number(it.price) || 0) <= 0).length;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-3 border-b border-neutral-100">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">
            🧾 Invoice (Tagihan Customer)
          </h2>
          <span className="text-[11px] text-neutral-500">{items.length} item</span>
        </div>
        <p className="text-xs text-neutral-500 mt-0.5">
          Terisi otomatis dari pekerjaan. Sesuaikan harga &amp; jumlah bila perlu.
        </p>
      </div>

      <div className="px-4 py-3">
        {/* Repair / zero-price warning */}
        {zeroPriceCount > 0 ? (
          <p className="text-[11px] text-red-700 bg-red-50 border border-red-100 rounded-md px-2 py-1.5 mb-2">
            ⚠️ {zeroPriceCount} item masih Rp 0 (biasanya perbaikan). Isi harganya
            sebelum mengirim — baris merah di bawah.
          </p>
        ) : null}

        {items.length === 0 ? (
          <p className="text-xs text-neutral-500 italic py-3 text-center">
            Belum ada item. Tambahkan dari daftar service di bawah.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {items.map((item, idx) => {
              const isZero = (Number(item.price) || 0) <= 0;
              const isEmptyName = item.name.trim().length === 0;
              const flag = isZero || isEmptyName;
              return (
                <li
                  key={idx}
                  className={[
                    "py-2.5 -mx-2 px-2 rounded-lg",
                    flag ? "bg-red-50/70 ring-1 ring-red-100" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateRow(idx, { name: e.target.value })}
                      className={[
                        "flex-1 min-w-0 text-sm border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1",
                        isEmptyName
                          ? "border-red-300 focus:border-red-500 focus:ring-red-200"
                          : "border-neutral-200 focus:border-amber-500 focus:ring-amber-200",
                      ].join(" ")}
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
                      inputMode="numeric"
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
                      inputMode="numeric"
                      value={item.price}
                      onChange={(e) =>
                        updateRow(idx, { price: Number(e.target.value) || 0 })
                      }
                      className={[
                        "flex-1 min-w-0 text-sm border rounded-md px-2 py-1 focus:outline-none",
                        isZero
                          ? "border-red-300 focus:border-red-500"
                          : "border-neutral-200 focus:border-amber-500",
                      ].join(" ")}
                    />
                    <span className="text-xs font-semibold text-neutral-900 shrink-0 ml-auto tabular-nums">
                      {fmtRp(item.amount)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Add-row controls */}
        <div className="mt-3 pt-3 border-t border-neutral-100 space-y-2">
          <div className="flex items-center gap-2">
            <select
              value=""
              onChange={(e) => {
                addServiceByName(e.target.value);
                e.target.value = "";
              }}
              className="flex-1 min-w-0 text-sm border border-neutral-200 rounded-md px-2 py-1.5 focus:border-amber-500 focus:outline-none bg-white"
              aria-label="Tambah service dari daftar"
            >
              <option value="">+ Tambah service dari daftar…</option>
              {services.map((s) => (
                <option key={s.name_id} value={s.name_id}>
                  {s.name_id} — {fmtRp(s.price)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={addBlankRow}
              className="text-xs text-neutral-600 hover:text-neutral-900 underline-offset-2 hover:underline"
            >
              + Tambah baris kosong (custom)
            </button>
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-neutral-400 hover:text-neutral-600 underline-offset-2 hover:underline"
            >
              ↺ Reset ke pekerjaan
            </button>
          </div>
        </div>

        {/* Totals */}
        <div className="mt-3 pt-3 border-t border-neutral-200">
          <div className="flex items-center justify-between text-sm py-1">
            <span className="text-neutral-600">Subtotal</span>
            <span className="font-semibold text-neutral-900 tabular-nums">
              {fmtRp(subtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 py-1">
            <label
              htmlFor="inv-discount"
              className="text-sm text-neutral-600 shrink-0"
            >
              Diskon
            </label>
            <input
              id="inv-discount"
              type="number"
              min={0}
              step={1000}
              inputMode="numeric"
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
              className="flex-1 min-w-0 max-w-[160px] text-sm text-right border border-neutral-200 rounded-md px-2 py-1 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-between text-base pt-2 mt-1 border-t border-neutral-200">
            <span className="font-semibold text-neutral-900">Total</span>
            <span className="font-bold text-amber-700 text-lg tabular-nums">
              {fmtRp(total)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
