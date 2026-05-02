// app/invoice-admin/month-accordion.tsx
"use client";

import { useState, type ReactNode } from "react";
import { monthLabel } from "@/lib/invoices";

export type MonthAccordionItem = {
  monthKey: string; // "YYYY-MM" or "unknown"
  count: number;
  /** Optional pills shown on the right of the header. */
  badges?: Array<{ label: string; tone: "paid" | "unpaid" | "muted" }>;
  /** Render the cards inside this month. */
  children: ReactNode;
};

const TONE_STYLES: Record<"paid" | "unpaid" | "muted", string> = {
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
  unpaid: "bg-amber-50 text-amber-800 border-amber-200",
  muted: "bg-neutral-100 text-neutral-700 border-neutral-200",
};

export default function MonthAccordion({
  items,
  defaultOpenKey,
}: {
  items: MonthAccordionItem[];
  /** monthKey to start expanded. Others start collapsed. */
  defaultOpenKey: string | null;
}) {
  // Track open keys as a Set so multiple can be open at once after user clicks.
  const [open, setOpen] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (defaultOpenKey) s.add(defaultOpenKey);
    return s;
  });

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isOpen = open.has(item.monthKey);
        const label =
          item.monthKey === "unknown"
            ? "Tanggal tidak diketahui"
            : monthLabel(item.monthKey);
        return (
          <div
            key={item.monthKey}
            className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggle(item.monthKey)}
              aria-expanded={isOpen}
              className="w-full px-3.5 py-2.5 flex items-center gap-2 text-left hover:bg-neutral-50 transition"
            >
              <span
                className={`inline-block text-neutral-400 transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
                aria-hidden="true"
              >
                ▶
              </span>
              <span className="text-sm font-semibold text-neutral-900 flex-1 truncate">
                {label}
              </span>
              <span className="text-[11px] font-medium text-neutral-500 shrink-0">
                {item.count} invoice
              </span>
              {item.badges?.map((b, i) => (
                <span
                  key={i}
                  className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                    TONE_STYLES[b.tone]
                  }`}
                >
                  {b.label}
                </span>
              ))}
            </button>
            {isOpen ? (
              <div className="px-2 pb-2 pt-0 space-y-2">{item.children}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
