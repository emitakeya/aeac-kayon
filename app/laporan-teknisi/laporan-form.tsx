// app/laporan-teknisi/laporan-form.tsx
// Client Component. Owns step state, accumulating form state, and the submit
// chain. Each step is a presentational child that gets props + callbacks.

"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BCC_FIXED,
  MAX_PHOTOS_PER_SIDE,
  type LaporanInitialData,
  type LaporanOrder,
  type LaporanTechnician,
  type UnitCounts,
  ZERO_UNIT_COUNTS,
  compressImage,
  customerDisplayName,
  deriveUnitCounts,
  derivePengerjaan,
  generateInvoiceToken,
  normaliseTime,
  photoFilename,
  uploadPhoto,
} from "@/lib/laporan";
import Step1Order from "./step1-order";
import Step2Pengerjaan from "./step2-pengerjaan";
import Step3Kondisi from "./step3-kondisi";
import Step4Foto from "./step4-foto";
import Step5Review from "./step5-review";

// A staged photo before upload: keeps original + compressed + preview URL.
export type StagedPhoto = {
  file: File;
  compressed: Blob;
  preview: string; // ObjectURL — call URL.revokeObjectURL on remove
};

type SubmitStage =
  | "idle"
  | "compress"
  | "upload"
  | "report"
  | "order"
  | "token"
  | "emails"
  | "done"
  | "error";

const SUBMIT_STAGE_LABEL: Record<SubmitStage, string> = {
  idle:     "",
  compress: "Memproses foto...",
  upload:   "Mengunggah foto...",
  report:   "Menyimpan laporan...",
  order:    "Memperbarui status order...",
  token:    "Membuat link invoice...",
  emails:   "Mengirim email...",
  done:     "Selesai",
  error:    "Gagal",
};

const STEPS = ["Order", "Pengerjaan", "Kondisi", "Foto", "Review"] as const;

export default function LaporanForm({
  initial,
}: {
  initial: LaporanInitialData;
}) {
  // ───────────── Step state
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // ───────────── Step 1 state
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [selectedTechs, setSelectedTechs] = useState<string[]>(() => {
    const me = initial.current_user.technician_name;
    return me ? [me] : [];
  });
  const [jamMulai, setJamMulai] = useState<string>("");
  const [jamSelesai, setJamSelesai] = useState<string>("");

  // ───────────── Step 2 state
  // serviceCounts: name_id → qty. Primary source of truth; unitCounts are
  // derived on submit.
  const [serviceCounts, setServiceCounts] = useState<Record<string, number>>(
    {},
  );

  // ───────────── Step 3 state — checklist selections (arrays of text_id)
  const [selectedKondisi, setSelectedKondisi] = useState<string[]>([]);
  const [selectedTindakan, setSelectedTindakan] = useState<string[]>([]);
  const [selectedRekomendasi, setSelectedRekomendasi] = useState<string[]>([]);
  const [selectedPerbaikan, setSelectedPerbaikan] = useState<string[]>([]);

  // ───────────── Step 4 state — photos (objects with previews)
  const [photosBefore, setPhotosBefore] = useState<StagedPhoto[]>([]);
  const [photosAfter, setPhotosAfter] = useState<StagedPhoto[]>([]);

  // ───────────── Submit/result state
  const [submitStage, setSubmitStage] = useState<SubmitStage>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([]);
  const [resultLink, setResultLink] = useState<string | null>(null);

  // ───────────── Derived
  const selectedOrder: LaporanOrder | null = useMemo(
    () => initial.orders.find((o) => o.order_id === selectedOrderId) ?? null,
    [initial.orders, selectedOrderId],
  );

  const techByName = useMemo(() => {
    const m = new Map<string, LaporanTechnician>();
    for (const t of initial.technicians) m.set(t.name, t);
    return m;
  }, [initial.technicians]);

  const unitCounts: UnitCounts = useMemo(
    () => deriveUnitCounts(serviceCounts),
    [serviceCounts],
  );

  const pengerjaan: string[] = useMemo(
    () => derivePengerjaan(serviceCounts),
    [serviceCounts],
  );

  const isSubmitting = submitStage !== "idle" && submitStage !== "done" && submitStage !== "error";
  const isDone = submitStage === "done";

  // ───────────── Photo handlers (compress on add)
  async function addPhotos(side: "before" | "after", files: FileList | null) {
    if (!files || files.length === 0) return;
    const current = side === "before" ? photosBefore : photosAfter;
    const setter = side === "before" ? setPhotosBefore : setPhotosAfter;
    const room = MAX_PHOTOS_PER_SIDE - current.length;
    if (room <= 0) return;
    const toAdd = Array.from(files).slice(0, room);

    // Compress in parallel — typical phone photo ~3 MB; canvas resize is fast.
    const compressed = await Promise.all(
      toAdd.map(async (file) => {
        try {
          const blob = await compressImage(file);
          return {
            file,
            compressed: blob,
            preview: URL.createObjectURL(blob),
          } as StagedPhoto;
        } catch {
          // Fallback: use original file as blob
          return {
            file,
            compressed: file,
            preview: URL.createObjectURL(file),
          } as StagedPhoto;
        }
      }),
    );
    setter((prev) => [...prev, ...compressed].slice(0, MAX_PHOTOS_PER_SIDE));
  }

  function removePhoto(side: "before" | "after", idx: number) {
    const setter = side === "before" ? setPhotosBefore : setPhotosAfter;
    setter((prev) => {
      const next = prev.slice();
      const [removed] = next.splice(idx, 1);
      if (removed) URL.revokeObjectURL(removed.preview);
      return next;
    });
  }

  // ───────────── Step navigation with per-step validation

  function goToStep2() {
    if (!selectedOrderId) return alert("Silakan pilih Order ID.");
    if (selectedTechs.length === 0) return alert("Silakan pilih minimal 1 teknisi.");
    const jm = normaliseTime(jamMulai);
    const js = normaliseTime(jamSelesai);
    if (!jm || !js) return alert("Silakan isi jam mulai dan jam selesai.");
    setJamMulai(jm);
    setJamSelesai(js);
    setStep(2);
  }

  function goToStep3() {
    if (pengerjaan.length === 0)
      return alert("Silakan pilih minimal 1 jenis pekerjaan.");
    setStep(3);
  }

  function goToStep4() {
    setStep(4);
  }

  function goToStep5() {
    // Photos are optional per WP — don't block
    setStep(5);
  }

  // ───────────── Submit chain

  async function submit() {
    if (isSubmitting) return;
    if (!selectedOrder) {
      setSubmitError("Order tidak ditemukan.");
      setSubmitStage("error");
      return;
    }

    setSubmitError(null);
    setSubmitWarnings([]);
    const warnings: string[] = [];
    const supabase = createClient();

    const orderId = selectedOrder.order_id;
    const customer = selectedOrder.customer;

    try {
      // 1. Upload photos
      setSubmitStage("upload");
      const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      if (!SUPA_URL || !SUPA_ANON) {
        throw new Error("Supabase env vars tidak terkonfigurasi.");
      }

      const uploadedBefore: string[] = [];
      const uploadedAfter: string[] = [];

      // Sequential upload — keeps order deterministic and avoids overwhelming
      // slow connections on phones (typical AEAC use case).
      for (let i = 0; i < photosBefore.length; i++) {
        const url = await uploadPhoto(
          photosBefore[i].compressed,
          photoFilename(orderId, "before", i),
          SUPA_URL,
          SUPA_ANON,
        );
        uploadedBefore.push(url);
      }
      for (let i = 0; i < photosAfter.length; i++) {
        const url = await uploadPhoto(
          photosAfter[i].compressed,
          photoFilename(orderId, "after", i),
          SUPA_URL,
          SUPA_ANON,
        );
        uploadedAfter.push(url);
      }

      // 2. INSERT reports
      setSubmitStage("report");
      const { error: reportErr } = await supabase.from("reports").insert({
        order_id: orderId,
        technicians: selectedTechs,
        jam_mulai: jamMulai,
        jam_selesai: jamSelesai,
        pengerjaan,
        unit_split_standar_small: unitCounts.unit_split_standar_small,
        unit_split_standar_large: unitCounts.unit_split_standar_large,
        unit_split_semibongkar_small: unitCounts.unit_split_semibongkar_small,
        unit_split_semibongkar_large: unitCounts.unit_split_semibongkar_large,
        unit_cassette: unitCounts.unit_cassette,
        unit_ducting: unitCounts.unit_ducting,
        unit_perbaikan: unitCounts.unit_perbaikan,
        perbaikan_dilakukan: selectedPerbaikan,
        kondisi_sebelum: selectedKondisi,
        tindakan_dilakukan: selectedTindakan,
        opsi_rekomendasi: selectedRekomendasi,
        photo_sebelum: uploadedBefore,
        photo_sesudah: uploadedAfter,
        email_lang: "id",
      });
      if (reportErr) throw new Error(`Simpan laporan gagal: ${reportErr.message}`);

      // 3. PATCH orders → completed
      setSubmitStage("order");
      const { error: orderErr } = await supabase
        .from("orders")
        .update({ status: "completed" })
        .eq("order_id", orderId);
      if (orderErr) {
        // Non-fatal — finance can fix from /invoice-admin. Warn but continue.
        warnings.push(`Status order belum berhasil diubah: ${orderErr.message}`);
      }

      // 4. Generate token + INSERT invoice_tokens
      setSubmitStage("token");
      const token = generateInvoiceToken();
      const { error: tokenErr } = await supabase
        .from("invoice_tokens")
        .insert({ token, order_id: orderId });
      if (tokenErr) {
        // Without a token we can't email the invoice link, but the report
        // itself is saved. Warn and skip the invoice-link email.
        warnings.push(`Token invoice gagal dibuat: ${tokenErr.message}`);
      }

      const invoiceLink = tokenErr
        ? null
        : `https://kayon.aeac-service.id/tech-invoice/?token=${token}`;

      // 5. Emails — both non-fatal
      setSubmitStage("emails");

      // 5a. Report email → customer + BCC (fixed addrs + all tech emails)
      const allBcc = [
        ...BCC_FIXED,
        ...initial.technicians
          .map((t) => t.email)
          .filter((e): e is string => Boolean(e)),
      ];

      try {
        const reportPayload = {
          orderId,
          lang: "id",
          customerName: customer.name_roma ?? "",
          customerEmail: customer.email ?? "",
          apartment: customer.apartment ?? "",
          unit: customer.unit ?? "",
          scheduledDate: selectedOrder.scheduled_date ?? "",
          jamMulai,
          jamSelesai,
          technicians: selectedTechs.join(", "),
          bcc: allBcc.join(","),
          pengerjaan,
          unit_split_standar_small: unitCounts.unit_split_standar_small,
          unit_split_standar_large: unitCounts.unit_split_standar_large,
          unit_split_semibongkar_small: unitCounts.unit_split_semibongkar_small,
          unit_split_semibongkar_large: unitCounts.unit_split_semibongkar_large,
          unit_cassette: unitCounts.unit_cassette,
          unit_ducting: unitCounts.unit_ducting,
          unit_perbaikan: unitCounts.unit_perbaikan,
          kondisi: selectedKondisi,
          tindakan: selectedTindakan,
          rekomendasi: selectedRekomendasi,
          perbaikan: selectedPerbaikan,
          photoSebelum: uploadedBefore,
          photoSesudah: uploadedAfter,
        };
        const reportRes = await fetch("/api/email/send-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reportPayload),
        });
        if (!reportRes.ok) {
          warnings.push(`Email laporan ke customer gagal (HTTP ${reportRes.status}).`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warnings.push(`Email laporan ke customer gagal: ${msg}`);
      }

      // 5b. Invoice-link email → only techs in selectedTechs[] + CC aeac@maisonmap.com
      if (invoiceLink) {
        const techEmails = selectedTechs
          .map((name) => techByName.get(name)?.email)
          .filter((e): e is string => Boolean(e));
        if (techEmails.length === 0) {
          warnings.push(
            "Email invoice-link tidak dikirim: tidak ada alamat email untuk teknisi yang dipilih.",
          );
        } else {
          try {
            const linkPayload = {
              orderId,
              customerName: customer.name_roma ?? "",
              apartment: customer.apartment ?? "",
              unit: customer.unit ?? "",
              scheduledDate: selectedOrder.scheduled_date ?? "",
              technicians: selectedTechs.join(", "),
              invoiceLink,
              techEmails: techEmails.join(","),
              cc: "aeac@maisonmap.com",
            };
            const linkRes = await fetch("/api/email/send-invoice-link", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(linkPayload),
            });
            if (!linkRes.ok) {
              warnings.push(
                `Email invoice-link ke teknisi gagal (HTTP ${linkRes.status}).`,
              );
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            warnings.push(`Email invoice-link ke teknisi gagal: ${msg}`);
          }
        }
      }

      // 6. Done
      setSubmitWarnings(warnings);
      setResultLink(invoiceLink);
      setSubmitStage("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSubmitError(msg);
      setSubmitWarnings(warnings);
      setSubmitStage("error");
    }
  }

  function resetForm() {
    // Revoke preview URLs to avoid memory leaks
    [...photosBefore, ...photosAfter].forEach((p) =>
      URL.revokeObjectURL(p.preview),
    );
    setStep(1);
    setSelectedOrderId("");
    const me = initial.current_user.technician_name;
    setSelectedTechs(me ? [me] : []);
    setJamMulai("");
    setJamSelesai("");
    setServiceCounts({});
    setSelectedKondisi([]);
    setSelectedTindakan([]);
    setSelectedRekomendasi([]);
    setSelectedPerbaikan([]);
    setPhotosBefore([]);
    setPhotosAfter([]);
    setSubmitStage("idle");
    setSubmitError(null);
    setSubmitWarnings([]);
    setResultLink(null);
  }

  // ───────────── Success screen
  if (isDone) {
    return (
      <main className="max-w-[480px] mx-auto px-3 pb-16 pt-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <div className="text-5xl mb-3">✅</div>
          <h1 className="text-lg font-semibold text-emerald-900 mb-1">
            Laporan Berhasil Dikirim!
          </h1>
          <p className="text-sm text-emerald-800 leading-relaxed">
            Terima kasih. Laporan telah disimpan dan email telah dikirim
            ke customer.
          </p>

          {resultLink ? (
            <p className="text-xs text-emerald-700 mt-3 break-all">
              Link invoice telah dikirim ke email teknisi.
            </p>
          ) : null}

          {submitWarnings.length > 0 ? (
            <div className="mt-4 text-left rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold text-amber-900 mb-1">
                ⚠️ Catatan:
              </p>
              <ul className="text-xs text-amber-900 list-disc list-inside space-y-1">
                {submitWarnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="button"
            onClick={resetForm}
            className="mt-5 w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition"
          >
            Buat Laporan Baru
          </button>

          <a
            href="/dashboard"
            className="block mt-2 text-xs text-emerald-700 hover:text-emerald-900 underline"
          >
            ← Kembali ke dashboard
          </a>
        </div>
      </main>
    );
  }

  // ───────────── Main step layout
  return (
    <main className="max-w-[480px] mx-auto px-3 pb-16 pt-4">
      <Header step={step} />

      <Progress current={step} />

      <div className="mt-4">
        {step === 1 ? (
          <Step1Order
            orders={initial.orders}
            technicians={initial.technicians}
            selectedOrderId={selectedOrderId}
            setSelectedOrderId={setSelectedOrderId}
            selectedTechs={selectedTechs}
            setSelectedTechs={setSelectedTechs}
            jamMulai={jamMulai}
            setJamMulai={setJamMulai}
            jamSelesai={jamSelesai}
            setJamSelesai={setJamSelesai}
            onNext={goToStep2}
          />
        ) : null}

        {step === 2 ? (
          <Step2Pengerjaan
            services={initial.services}
            serviceCounts={serviceCounts}
            setServiceCounts={setServiceCounts}
            onBack={() => setStep(1)}
            onNext={goToStep3}
          />
        ) : null}

        {step === 3 ? (
          <Step3Kondisi
            checklists={initial.checklists}
            selectedKondisi={selectedKondisi}
            setSelectedKondisi={setSelectedKondisi}
            selectedTindakan={selectedTindakan}
            setSelectedTindakan={setSelectedTindakan}
            selectedRekomendasi={selectedRekomendasi}
            setSelectedRekomendasi={setSelectedRekomendasi}
            selectedPerbaikan={selectedPerbaikan}
            setSelectedPerbaikan={setSelectedPerbaikan}
            onBack={() => setStep(2)}
            onNext={goToStep4}
          />
        ) : null}

        {step === 4 ? (
          <Step4Foto
            photosBefore={photosBefore}
            photosAfter={photosAfter}
            onAdd={addPhotos}
            onRemove={removePhoto}
            onBack={() => setStep(3)}
            onNext={goToStep5}
          />
        ) : null}

        {step === 5 ? (
          <Step5Review
            order={selectedOrder}
            selectedTechs={selectedTechs}
            jamMulai={jamMulai}
            jamSelesai={jamSelesai}
            serviceCounts={serviceCounts}
            services={initial.services}
            selectedKondisi={selectedKondisi}
            selectedTindakan={selectedTindakan}
            selectedRekomendasi={selectedRekomendasi}
            selectedPerbaikan={selectedPerbaikan}
            photosBefore={photosBefore}
            photosAfter={photosAfter}
            submitStage={submitStage}
            submitStageLabel={SUBMIT_STAGE_LABEL[submitStage]}
            submitError={submitError}
            onBack={() => setStep(4)}
            onSubmit={submit}
          />
        ) : null}
      </div>
    </main>
  );
}

// ──────────────────────────────────────────
function Header({ step }: { step: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden mb-3">
      <div className="h-1.5 bg-gradient-to-r from-amber-500 to-amber-600" />
      <div className="px-4 py-3">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-1 text-[11px] text-neutral-600 hover:text-neutral-900"
        >
          ← Dashboard
        </a>
        <h1 className="text-base font-semibold text-neutral-900 leading-tight mt-1">
          📝 Laporan Teknisi
        </h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          Langkah {step} dari 5 · {STEPS[step - 1]}
        </p>
      </div>
    </section>
  );
}

function Progress({ current }: { current: 1 | 2 | 3 | 4 | 5 }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3 | 4 | 5;
        const isDone = n < current;
        const isActive = n === current;
        return (
          <div
            key={label}
            className="flex-1 flex flex-col items-center gap-1"
            aria-current={isActive ? "step" : undefined}
          >
            <div
              className={[
                "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold border transition",
                isDone
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : isActive
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-white text-neutral-400 border-neutral-300",
              ].join(" ")}
            >
              {isDone ? "✓" : n}
            </div>
            <div
              className={[
                "text-[10px] leading-tight text-center",
                isActive
                  ? "text-amber-700 font-semibold"
                  : isDone
                    ? "text-emerald-700"
                    : "text-neutral-500",
              ].join(" ")}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
