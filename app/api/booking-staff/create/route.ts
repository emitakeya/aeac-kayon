// app/api/booking-staff/create/route.ts
// POST /api/booking-staff/create
//
// 1. Re-checks auth + role (fail fast; the RPC also gates).
// 2. Calls public.create_staff_order() — writes customer + order atomically,
//    generates order_id server-side, enforces self/teammate attribution.
// 3. Fires the GAS booking confirmation email (server-to-server, JSON,
//    no `endpoint` key → GAS booking branch). TO list is built by GAS:
//    tenant email + ordering staff email + all technicians.
//    Best-effort: the order is already saved, so an email failure is logged but
//    still returns success.
//
// ⚠️ GAS payload MUST be JSON, not form-urlencoded. The WP relay
// (aeac_send_confirmation) learned this the hard way: form-urlencoded bodies
// do not survive the GAS 302 redirect, so the booking branch received empty
// params and no email went out. JSON is the proven format — it's what the WP
// booking relay and Kayon's send-report / send-invoice routes all use, and
// the live GAS parseRequest_() merges JSON bodies (arrays → paramsMulti).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/types";
import { GAS_URL, type CreateBookingBody, type CreateBookingResponse } from "@/lib/booking-staff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  // ── GAS booking email (best-effort, JSON) ──
  try {
    // NOTE: no `endpoint` key → GAS routes this to the booking branch.
    // Key names are the GAS booking branch's camelCase contract
    // (orderId, nameRoma, orderedByEmail, ... services[]).
    const gasBody = {
      orderId: p.order_id,
      date: p.scheduled_date ?? "",
      nameRoma: p.tenant_name ?? "",
      nameKanji: "",
      orderedBy: p.ordered_by_name ?? "",
      orderedByEmail: p.ordered_by_email ?? "",
      mobile: p.standby_phone ?? "",
      email: p.tenant_email ?? "",
      apartment: p.apartment ?? "",
      unit: p.unit ?? "",
      message: p.notes ?? "",
      waitName: p.standby_name ?? "",
      waitMobile: p.standby_phone ?? "",
      totalEstimate: body.total_estimate != null ? String(body.total_estimate) : "",
      services: p.services ?? [],
    };

    const gasRes = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gasBody),
      redirect: "follow",
      // GAS can be slow — generous timeout (same as send-report route)
      signal: AbortSignal.timeout(45_000),
    });

    const text = await gasRes.text().catch(() => "");
    if (!gasRes.ok) {
      console.warn("[booking-staff] GAS email non-OK", gasRes.status, text.slice(0, 500));
    } else {
      console.log("[booking-staff] GAS email response:", text.slice(0, 300));
    }
  } catch (emailErr) {
    console.warn("[booking-staff] GAS email failed:", emailErr);
  }

  return NextResponse.json<CreateBookingResponse>({ ok: true, order_id: p.order_id });
}
