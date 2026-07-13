// app/api/booking-staff/availability/route.ts
// GET /api/booking-staff/availability?date=YYYY-MM-DD
// Returns { ok, am_count, pm_count, max } for the staff booking form's
// session-capacity check. Fail-open on error (matches the WP form).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/types";

export const dynamic = "force-dynamic";

type Availability = {
  ok: boolean;
  am_count?: number;
  pm_count?: number;
  max?: number;
  error?: string;
};

export async function GET(req: Request): Promise<NextResponse<Availability>> {
  const { searchParams } = new URL(req.url);
  const date = (searchParams.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "Invalid date" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const { data: me } = await supabase.from("v_current_user").select("*").maybeSingle<CurrentUser>();
  if (!me || !(me.can_view_mm || me.can_admin)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase.rpc("get_session_availability", { p_date: date });
  if (error || !data || typeof data !== "object") {
    // Fail-open: let the UI allow both sessions rather than block on a read error.
    return NextResponse.json({ ok: true, am_count: 0, pm_count: 0, max: 2 });
  }

  const d = data as { am_count: number; pm_count: number; max: number };
  return NextResponse.json({ ok: true, am_count: d.am_count, pm_count: d.pm_count, max: d.max });
}
