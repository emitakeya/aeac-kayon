// app/api/invoice-admin/load-order/route.ts
// Wraps the public.get_order_for_invoicing(p_order_id) RPC.
// Loads a single order + customer + latest report, gated on
// can_view_finance OR can_admin (enforced inside the RPC).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { order_id?: string };
  try {
    body = (await request.json()) as { order_id?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body harus JSON yang valid" },
      { status: 400 }
    );
  }

  const orderId = (body.order_id ?? "").trim();
  if (!orderId) {
    return NextResponse.json(
      { ok: false, error: "order_id wajib diisi" },
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

  const { data, error } = await supabase.rpc("get_order_for_invoicing", {
    p_order_id: orderId,
  });

  if (error) {
    let status = 500;
    if (error.code === "42501") status = 403;
    if (error.code === "P0002") status = 404;
    return NextResponse.json(
      { ok: false, error: error.message, code: error.code },
      { status }
    );
  }

  return NextResponse.json({ ok: true, data });
}
