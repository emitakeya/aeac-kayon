// app/api/invoice-admin/bank-candidates/route.ts
// POST /api/invoice-admin/bank-candidates
//
// Body: { invoice_id: number }
//
// Wraps public.get_invoice_bank_candidates(p_invoice_id).
// Returns MMP bank-book rows in account_category 'Sales AEAC' that are credits
// dated on or after the order's work date, ranked exact-amount-first.
// Xendit settlement rows are excluded inside the RPC — they are batched and
// net of fees, so they never equal a single invoice.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = { invoice_id?: unknown };

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body harus JSON yang valid" },
      { status: 400 }
    );
  }

  const invoiceId = Number(body.invoice_id);
  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return NextResponse.json(
      { ok: false, error: "invoice_id tidak valid" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Tidak terautentikasi" },
      { status: 401 }
    );
  }

  const { data, error } = await supabase.rpc("get_invoice_bank_candidates", {
    p_invoice_id: invoiceId,
  });

  if (error) {
    let status = 500;
    if (error.code === "42501") status = 403;
    if (error.code === "P0002") status = 404;
    if (error.code === "22023") status = 400;
    console.error("[bank-candidates] RPC error:", error);
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status }
    );
  }

  return NextResponse.json({ ok: true, data });
}
