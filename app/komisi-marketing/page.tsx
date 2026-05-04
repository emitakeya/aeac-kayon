// app/komisi-marketing/page.tsx
//
// Server Component. Calls public.get_marketing_commission_recap(p_year) and
// renders the /komisi-marketing page. Access control (admin or finance only)
// lives inside the RPC and raises 42501 for users without permission.
//
// Year selection comes via the ?year= query param. Defaults to current year
// if it has data, else most recent year with data.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { MarketingRecapData } from "@/lib/marketing";
import MarketingRecapClient from "./marketing-recap-client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ year?: string }>;

export default async function Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();

  // Auth gate
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("v_current_user").select("*").maybeSingle();
  if (!me) redirect("/login");

  // Page-level role gate. The RPC also enforces this, but doing it here
  // gives a friendly /403 redirect rather than a database error.
  if (!me.can_admin && !me.can_view_finance) redirect("/403");

  // Parse selected year. Allow only 4-digit ints. Fall back to current year.
  const sp = await searchParams;
  const yearRaw = sp?.year;
  let year = new Date().getFullYear();
  if (yearRaw && /^\d{4}$/.test(yearRaw)) {
    const parsed = parseInt(yearRaw, 10);
    if (parsed >= 2024 && parsed <= 2099) year = parsed;
  }

  const { data, error } = await supabase.rpc("get_marketing_commission_recap", {
    p_year: year,
  });

  if (error) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-900 mb-3"
        >
          ← Dashboard
        </Link>
        <h1 className="text-xl font-semibold text-neutral-900 mb-2">
          Rekap Komisi Marketing
        </h1>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          ⚠️ Gagal memuat data: {error.message}
        </div>
      </main>
    );
  }

  const recap = data as MarketingRecapData;

  return (
    <MarketingRecapClient
      data={recap}
      meName={(me.staff_name as string | null) ?? me.email}
    />
  );
}
