// app/api/invoice-admin/create-invoice/route.ts
// Wraps the public.create_invoice(p_payload jsonb) RPC.
// Inserts a new invoice row with a role check inside the function.
// Idempotent on (invoice_number, order_id).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body harus JSON yang valid" },
      { status: 400 }
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { ok: false, error: "Payload tidak valid" },
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

  const { data, error } = await supabase.rpc("create_invoice", {
    p_payload: body,
  });

  if (error) {
    let status = 500;
    if (error.code === "42501") status = 403;
    if (error.code === "22023") status = 400;
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status }
    );
  }

  return NextResponse.json({ ok: true, data });
}
