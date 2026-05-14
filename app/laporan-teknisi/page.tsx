// app/laporan-teknisi/page.tsx
// Server Component. Auth-gates and fetches initial form data via
// public.get_laporan_initial_data(). The RPC enforces access internally
// (can_view_tech_pages OR can_admin); we still bounce unauthenticated users
// here to keep behaviour consistent with the rest of Kayon.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LaporanInitialData } from "@/lib/laporan";
import LaporanForm from "./laporan-form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();

  // 1. Bounce unauthenticated users.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 2. Fetch initial data. RPC throws 42501 for users without
  //    can_view_tech_pages or can_admin — we treat any error as "not allowed
  //    here" and send the user back to the dashboard.
  const { data, error } = await supabase.rpc("get_laporan_initial_data");

  if (error) {
    // Forbidden, no rows, or any other RPC failure — back to dashboard.
    // Detailed error visible in browser network tab for debugging.
    return (
      <main className="max-w-[480px] mx-auto px-3 pb-16 pt-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold mb-1">⚠️ Tidak dapat memuat halaman</p>
          <p className="text-xs leading-relaxed">{error.message}</p>
          <p className="text-xs mt-3">
            <a href="/dashboard" className="underline">
              ← Kembali ke dashboard
            </a>
          </p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="max-w-[480px] mx-auto px-3 pb-16 pt-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>Tidak ada data yang dapat ditampilkan.</p>
        </div>
      </main>
    );
  }

  const initial = data as LaporanInitialData;

  return <LaporanForm initial={initial} />;
}
