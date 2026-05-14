// lib/cancel.ts
// Types for /cancel page and /api/cancel route.
//
// Shape mirrors what public.get_cancellable_orders() returns. Customer fields
// are flattened (not nested) because the RPC returns them at the top level.

export type CancellableOrder = {
  order_id: string;
  scheduled_date: string | null;
  status: string; // "pending" | "confirmed"
  services: string[] | null;
  notes: string | null;
  name_roma: string | null;
  name_kanji: string | null;
  apartment: string | null;
  unit: string | null;
  mobile: string | null;
  email: string | null;
};

// Response shape returned by POST /api/cancel
export type CancelApiResponse =
  | { ok: true; order_id: string }
  | { ok: false; error: string };

// Shape of jsonb returned by the cancel_order() RPC. We forward this to GAS.
export type CancelRpcPayload = {
  order_id: string;
  scheduled_date: string | null;
  services: string[];
  customer: {
    name_roma: string | null;
    name_kanji: string | null;
    apartment: string | null;
    unit: string | null;
    mobile: string | null;
    email: string | null;
  };
};

// Hardcoded BCC list — matches the WordPress cancel form.
// TO recipients (customer + 4 technicians) are added by GAS itself.
// Stored here so the route handler can keep the GAS call site clean.
export const CANCEL_EMAIL_BCC = [
  "servisacapartemen@gmail.com",
  "emitakeya@maisonmap.com",
  "aeac@maisonmap.com",
  "irwandwikarya@gmail.com",
  "kkhusnul32@yahoo.co.id",
  "rustamathallah@gmail.com",
  "renoharyo5@gmail.com",
].join(",");
