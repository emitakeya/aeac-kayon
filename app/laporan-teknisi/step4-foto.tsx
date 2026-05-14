// app/laporan-teknisi/step4-foto.tsx
// Step 4: photo upload. Two sides: before / after. Max 4 each.
// Photos are compressed on add (handled by parent's addPhotos callback).
// `capture="environment"` opens the rear camera on phones; `multiple` lets
// the user pick from gallery too.

"use client";

import { useRef } from "react";
import { MAX_PHOTOS_PER_SIDE } from "@/lib/laporan";
import type { StagedPhoto } from "./laporan-form";

export default function Step4Foto({
  photosBefore,
  photosAfter,
  onAdd,
  onRemove,
  onBack,
  onNext,
}: {
  photosBefore: StagedPhoto[];
  photosAfter: StagedPhoto[];
  onAdd: (side: "before" | "after", files: FileList | null) => void | Promise<void>;
  onRemove: (side: "before" | "after", idx: number) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <section className="space-y-4">
      <Card
        title="Foto"
        subtitle={`Upload foto sebelum dan sesudah pengerjaan (maks ${MAX_PHOTOS_PER_SIDE} masing-masing). Opsional.`}
      >
        <PhotoSide
          label="Foto Sebelum"
          side="before"
          photos={photosBefore}
          onAdd={onAdd}
          onRemove={onRemove}
        />

        <hr className="my-5 border-neutral-100" />

        <PhotoSide
          label="Foto Sesudah"
          side="after"
          photos={photosAfter}
          onAdd={onAdd}
          onRemove={onRemove}
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
function PhotoSide({
  label,
  side,
  photos,
  onAdd,
  onRemove,
}: {
  label: string;
  side: "before" | "after";
  photos: StagedPhoto[];
  onAdd: (side: "before" | "after", files: FileList | null) => void | Promise<void>;
  onRemove: (side: "before" | "after", idx: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const full = photos.length >= MAX_PHOTOS_PER_SIDE;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-neutral-800">{label}</p>
        <p className="text-[10px] text-neutral-500">
          {photos.length} / {MAX_PHOTOS_PER_SIDE}
        </p>
      </div>

      {/* Hidden input — triggered by the tile below */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={async (e) => {
          await onAdd(side, e.target.files);
          // Reset so the same file can be re-picked after a remove
          if (inputRef.current) inputRef.current.value = "";
        }}
      />

      <div className="grid grid-cols-2 gap-2">
        {photos.map((p, i) => (
          <div
            key={i}
            className="relative aspect-square rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.preview}
              alt={`${label} ${i + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(side, i)}
              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/65 hover:bg-black/80 text-white text-xs font-bold flex items-center justify-center backdrop-blur-sm transition"
              aria-label={`Hapus foto ${i + 1}`}
            >
              ×
            </button>
            <span className="absolute bottom-1.5 left-1.5 text-[10px] font-medium text-white bg-black/60 rounded px-1.5 py-0.5">
              {i + 1}
            </span>
          </div>
        ))}

        {!full ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-xl border-2 border-dashed border-neutral-300 hover:border-amber-400 hover:bg-amber-50 transition flex flex-col items-center justify-center gap-1 text-neutral-500 hover:text-amber-700"
          >
            <span className="text-2xl">📷</span>
            <span className="text-[11px] font-medium">Tambah foto</span>
          </button>
        ) : null}
      </div>

      {full ? (
        <p className="text-[11px] text-neutral-500 italic mt-2">
          Maksimum {MAX_PHOTOS_PER_SIDE} foto sudah tercapai. Hapus satu untuk
          menambah yang baru.
        </p>
      ) : null}
    </div>
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
