// app/api/tech-invoice/create-invoice/route.ts
// POST /api/tech-invoice/create-invoice
//
// PUBLIC route (no login). The invoice token in the body is the credential.
// Wraps public.create_invoice_by_token(p_token, p_payload), which:
//   - validates the token (exists / not expired / not already used)
//   - enforces payload.order_id == token.order_id
//   - inserts the invoice (idempotent on invoice_number/order_id)
//   - marks the token used atomically
//
// This is the tech-side counterpart to /api/invoice-admin/create-invoice.
// Everything else in the send flow (Xendit, email) reuses the SAME routes
// the admin page uses — neither requires auth.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { token?: string; payload?: Record<string, unknown> };

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Body harus JSON yang valid" }, { status: 400 });
  }

  const token = (body.token ?? "").trim();
  const payload = body.payload;

  if (!token) {
    return NextResponse.json({ ok: false, error: "token wajib diisi" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ ok: false, error: "payload wajib diisi" }, { status: 400 });
  }

  // No session is expected here — the server client operates as the `anon`
  // role, which is exactly what create_invoice_by_token is granted to.
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_invoice_by_token", {
    p_token: token,
    p_payload: payload,
  });

  if (error) {
    // 22023 = our validation raises (bad/expired/used token, order mismatch).
    const status = error.code === "22023" ? 400 : 500;
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status }
    );
  }

  return NextResponse.json({ ok: true, data });
}
