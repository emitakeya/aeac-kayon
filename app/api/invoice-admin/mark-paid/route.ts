// app/api/invoice-admin/mark-paid/route.ts
// Wraps the public.mark_invoice_paid(p_invoice_id) RPC.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { invoice_id?: number };
  try {
    body = (await request.json()) as { invoice_id?: number };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body harus JSON yang valid" },
      { status: 400 }
    );
  }

  const id = Number(body.invoice_id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { ok: false, error: "invoice_id wajib diisi dan harus angka" },
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

  const { data, error } = await supabase.rpc("mark_invoice_paid", {
    p_invoice_id: id,
  });

  if (error) {
    const status = error.code === "42501" ? 403 : 500;
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status }
    );
  }

  return NextResponse.json({ ok: true, data });
}
