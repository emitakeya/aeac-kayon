// app/invoice-admin/view-state.ts
// Session 40 — persist the /invoice-admin view (tab, open months, open
// invoice details) in the URL query string so F5 / bookmarks / shared links
// land on the same view. Written with history.replaceState (no navigation,
// no server round-trip). Read once on the server in page.tsx.
//
//   ?tab=invoiced          active tab ("pending" | "invoiced")
//   &mp=2026-09,2026-08    open months on the Perlu Invoice tab
//   &m=2026-09             open months on the Sudah Diinvoice tab
//   &d=123,456             invoice ids with the inline detail expanded

export type Tab = "pending" | "invoiced";

export type InvoiceAdminView = {
  tab: Tab | null; // null = not in URL, caller picks the default
  pendingMonths: string[] | null;
  invoicedMonths: string[] | null;
  detailIds: number[] | null;
};

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

function splitList(v: string | null): string[] | null {
  if (v === null) return null;
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export function parseView(params: RawParams): InvoiceAdminView {
  const tabRaw = first(params.tab);
  const tab: Tab | null =
    tabRaw === "pending" || tabRaw === "invoiced" ? tabRaw : null;
  const detail = splitList(first(params.d))
    ?.map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0) ?? null;
  return {
    tab,
    pendingMonths: splitList(first(params.mp)),
    invoicedMonths: splitList(first(params.m)),
    detailIds: detail,
  };
}

// Merge a partial update into the current URL and replace it in place.
// Empty lists / null remove the param. Safe to call only in the browser.
export function writeView(update: {
  tab?: Tab;
  pendingMonths?: string[];
  invoicedMonths?: string[];
  detailIds?: number[];
}) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  const set = (key: string, val: string | null) => {
    if (val) url.searchParams.set(key, val);
    else url.searchParams.delete(key);
  };
  if (update.tab !== undefined) set("tab", update.tab);
  if (update.pendingMonths !== undefined) set("mp", update.pendingMonths.join(","));
  if (update.invoicedMonths !== undefined) set("m", update.invoicedMonths.join(","));
  if (update.detailIds !== undefined) set("d", update.detailIds.join(","));
  window.history.replaceState(window.history.state, "", url.toString());
}
