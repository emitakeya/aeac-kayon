// app/api/invoice-admin/refresh/route.ts
// Returns fresh InvoiceAdminData by calling get_invoice_admin_data().
// The RPC handles its own role check; if denied, returns 403.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();

  // Auth gate (cheap; the RPC also checks)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Tidak terautentikasi" },
      { status: 401 }
    );
  }

  const { data, error } = await supabase.rpc("get_invoice_admin_data");

  if (error) {
    // 42501 = role check failed inside the RPC
    const status = error.code === "42501" ? 403 : 500;
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status }
    );
  }

  return NextResponse.json(data);
}
