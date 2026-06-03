// app/tech-invoice/page.tsx
// PUBLIC token-gated page. Reached from the post-report invoice-link email:
//   https://kayon.aeac-service.id/tech-invoice?token=<24-char token>
//
// Server Component: resolves the token via get_order_for_invoicing_by_token
// (anon role) and renders one of four states. No client-side loading state
// is needed because the data is fetched before render.
//
// IMPORTANT: this route MUST be allowed through proxy.ts WITHOUT auth.
// See PROXY_AND_DEPLOY_NOTES.md.

import { createClient } from "@/lib/supabase/server";
import type { OrderForInvoicing, ServiceRow, TechnicianRow } from "@/lib/invoices";
import TechInvoiceEditor from "./tech-invoice-editor";
import { UsedState, ExpiredState, InvalidState } from "./tech-invoice-states";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReadResult =
  | {
      ok: true;
      order: OrderForInvoicing["order"];
      report: OrderForInvoicing["report"];
      services: ServiceRow[];
      technicians: TechnicianRow[];
    }
  | { ok: false; reason: "not_found" | "expired" | "used"; order_id?: string };

export default async function TechInvoicePage({
  searchParams,
}: {
  // Next.js 16: searchParams is async.
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  const token = (sp?.token ?? "").toString().trim();

  if (!token) return <InvalidState />;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_order_for_invoicing_by_token", {
    p_token: token,
  });

  if (error || !data) return <InvalidState />;

  const res = data as ReadResult;

  if (!res.ok) {
    if (res.reason === "used") return <UsedState orderId={res.order_id} />;
    if (res.reason === "expired") return <ExpiredState />;
    return <InvalidState />;
  }

  return (
    <TechInvoiceEditor
      token={token}
      loaded={{ order: res.order, report: res.report }}
      services={res.services ?? []}
      technicians={res.technicians ?? []}
    />
  );
}
