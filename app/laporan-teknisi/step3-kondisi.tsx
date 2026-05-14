// app/laporan-teknisi/step3-kondisi.tsx
// Step 3: four multi-select sections for what was observed and done.
// All four are stored as arrays of text_id (Indonesian canonical strings).
// All four are OPTIONAL — matches WP behaviour (no min-length error).

"use client";

import type { ChecklistOption, LaporanChecklists } from "@/lib/laporan";

export default function Step3Kondisi({
  checklists,
  selectedKondisi,
  setSelectedKondisi,
  selectedTindakan,
  setSelectedTindakan,
  selectedRekomendasi,
  setSelectedRekomendasi,
  selectedPerbaikan,
  setSelectedPerbaikan,
  onBack,
  onNext,
}: {
  checklists: LaporanChecklists;
  selectedKondisi: string[];
  setSelectedKondisi: (v: string[]) => void;
  selectedTindakan: string[];
  setSelectedTindakan: (v: string[]) => void;
  selectedRekomendasi: string[];
  setSelectedRekomendasi: (v: string[]) => void;
  selectedPerbaikan: string[];
  setSelectedPerbaikan: (v: string[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <section className="space-y-4">
      <Card
        title="Kondisi & Tindakan"
        subtitle="Catat kondisi sebelum, tindakan yang dilakukan, dan rekomendasi."
      >
        <ChecklistSection
          label="Kondisi Sebelum"
          help="Apa yang teknisi lihat sebelum mulai bekerja"
          options={checklists.kondisi}
          selected={selectedKondisi}
          setSelected={setSelectedKondisi}
        />

        <Divider />

        <ChecklistSection
          label="Tindakan yang Dilakukan"
          help="Apa saja yang dikerjakan"
          options={checklists.tindakan}
          selected={selectedTindakan}
          setSelected={setSelectedTindakan}
        />

        <Divider />

        <ChecklistSection
          label="Opsi Rekomendasi"
          help="Saran untuk customer (opsional)"
          options={checklists.rekomendasi}
          selected={selectedRekomendasi}
          setSelected={setSelectedRekomendasi}
        />

        <Divider />

        <ChecklistSection
          label="Perbaikan yang Dilakukan"
          help="Komponen yang diperbaiki / diganti (kalau ada)"
          options={checklists.perbaikan}
          selected={selectedPerbaikan}
          setSelected={setSelectedPerbaikan}
        />
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
          className="flex-1 min-h-[48px] rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition shadow-sm"
        >
          Selanjutnya →
        </button>
      </div>
    </section>
  );
}

// ──────────────────────────────────────────
function ChecklistSection({
  label,
  help,
  options,
  selected,
  setSelected,
}: {
  label: string;
  help?: string;
  options: ChecklistOption[];
  selected: string[];
  setSelected: (v: string[]) => void;
}) {
  function toggle(text_id: string) {
    setSelected(
      selected.includes(text_id)
        ? selected.filter((t) => t !== text_id)
        : [...selected, text_id],
    );
  }

  if (!options || options.length === 0) {
    return (
      <div>
        <p className="text-xs font-semibold text-neutral-700">{label}</p>
        <p className="text-[11px] text-neutral-400 mt-1 italic">
          Tidak ada opsi
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs font-semibold text-neutral-800">{label}</p>
      {help ? (
        <p className="text-[11px] text-neutral-500 mt-0.5 mb-2">{help}</p>
      ) : (
        <div className="mb-2" />
      )}

      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const checked = selected.includes(o.text_id);
          return (
            <button
              key={o.text_id}
              type="button"
              onClick={() => toggle(o.text_id)}
              className={[
                "rounded-full px-3 py-2 text-xs font-medium border transition min-h-[36px]",
                checked
                  ? "bg-amber-100 border-amber-400 text-amber-900"
                  : "bg-white border-neutral-300 text-neutral-700 hover:border-neutral-400",
              ].join(" ")}
              aria-pressed={checked}
            >
              <span className="inline-flex items-center gap-1.5">
                {checked ? (
                  <span aria-hidden="true" className="text-amber-700">✓</span>
                ) : null}
                <span>{o.text_id}</span>
              </span>
            </button>
          );
        })}
      </div>

      {selected.length > 0 ? (
        <p className="text-[10px] text-neutral-500 mt-2">
          {selected.length} dipilih
        </p>
      ) : null}
    </div>
  );
}

function Divider() {
  return <hr className="my-4 border-neutral-100" />;
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
