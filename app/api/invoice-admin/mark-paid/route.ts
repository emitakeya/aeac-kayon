// app/api/invoice-admin/mark-paid/route.ts
// POST /api/invoice-admin/mark-paid
//
// Body: { invoice_id: number, bank_row_id: number, bank_source?: "MMP" }
//
// Wraps public.mark_invoice_paid_with_bank(). A bank-book link is MANDATORY:
// there is no unlinked path. If Finance has not yet imported the statement,
// there is no candidate and the invoice stays unpaid until they do.
//
// The RPC sets paid_date from the bank row's tanggal (not today), so the
// resulting commissions land in the month the money actually arrived, and
// creates both technician and marketing commissions in one pass.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RequestBody = {
  invoice_id?: unknown;
  bank_row_id?: unknown;
  bank_source?: unknown;
  note?: unknown;
};

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

  const bankRowId = Number(body.bank_row_id);
  if (!Number.isFinite(bankRowId) || bankRowId <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "bank_row_id wajib diisi — invoice hanya bisa ditandai lunas dengan menautkan transaksi buku bank",
      },
      { status: 400 }
    );
  }

  const bankSource =
    typeof body.bank_source === "string" && body.bank_source.trim()
      ? body.bank_source.trim()
      : "MMP";

  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim()
      : null;

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

  const { data, error } = await supabase.rpc("mark_invoice_paid_with_bank", {
    p_invoice_id: invoiceId,
    p_bank_row_id: bankRowId,
    p_bank_source: bankSource,
    p_note: note,
  });

  if (error) {
    let status = 500;
    if (error.code === "42501") status = 403;
    if (error.code === "P0002") status = 404;
    if (error.code === "22023") status = 400;
    console.error("[mark-paid] RPC error:", error);
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status }
    );
  }

  return NextResponse.json({ ok: true, data });
}
