// app/laporan-teknisi/step5-review.tsx
// Step 5: review summary + editable invoice + submit. The submit logic lives
// in the parent (laporan-form.tsx); this component displays the data, folds in
// the invoice editor card, and GATES the submit button so a technician can't
// send an invoice with an empty name, qty 0, price 0, or total 0.

"use client";

import type { LaporanOrder, LaporanService } from "@/lib/laporan";
import { customerDisplayName } from "@/lib/laporan";
import { type LineItem, calcTotal } from "@/lib/invoices";
import type { StagedPhoto } from "./laporan-form";
import InvoiceEditorCard from "./invoice-editor-card";

export default function Step5Review({
  order,
  selectedTechs,
  jamMulai,
  jamSelesai,
  serviceCounts,
  services,
  selectedKondisi,
  selectedTindakan,
  selectedRekomendasi,
  selectedPerbaikan,
  photosBefore,
  photosAfter,
  invoiceItems,
  setInvoiceItems,
  invoiceDiscount,
  setInvoiceDiscount,
  onResetInvoice,
  submitStage,
  submitStageLabel,
  submitError,
  onBack,
  onSubmit,
}: {
  order: LaporanOrder | null;
  selectedTechs: string[];
  jamMulai: string;
  jamSelesai: string;
  serviceCounts: Record<string, number>;
  services: LaporanService[];
  selectedKondisi: string[];
  selectedTindakan: string[];
  selectedRekomendasi: string[];
  selectedPerbaikan: string[];
  photosBefore: StagedPhoto[];
  photosAfter: StagedPhoto[];
  invoiceItems: LineItem[];
  setInvoiceItems: React.Dispatch<React.SetStateAction<LineItem[]>>;
  invoiceDiscount: number;
  setInvoiceDiscount: React.Dispatch<React.SetStateAction<number>>;
  onResetInvoice: () => void;
  submitStage: string;
  submitStageLabel: string;
  submitError: string | null;
  onBack: () => void;
  onSubmit: () => void | Promise<void>;
}) {
  const isSubmitting = submitStage !== "idle" && submitStage !== "error";
  const isError = submitStage === "error";

  const priceByName = new Map<string, number>();
  for (const s of services) priceByName.set(s.name_id, s.price);

  const workRows = Object.entries(serviceCounts)
    .filter(([, qty]) => qty > 0)
    .map(([name, qty]) => {
      const price = priceByName.get(name) ?? 0;
      const subtotal = price * qty;
      return { name, qty, price, subtotal };
    });

  // ───────────── Invoice submit-gating
  const invoiceTotal = calcTotal(invoiceItems, invoiceDiscount);
  const noItems = invoiceItems.length === 0;
  const hasEmptyName = invoiceItems.some((it) => it.name.trim().length === 0);
  const hasZeroQty = invoiceItems.some((it) => (Number(it.qty) || 0) <= 0);
  const hasZeroPrice = invoiceItems.some((it) => (Number(it.price) || 0) <= 0);
  const invoiceValid =
    !noItems && !hasEmptyName && !hasZeroQty && !hasZeroPrice && invoiceTotal > 0;

  const gateProblems: string[] = [];
  if (noItems) gateProblems.push("Belum ada item invoice.");
  if (hasEmptyName) gateProblems.push("Ada item tanpa nama.");
  if (hasZeroQty) gateProblems.push("Ada item dengan jumlah (qty) 0.");
  if (hasZeroPrice) gateProblems.push("Ada item dengan harga Rp 0.");
  if (!noItems && invoiceTotal <= 0) gateProblems.push("Total invoice masih Rp 0.");

  const submitDisabled = isSubmitting || !order || !invoiceValid;

  return (
    <section className="space-y-4">
      <Card
        title="Review Laporan"
        subtitle="Periksa kembali sebelum mengirim."
      >
        {order ? (
          <ReviewRow label="Order">
            <p className="font-mono text-xs">{order.order_id}</p>
            <p className="text-xs text-neutral-700 mt-0.5">
              {customerDisplayName(order.customer)}
              {order.customer.apartment
                ? ` · ${order.customer.apartment} ${order.customer.unit ?? ""}`
                : ""}
            </p>
            {order.scheduled_date ? (
              <p className="text-[11px] text-neutral-500 mt-0.5">
                📅 {order.scheduled_date}
              </p>
            ) : null}
          </ReviewRow>
        ) : (
          <ReviewRow label="Order">
            <p className="text-xs text-red-600">Order belum dipilih</p>
          </ReviewRow>
        )}

        <ReviewRow label="Teknisi">
          <p className="text-xs">
            {selectedTechs.length ? selectedTechs.join(", ") : "—"}
          </p>
        </ReviewRow>

        <ReviewRow label="Waktu">
          <p className="text-xs">
            {jamMulai && jamSelesai ? `${jamMulai} – ${jamSelesai}` : "—"}
          </p>
        </ReviewRow>

        <ReviewRow label="Pekerjaan">
          {workRows.length === 0 ? (
            <p className="text-xs text-neutral-500">—</p>
          ) : (
            <ul className="text-xs space-y-0.5">
              {workRows.map((r) => (
                <li key={r.name} className="flex justify-between gap-2">
                  <span className="text-neutral-700">
                    {r.name} ×{r.qty}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ReviewRow>

        <ReviewRow label="Kondisi Sebelum">
          <ChipList items={selectedKondisi} />
        </ReviewRow>

        <ReviewRow label="Tindakan">
          <ChipList items={selectedTindakan} />
        </ReviewRow>

        <ReviewRow label="Rekomendasi">
          <ChipList items={selectedRekomendasi} />
        </ReviewRow>

        <ReviewRow label="Perbaikan">
          <ChipList items={selectedPerbaikan} />
        </ReviewRow>

        <ReviewRow label="Foto">
          {photosBefore.length + photosAfter.length === 0 ? (
            <p className="text-xs text-neutral-500">—</p>
          ) : (
            <>
              <p className="text-[11px] text-neutral-600 mb-1">
                Sebelum: {photosBefore.length} · Sesudah: {photosAfter.length}
              </p>
              <div className="flex gap-1 flex-wrap">
                {[...photosBefore, ...photosAfter].map((p, i) => (
                  <div
                    key={i}
                    className="w-12 h-12 rounded-md overflow-hidden border border-neutral-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.preview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </ReviewRow>
      </Card>

      {/* Editable invoice — gets sent to the customer on submit */}
      <InvoiceEditorCard
        items={invoiceItems}
        setItems={setInvoiceItems}
        discount={invoiceDiscount}
        setDiscount={setInvoiceDiscount}
        services={services}
        onReset={onResetInvoice}
      />

      {/* Gating hint */}
      {!invoiceValid && !isSubmitting ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold mb-1">Lengkapi invoice dulu:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {gateProblems.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Submit-time error */}
      {isError && submitError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="font-semibold mb-1">⚠️ Pengiriman gagal</p>
          <p className="text-xs break-words">{submitError}</p>
          <p className="text-xs mt-2 text-red-700">
            Anda bisa mencoba lagi. Jika foto sudah berhasil diunggah
            sebelumnya, pengiriman akan mengupload-nya kembali (tertimpa).
          </p>
        </div>
      ) : null}

      {/* Submit progress */}
      {isSubmitting && submitStageLabel ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-center gap-2">
          <span className="inline-block w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span>{submitStageLabel}</span>
        </div>
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1 min-h-[48px] rounded-xl bg-white border border-neutral-300 text-neutral-700 text-sm font-medium hover:bg-neutral-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Kembali
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitDisabled}
          className="flex-[2] min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Mengirim..." : "✓ Kirim Laporan & Buat Invoice"}
        </button>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────
function ReviewRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2 first:pt-0 border-b border-neutral-100 last:border-b-0">
      <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      <div>{children}</div>
    </div>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (!items || items.length === 0) {
    return <p className="text-xs text-neutral-500">—</p>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((s) => (
        <span
          key={s}
          className="text-[11px] bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-full"
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-3 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {subtitle ? (
          <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}
