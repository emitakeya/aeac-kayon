// app/booking-staff/page.tsx
// Server Component for /booking-staff.
// - Auth + role gate (MM staff or admin).
// - Loads booking context (identity, teammates, optional prefill) via
//   get_staff_booking_context(ref).
// - Loads the service catalog + apartment list.
// - Hands everything to BookingStaffClient.
//
// Modes:
//   /booking-staff              → fresh order (blank, apartment picker)
//   /booking-staff?ref=<order>  → reminder mode (prefilled, apt/unit locked)

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/types";
import { buildCatalog, type BookingContext, type RawService } from "@/lib/booking-staff";
import BookingStaffClient from "./booking-staff-client";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ ref?: string }> };

export default async function BookingStaffPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const refOrderId = (sp.ref ?? "").trim() || null;

  const supabase = await createClient();

  // ── Auth gate ──
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("v_current_user")
    .select("*")
    .maybeSingle<CurrentUser>();

  if (!me) redirect("/login");
  if (!(me.can_view_mm || me.can_admin)) redirect("/403");

  // ── Booking context (identity + teammates + optional prefill) ──
  const { data: ctxData, error: ctxError } = await supabase.rpc("get_staff_booking_context", {
    p_ref_order_id: refOrderId,
  });

  // ── Catalog + apartments ──
  const [{ data: svcRows }, { data: aptRows }] = await Promise.all([
    supabase.from("services").select("id,name_id,price,category").eq("active", true).order("id"),
    supabase.from("apartments").select("name").eq("active", true).order("name"),
  ]);

  const catalog = buildCatalog((svcRows ?? []) as RawService[]);
  const apartments = ((aptRows ?? []) as { name: string }[]).map((a) => a.name);

  return (
    <main className="bsw">
      <div className="b-topnav">
        <Link href="/dashboard" className="b-back-btn" aria-label="Kembali ke dashboard">
          ← Kembali
        </Link>
        <div className="b-topnav-title">
          <h2>Booking / Order Baru</h2>
          <p>Khusus staff MM</p>
        </div>
        <div className="b-topnav-spacer" aria-hidden="true" />
      </div>

      {ctxError ? (
        <div className="b-err-msg">⚠️ Gagal memuat form: {ctxError.message}</div>
      ) : (
        <BookingStaffClient
          context={ctxData as BookingContext}
          catalog={catalog}
          apartments={apartments}
          refOrderId={refOrderId}
        />
      )}
    </main>
  );
}
