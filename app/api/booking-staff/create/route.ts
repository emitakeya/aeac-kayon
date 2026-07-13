// app/api/booking-staff/create/route.ts
// POST /api/booking-staff/create
//
// 1. Re-checks auth + role (fail fast; the RPC also gates).
// 2. Calls public.create_staff_order() — writes customer + order atomically,
//    generates order_id server-side, enforces self/teammate attribution.
// 3. Fires the GAS booking confirmation email (server-to-server, form-urlencoded,
//    no `endpoint` param → GAS booking branch). Tenant + ordering staff + techs.
//    Best-effort: the order is already saved, so an email failure is logged but
//    still returns success.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/types";
import { GAS_URL, type CreateBookingBody, type CreateBookingResponse } from "@/lib/booking-staff";

function err(message: string, status = 400): NextResponse<CreateBookingResponse> {
  return NextResponse.json<CreateBookingResponse>({ ok: false, error: message }, { status });
}

type OrderPayload = {
  order_id: string;
  ordered_by_email: string;
  ordered_by_name: string;
  scheduled_date: string;
  services: string[];
  apartment: string;
  unit: string;
  tenant_name: string;
  tenant_email: string | null;
  standby_name: string | null;
  standby_phone: string | null;
  notes: string | null;
};

export async function POST(req: Request): Promise<NextResponse<CreateBookingResponse>> {
  let body: CreateBookingBody;
  try {
    body = (await req.json()) as CreateBookingBody;
  } catch {
    return err("Invalid JSON body", 400);
  }

  if (!body.ordered_by_staff_id) return err("ordered_by_staff_id is required", 400);
  if (!body.scheduled_date) return err("scheduled_date is required", 400);
  if (!Array.isArray(body.services) || body.services.length === 0) return err("At least one service is required", 400);
  if (!body.apartment?.trim() || !body.unit?.trim()) return err("Apartment and unit are required", 400);
  if (!body.tenant_name?.trim()) return err("Tenant name is required", 400);

  // ── Auth + role (fail fast) ──
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err("Not authenticated", 401);

  const { data: me } = await supabase.from("v_current_user").select("*").maybeSingle<CurrentUser>();
  if (!me) return err("Account not registered", 403);
  if (!(me.can_view_mm || me.can_admin)) return err("Forbidden: MM staff role required", 403);

  // ── Create via RPC ──
  const { data: payload, error: rpcError } = await supabase.rpc("create_staff_order", {
    p_ordered_by_staff_id: body.ordered_by_staff_id,
    p_scheduled_date: body.scheduled_date,
    p_services: body.services,
    p_apartment: body.apartment.trim(),
    p_unit: body.unit.trim(),
    p_tenant_name: body.tenant_name.trim(),
    p_tenant_email: body.tenant_email ?? null,
    p_notes: body.notes ?? null,
    p_standby_name: body.standby_name ?? null,
    p_standby_phone: body.standby_phone ?? null,
    p_ref_order_id: body.ref_order_id ?? null,
  });

  if (rpcError) {
    console.error("[booking-staff] RPC error:", rpcError);
    return err(rpcError.message || "Database error", 500);
  }
  if (!payload || typeof payload !== "object") {
    return err("Unexpected RPC response", 500);
  }

  const p = payload as OrderPayload;

  // ── GAS booking email (best-effort) ──
  try {
    const params = new URLSearchParams();
    // NOTE: no `endpoint` param → GAS routes this to the booking branch.
    params.append("orderId", p.order_id);
    params.append("date", p.scheduled_date ?? "");
    params.append("nameRoma", p.tenant_name ?? "");
    params.append("nameKanji", "");
    params.append("orderedBy", p.ordered_by_name ?? "");
    params.append("orderedByEmail", p.ordered_by_email ?? "");
    params.append("mobile", p.standby_phone ?? "");
    params.append("email", p.tenant_email ?? "");
    params.append("apartment", p.apartment ?? "");
    params.append("unit", p.unit ?? "");
    params.append("message", p.notes ?? "");
    params.append("waitName", p.standby_name ?? "");
    params.append("waitMobile", p.standby_phone ?? "");
    params.append("totalEstimate", body.total_estimate != null ? String(body.total_estimate) : "");
    for (const s of p.services ?? []) params.append("services", s);

    const gasRes = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: params.toString(),
    });
    if (!gasRes.ok) {
      console.warn(
        "[booking-staff] GAS email non-OK",
        gasRes.status,
        await gasRes.text().catch(() => "(no body)")
      );
    }
  } catch (emailErr) {
    console.warn("[booking-staff] GAS email failed:", emailErr);
  }

  return NextResponse.json<CreateBookingResponse>({ ok: true, order_id: p.order_id });
}
