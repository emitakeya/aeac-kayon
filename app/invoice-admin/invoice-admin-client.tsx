// app/invoice-admin/invoice-admin-client.tsx
"use client";

import { useState } from "react";
import type {
  InvoiceAdminData,
  OrderForInvoicing,
} from "@/lib/invoices";
import PendingList from "./pending-list";
import InvoicedList from "./invoiced-list";
import InvoiceEditor from "./invoice-editor";

type Tab = "pending" | "invoiced";

export default function InvoiceAdminClient({
  initialData,
}: {
  initialData: InvoiceAdminData;
}) {
  const [data, setData] = useState<InvoiceAdminData>(initialData);
  const [tab, setTab] = useState<Tab>("pending");
  const [refreshing, setRefreshing] = useState(false);

  // The editor view replaces the list view when an order is selected.
  const [selected, setSelected] = useState<OrderForInvoicing | null>(null);
  const [loadingOrder, setLoadingOrder] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ──────────────────────────────────────────
  async function refreshAll() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/invoice-admin/refresh", {
        method: "POST",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fresh = (await res.json()) as InvoiceAdminData;
      setData(fresh);
    } catch (e) {
      console.error("refreshAll failed:", e);
      alert("Gagal memuat ulang data. Silakan refresh halaman.");
    } finally {
      setRefreshing(false);
    }
  }

  // ──────────────────────────────────────────
  async function handleSelectOrder(orderId: string) {
    setLoadingOrder(orderId);
    setLoadError(null);
    try {
      const res = await fetch("/api/invoice-admin/load-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setSelected(json.data as OrderForInvoicing);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoadError(msg);
      alert(`Gagal memuat order: ${msg}`);
    } finally {
      setLoadingOrder(null);
    }
  }

  function closeEditor() {
    setSelected(null);
    setLoadError(null);
  }

  async function handleSent() {
    setSelected(null);
    setTab("invoiced");
    await refreshAll();
  }

  // ──────────────────────────────────────────
  // Editor view replaces the entire list UI when an order is loaded.
  if (selected) {
    return (
      <InvoiceEditor
        loaded={selected}
        services={data.services}
        technicians={data.technicians}
        onCancel={closeEditor}
        onSent={handleSent}
      />
    );
  }

  // ──────────────────────────────────────────
  const pendingCount = data.completed_orders.filter(
    (o) => !data.invoices.some((i) => i.order_id === o.order_id)
  ).length;
  const invoicedCount = data.invoices.length;

  return (
    <main className="max-w-3xl mx-auto px-3 pb-16 pt-6">
      {/* Header card */}
      <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden mb-4">
        <div className="h-1.5 bg-gradient-to-r from-amber-500 to-amber-600" />
        <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900 leading-tight">
              📄 Invoice Admin — AEAC
            </h1>
            <p className="text-sm text-neutral-600 mt-1">
              Kelola dan kirim invoice ke customer berdasarkan laporan teknisi.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            disabled={refreshing}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition"
            aria-label="Refresh data"
          >
            <span
              className={`inline-block ${refreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            >
              ↻
            </span>
            <span>Refresh</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-t border-neutral-200 px-2 pt-2 flex gap-1 -mb-px">
          <TabButton
            active={tab === "pending"}
            onClick={() => setTab("pending")}
            label="⏳ Perlu Invoice"
            count={pendingCount}
          />
          <TabButton
            active={tab === "invoiced"}
            onClick={() => setTab("invoiced")}
            label="📋 Sudah Diinvoice"
            count={invoicedCount}
          />
        </div>
      </section>

      {/* Tab content */}
      {tab === "pending" ? (
        <PendingList
          orders={data.completed_orders}
          invoices={data.invoices}
          onSelectOrder={handleSelectOrder}
          loadingOrderId={loadingOrder}
        />
      ) : (
        <InvoicedList invoices={data.invoices} onChange={refreshAll} />
      )}

      {loadError ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          ⚠ {loadError}
        </div>
      ) : null}
    </main>
  );
}

// ──────────────────────────────────────────
function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative px-3 py-2 text-sm font-medium rounded-t-md transition ${
        active
          ? "text-amber-700 bg-amber-50 border border-neutral-200 border-b-white"
          : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
      }`}
      aria-selected={active}
      role="tab"
    >
      <span>{label}</span>
      <span
        className={`ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold ${
          active
            ? "bg-amber-600 text-white"
            : "bg-neutral-200 text-neutral-700"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
