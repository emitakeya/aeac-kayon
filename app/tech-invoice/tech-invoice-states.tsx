// app/tech-invoice/tech-invoice-states.tsx
// Read-only state cards for /tech-invoice. No interactivity → server components.
// Mirrors the approved mockup (states 2–4).

import type { ReactNode } from "react";

function Shell({
  bar,
  border,
  badgeBg,
  badgeText,
  icon,
  title,
  children,
}: {
  bar: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="max-w-md mx-auto px-3 pt-10 pb-16">
      <section className={`rounded-2xl border ${border} bg-white shadow-sm overflow-hidden text-center`}>
        <div className={`h-1.5 ${bar}`} />
        <div className="px-5 py-8">
          <div className={`w-14 h-14 rounded-full ${badgeBg} ${badgeText} text-2xl flex items-center justify-center mx-auto mb-4`}>
            {icon}
          </div>
          <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
          <div className="text-sm text-neutral-500 mt-2 leading-relaxed">{children}</div>
        </div>
      </section>
    </main>
  );
}

export function UsedState({ orderId }: { orderId?: string }) {
  return (
    <Shell
      bar="bg-gradient-to-r from-amber-500 to-amber-600"
      border="border-amber-200"
      badgeBg="bg-amber-100"
      badgeText="text-amber-600"
      icon="!"
      title="Invoice Sudah Dibuat"
    >
      <p>
        Invoice untuk order{" "}
        {orderId ? (
          <span className="font-mono text-xs">{orderId}</span>
        ) : (
          "ini"
        )}{" "}
        sudah pernah dibuat dan dikirim. Link ini hanya bisa dipakai satu kali.
      </p>
      <p className="text-xs text-neutral-400 mt-4">Jika ada masalah, hubungi admin.</p>
    </Shell>
  );
}

export function ExpiredState() {
  return (
    <Shell
      bar="bg-gradient-to-r from-red-500 to-red-600"
      border="border-red-200"
      badgeBg="bg-red-100"
      badgeText="text-red-600"
      icon="✕"
      title="Link Kedaluwarsa"
    >
      <p>
        Link invoice ini sudah lewat masa berlaku (7 hari sejak laporan dikirim).
        Hubungi admin untuk mendapatkan link baru.
      </p>
    </Shell>
  );
}

export function InvalidState() {
  return (
    <Shell
      bar="bg-gradient-to-r from-red-500 to-red-600"
      border="border-red-200"
      badgeBg="bg-red-100"
      badgeText="text-red-600"
      icon="✕"
      title="Link Tidak Valid"
    >
      <p>
        Link ini tidak dikenali. Pastikan Anda membuka link lengkap dari email
        laporan. Jika masih bermasalah, hubungi admin.
      </p>
    </Shell>
  );
}
