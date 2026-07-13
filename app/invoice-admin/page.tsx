// app/invoice-admin/page.tsx
// Server Component. Calls public.get_invoice_admin_data() and renders the
// /invoice-admin page. Read access (finance, admin, OR technician) is enforced
// inside the RPC, which raises 42501 for anyone else. Technicians render a
// read-only view (readOnly flag below); write RPCs stay finance/admin-only.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceAdminData } from "@/lib/invoices";
import InvoiceAdminClient from "./invoice-admin-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();

  // Auth gate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("v_current_user").select("*").maybeSingle();
  if (!me) redirect("/login");
  // Allow finance, admin, AND technicians. Marketing / TRO / supervisor stay
  // blocked. (can_view_tech_pages == {admin, finance, technician}.)
  if (!me.can_view_finance && !me.can_admin && !me.can_view_tech_pages) redirect("/403");

  // Technicians get a READ-ONLY view — no create / mark-paid / resend controls.
  // Finance + admin keep full write access. This flag only drives the UI; the
  // write RPCs (create_invoice / mark_invoice_paid) independently gate on
  // finance/admin, so a technician is blocked at the DB even via a raw request.
  const readOnly = !(me.can_view_finance || me.can_admin);

  // Single RPC call returns all four datasets
  const { data, error } = await supabase.rpc("get_invoice_admin_data");

  if (error) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-xl font-semibold text-neutral-900 mb-2">
          Invoice Admin — AEAC
        </h1>
        <p className="text-neutral-600 text-sm mb-4">
          Kelola dan kirim invoice ke customer berdasarkan laporan teknisi.
        </p>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          ⚠️ Gagal memuat data: {error.message}
        </div>
      </main>
    );
  }

  const initialData = (data ?? {
    completed_orders: [],
    invoices: [],
    services: [],
    technicians: [],
  }) as InvoiceAdminData;

  return <InvoiceAdminClient initialData={initialData} readOnly={readOnly} />;
}
