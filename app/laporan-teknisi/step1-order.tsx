// app/laporan-teknisi/step1-order.tsx
// Step 1: pick the order, the technicians who worked, and start/end times.

"use client";

import type { LaporanOrder, LaporanTechnician } from "@/lib/laporan";
import { customerDisplayName } from "@/lib/laporan";

export default function Step1Order({
  orders,
  technicians,
  selectedOrderId,
  setSelectedOrderId,
  selectedTechs,
  setSelectedTechs,
  jamMulai,
  setJamMulai,
  jamSelesai,
  setJamSelesai,
  onNext,
}: {
  orders: LaporanOrder[];
  technicians: LaporanTechnician[];
  selectedOrderId: string;
  setSelectedOrderId: (v: string) => void;
  selectedTechs: string[];
  setSelectedTechs: (v: string[]) => void;
  jamMulai: string;
  setJamMulai: (v: string) => void;
  jamSelesai: string;
  setJamSelesai: (v: string) => void;
  onNext: () => void;
}) {
  const selectedOrder = orders.find((o) => o.order_id === selectedOrderId) ?? null;

  function toggleTech(name: string) {
    setSelectedTechs(
      selectedTechs.includes(name)
        ? selectedTechs.filter((t) => t !== name)
        : [...selectedTechs, name],
    );
  }

  return (
    <section className="space-y-4">
      <Card title="Informasi Order" subtitle="Pilih Order ID dan teknisi yang hadir.">
        {/* Order ID */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-neutral-700">
            Order ID <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          >
            <option value="" disabled>
              {orders.length === 0 ? "Tidak ada order tersedia" : "— Pilih Order ID —"}
            </option>
            {orders.map((o) => (
              <option key={o.order_id} value={o.order_id}>
                {o.order_id} — {customerDisplayName(o.customer)} — {o.customer.apartment ?? ""}{" "}
                {o.customer.unit ?? ""}
              </option>
            ))}
          </select>

          {selectedOrder ? <OrderPreview order={selectedOrder} /> : null}
        </div>

        {/* Technicians */}
        <div className="space-y-1.5 mt-4">
          <label className="block text-xs font-medium text-neutral-700">
            Teknisi yang Hadir <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {technicians.map((t) => {
              const checked = selectedTechs.includes(t.name);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTech(t.name)}
                  className={[
                    "min-h-[44px] rounded-xl border px-3 py-2 text-sm font-medium transition flex items-center justify-between",
                    checked
                      ? "bg-amber-50 border-amber-400 text-amber-900"
                      : "bg-white border-neutral-300 text-neutral-700 hover:border-neutral-400",
                  ].join(" ")}
                  aria-pressed={checked}
                >
                  <span>{t.name}</span>
                  <span
                    className={[
                      "ml-2 inline-flex items-center justify-center w-5 h-5 rounded-md text-[11px]",
                      checked
                        ? "bg-amber-500 text-white"
                        : "bg-neutral-100 text-neutral-400",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {checked ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Time */}
        <div className="space-y-1.5 mt-4">
          <label className="block text-xs font-medium text-neutral-700">
            Waktu Pengerjaan <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] text-neutral-500 mb-1">Jam Mulai</p>
              <input
                type="time"
                value={jamMulai}
                onChange={(e) => setJamMulai(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
            <div>
              <p className="text-[11px] text-neutral-500 mb-1">Jam Selesai</p>
              <input
                type="time"
                value={jamSelesai}
                onChange={(e) => setJamSelesai(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Footer nav */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onNext}
          className="flex-1 min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition shadow-sm"
        >
          Selanjutnya →
        </button>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────
function OrderPreview({ order }: { order: LaporanOrder }) {
  const c = order.customer;
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 mt-2 text-xs space-y-1">
      <p className="font-semibold text-neutral-900 text-sm">
        {customerDisplayName(c)}
      </p>
      {c.name_kanji ? <p className="text-neutral-600">{c.name_kanji}</p> : null}
      <p className="text-neutral-600">
        🏢 {c.apartment ?? "—"} / {c.unit ?? "—"}
      </p>
      {order.scheduled_date ? (
        <p className="text-neutral-600">📅 {order.scheduled_date}</p>
      ) : null}
      {c.mobile ? <p className="text-neutral-600">📱 {c.mobile}</p> : null}
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
