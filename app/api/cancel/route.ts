// app/api/cancel/route.ts
// POST /api/cancel
//
// Body: { order_id: string, reason: string | null }
//
// 1. Re-checks auth + role via Supabase (the RPC also checks, but we want
//    to fail fast and return a JSON error before hitting the DB).
// 2. Calls public.cancel_order() RPC — this does the role check, the update,
//    and returns the JSON payload we forward to GAS.
// 3. Sends the cancellation email via GAS (fire-and-forget; logged but not
//    awaited as a hard requirement — same behavior as the WordPress version).
// 4. Returns { ok: true, order_id } on success or { ok: false, error } on failure.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/types";
import {
  type CancelApiResponse,
  type CancelRpcPayload,
  CANCEL_EMAIL_BCC,
} from "@/lib/cancel";

const GAS_URL =
  "https://script.google.com/macros/s/AKfycbw_F2761A5aCtbFBN2VzlQC4SIXiyAmbq9ohOPSuM0HadN0y7A93yEkhcgk-PaByMhyew/exec";

type RequestBody = {
  order_id?: unknown;
  reason?: unknown;
};

function err(message: string, status = 400): NextResponse<CancelApiResponse> {
  return NextResponse.json<CancelApiResponse>({ ok: false, error: message }, { status });
}

export async function POST(req: Request): Promise<NextResponse<CancelApiResponse>> {
  // ─── Parse body ───────────────────────────────────────
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return err("Invalid JSON body", 400);
  }

  const orderId = typeof body.order_id === "string" ? body.order_id.trim() : "";
  const reason =
    typeof body.reason === "string" && body.reason.trim().length > 0
      ? body.reason.trim()
      : null;

  if (!orderId) {
    return err("order_id is required", 400);
  }

  // ─── Auth + role check (fail fast) ────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Not authenticated", 401);

  const { data: me } = await supabase
    .from("v_current_user")
    .select("*")
    .maybeSingle<CurrentUser>();

  if (!me) return err("Account not registered", 403);
  if (!(me.can_admin || me.can_view_finance)) {
    return err("Forbidden: admin or finance role required", 403);
  }

  // ─── Cancel via RPC ───────────────────────────────────
  const { data: payload, error: rpcError } = await supabase.rpc("cancel_order", {
    p_order_id: orderId,
    p_reason: reason,
  });

  if (rpcError) {
    console.error("[cancel] RPC error:", rpcError);
    return err(rpcError.message || "Database error", 500);
  }

  if (!payload || typeof payload !== "object") {
    return err("Unexpected RPC response", 500);
  }

  const p = payload as CancelRpcPayload;

  // ─── Fire GAS email (best effort, do not block response) ─────
  // GAS expects application/x-www-form-urlencoded with repeated `services`
  // params — same shape as the WordPress cancel form.
  try {
    const params = new URLSearchParams();
    params.append("endpoint", "cancel");
    params.append("orderId", p.order_id);
    params.append("customerName", p.customer?.name_roma ?? "");
    params.append("customerEmail", p.customer?.email ?? "");
    params.append("apartment", p.customer?.apartment ?? "");
    params.append("unit", p.customer?.unit ?? "");
    params.append("mobile", p.customer?.mobile ?? "");
    params.append("scheduledDate", p.scheduled_date ?? "");
    params.append("reason", reason ?? "");
    params.append("bcc", CANCEL_EMAIL_BCC);
    for (const s of p.services ?? []) {
      params.append("services", s);
    }

    // Note: we DO await the GAS call here (unlike the WP fire-and-forget version)
    // so the user sees an error if email send fails. If you'd rather not block
    // on GAS, wrap this in a setTimeout 0 / waitUntil pattern.
    const gasRes = await fetch(GAS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: params.toString(),
    });
    if (!gasRes.ok) {
      // The order is already cancelled in DB at this point. Log the email
      // failure but still return success — operator can resend manually.
      console.warn(
        "[cancel] GAS email returned non-OK status",
        gasRes.status,
        await gasRes.text().catch(() => "(no body)")
      );
    }
  } catch (emailErr) {
    // Same rationale — the cancellation succeeded, email is secondary.
    console.warn("[cancel] GAS email failed:", emailErr);
  }

  return NextResponse.json<CancelApiResponse>({
    ok: true,
    order_id: p.order_id,
  });
}
