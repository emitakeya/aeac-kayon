// app/laporan-teknisi/step2-pengerjaan.tsx
// Step 2: pick services performed, with a +/- counter per service.
//
// `serviceCounts` is keyed by services.name_id (Indonesian canonical name).
// We render services grouped by category for easier scanning on a small screen.

"use client";

import { useMemo } from "react";
import type { LaporanService } from "@/lib/laporan";
import { fmtRp } from "@/lib/laporan";

export default function Step2Pengerjaan({
  services,
  serviceCounts,
  setServiceCounts,
  onBack,
  onNext,
}: {
  services: LaporanService[];
  serviceCounts: Record<string, number>;
  setServiceCounts: (
    next:
      | Record<string, number>
      | ((prev: Record<string, number>) => Record<string, number>),
  ) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  // Group services by category for a tidier list. Unknown category goes last.
  const grouped = useMemo(() => {
    const map = new Map<string, LaporanService[]>();
    for (const s of services) {
      const cat = (s.category && s.category.trim()) || "lain";
      const arr = map.get(cat);
      if (arr) arr.push(s);
      else map.set(cat, [s]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      // "cleaning" first, "freon" second, "repair" third, then others
      const order = (k: string) =>
        ({ cleaning: 0, freon: 1, repair: 2, lain: 99 })[k] ?? 50;
      return order(a) - order(b);
    });
  }, [services]);

  function bump(name: string, delta: number) {
    setServiceCounts((prev) => {
      const cur = prev[name] || 0;
      const next = Math.max(0, Math.min(99, cur + delta));
      const out = { ...prev };
      if (next === 0) {
        delete out[name];
      } else {
        out[name] = next;
      }
      return out;
    });
  }

  const totalSelected = Object.values(serviceCounts).reduce(
    (s, n) => s + (Number(n) || 0),
    0,
  );

  return (
    <section className="space-y-4">
      <Card
        title="Pengerjaan"
        subtitle="Pilih jenis pekerjaan dan jumlah unit."
      >
        {totalSelected === 0 ? (
          <p className="text-xs text-neutral-500 italic mb-3">
            Belum ada pekerjaan dipilih. Tekan tombol{" "}
            <span className="font-mono">+</span> di samping setiap layanan.
          </p>
        ) : (
          <p className="text-xs text-amber-700 font-medium mb-3">
            {totalSelected} unit terpilih
          </p>
        )}

        <div className="space-y-3">
          {grouped.map(([cat, list]) => (
            <div key={cat}>
              <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                {categoryLabel(cat)}
              </p>
              <div className="space-y-1.5">
                {list.map((s) => {
                  const qty = serviceCounts[s.name_id] || 0;
                  const active = qty > 0;
                  return (
                    <div
                      key={s.name_id}
                      className={[
                        "rounded-xl border px-3 py-2 transition",
                        active
                          ? "bg-amber-50 border-amber-300"
                          : "bg-white border-neutral-200",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <p
                            className={[
                              "text-sm leading-tight",
                              active
                                ? "text-amber-900 font-medium"
                                : "text-neutral-800",
                            ].join(" ")}
                          >
                            {s.name_id}
                          </p>
                          {s.price ? (
                            <p className="text-[11px] text-neutral-500 mt-0.5">
                              {fmtRp(s.price)}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => bump(s.name_id, -1)}
                            disabled={qty === 0}
                            className="w-9 h-9 rounded-lg bg-white border border-neutral-300 text-neutral-700 font-semibold disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition"
                            aria-label={`Kurangi ${s.name_id}`}
                          >
                            −
                          </button>
                          <span
                            className={[
                              "min-w-[28px] text-center text-sm font-semibold tabular-nums",
                              active ? "text-amber-900" : "text-neutral-400",
                            ].join(" ")}
                          >
                            {qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => bump(s.name_id, 1)}
                            className="w-9 h-9 rounded-lg bg-amber-500 hover:bg-amber-600 border border-amber-600 text-white font-semibold active:scale-95 transition"
                            aria-label={`Tambah ${s.name_id}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 min-h-[48px] rounded-xl bg-white border border-neutral-300 text-neutral-700 text-sm font-medium hover:bg-neutral-50 transition"
        >
          ← Kembali
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={totalSelected === 0}
          className="flex-1 min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Selanjutnya →
        </button>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────
function categoryLabel(cat: string): string {
  return (
    {
      cleaning: "Cleaning",
      freon: "Freon",
      repair: "Repair",
      lain: "Lainnya",
    }[cat] ?? cat
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 pt-3 pb-3 border-b border-neutral-100">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {subtitle ? (
          <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}
