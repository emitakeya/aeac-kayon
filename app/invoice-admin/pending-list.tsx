// app/invoice-admin/pending-list.tsx
"use client";

import {
  type CompletedOrder,
  type InvoiceRow,
  filterPendingInvoice,
  groupOrdersByMonth,
  currentMonthKey,
  toProper,
} from "@/lib/invoices";
import MonthAccordion, { type MonthAccordionItem } from "./month-accordion";

export default function PendingList({
  orders,
  invoices,
}: {
  orders: CompletedOrder[];
  invoices: InvoiceRow[];
}) {
  const pending = filterPendingInvoice(orders, invoices);

  if (pending.length === 0) {
    return (
      <section className="rounded-xl border border-neutral-200 bg-white p-8 text-center">
        <div className="text-3xl mb-2">✨</div>
        <h2 className="text-base font-semibold text-neutral-900">
          Semua order sudah diinvoice
        </h2>
        <p className="text-sm text-neutral-600 mt-1">
          Tidak ada order completed yang belum dibuatkan invoice.
        </p>
      </section>
    );
  }

  const groups = groupOrdersByMonth(pending);

  const cur = currentMonthKey();
  const defaultOpenKey =
    groups.find((g) => g.monthKey === cur)?.monthKey
    ?? groups[0]?.monthKey
    ?? null;

  const items: MonthAccordionItem[] = groups.map((g) => ({
    monthKey: g.monthKey,
    count: g.orders.length,
    badges: [{ label: `${g.orders.length} order`, tone: "muted" }],
    children: (
      <>
        {g.orders.map((o) => (
          <PendingCard key={o.order_id} order={o} />
        ))}
      </>
    ),
  }));

  return <MonthAccordion items={items} defaultOpenKey={defaultOpenKey} />;
}

function PendingCard({ order }: { order: CompletedOrder }) {
  const c = order.customer;
  const customerDisplay = toProper(c.name_roma) || c.name_kanji || "—";
  const apartmentUnit =
    [c.apartment, c.unit].filter(Boolean).join(" / ") || "—";

  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <code className="text-[11px] font-mono bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded">
              {order.order_id}
            </code>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Completed
            </span>
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 leading-tight truncate">
            {customerDisplay}
          </h3>
          <p className="text-xs text-neutral-600 mt-0.5 truncate">
            {apartmentUnit}
          </p>
          {order.scheduled_date ? (
            <p className="text-xs text-neutral-500 mt-1">
              📅 {order.scheduled_date}
            </p>
          ) : null}
          {order.services && order.services.length > 0 ? (
            <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2">
              {order.services.join(" · ")}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() =>
            alert(`(Coming next) Buat invoice untuk ${order.order_id}`)
          }
          className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-2 active:scale-[0.98] transition"
        >
          + Invoice
        </button>
      </div>
    </article>
  );
}
