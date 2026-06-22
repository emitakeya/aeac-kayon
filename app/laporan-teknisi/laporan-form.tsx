// app/laporan-teknisi/laporan-form.tsx
// Client Component. Owns step state, accumulating form state, and the submit
// chain. Each step is a presentational child that gets props + callbacks.
//
// Submit now creates the customer invoice + Xendit payment link in the SAME
// action as the report (Option B: report submit → invoice + Xendit + customer
// email, hands-off). The invoice is editable on Step 5 before sending. On the
// success screen the technician is shown the payment QR to present on-site.

"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BCC_FIXED,
  MAX_PHOTOS_PER_SIDE,
  type LaporanInitialData,
  type LaporanOrder,
  type LaporanTechnician,
  type UnitCounts,
  compressImage,
  customerDisplayName,
  deriveUnitCounts,
  derivePengerjaan,
  generateInvoiceToken,
  normaliseTime,
  photoFilename,
  uploadPhoto,
} from "@/lib/laporan";
import {
  type LineItem,
  type ReportLike,
  type ServiceRow,
  buildInvoiceNumber,
  buildLineItemsFromReport,
  calcSubtotal,
  calcTotal,
  fmtRp,
} from "@/lib/invoices";
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
  | "xendit"
  | "invoice"
  | "emails"
  | "done"
  | "error";

const SUBMIT_STAGE_LABEL: Record<SubmitStage, string> = {
  idle:     "",
  compress: "Memproses foto...",
  upload:   "Mengunggah foto...",
  report:   "Menyimpan laporan...",
  order:    "Memperbarui status order...",
  token:    "Membuat token invoice...",
  xendit:   "Membuat link pembayaran...",
  invoice:  "Menyimpan invoice...",
  emails:   "Mengirim email...",
  done:     "Selesai",
  error:    "Gagal",
};

const STEPS = ["Order", "Pengerjaan", "Kondisi", "Foto", "Review"] as const;

// ── Invoice / payment constants (kept in sync with the tech-invoice modal) ──
const CC_EMAIL = "servisacapartemen@gmail.com";
const RECEIPT_WA = "+62 856-8310-419";
const BANK = {
  name: "BCA (KCU Kebayoran Baru)",
  account: "0700435393",
  holder: "Hafiz Fauzan",
};
const XENDIT_MIN_AMOUNT = 10000;

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

  // ───────────── Step 5 state — editable invoice
  const [invoiceItems, setInvoiceItems] = useState<LineItem[]>([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);
  // Tracks the report signature last used to (re)seed the invoice, so going
  // back-and-forth between steps doesn't clobber manual edits unless the
  // underlying work actually changed.
  const lastSeededSig = useRef<string | null>(null);

  // ───────────── Submit/result state
  const [submitStage, setSubmitStage] = useState<SubmitStage>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitWarnings, setSubmitWarnings] = useState<string[]>([]);
  const [resultPaymentUrl, setResultPaymentUrl] = useState<string | null>(null);
  const [resultInvoiceNumber, setResultInvoiceNumber] = useState<string>("");
  const [resultTotal, setResultTotal] = useState<number>(0);
  const [resultTokenLink, setResultTokenLink] = useState<string | null>(null);
  const [resultAutoCreateFailed, setResultAutoCreateFailed] =
    useState<boolean>(false);

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

  // Report-shaped object for buildLineItemsFromReport (shared with invoicing).
  const reportLike: ReportLike = useMemo(
    () => ({
      unit_split_standar_small: unitCounts.unit_split_standar_small,
      unit_split_standar_large: unitCounts.unit_split_standar_large,
      unit_split_semibongkar_small: unitCounts.unit_split_semibongkar_small,
      unit_split_semibongkar_large: unitCounts.unit_split_semibongkar_large,
      unit_cassette: unitCounts.unit_cassette,
      unit_ducting: unitCounts.unit_ducting,
      perbaikan_dilakukan: selectedPerbaikan,
      pengerjaan,
    }),
    [unitCounts, selectedPerbaikan, pengerjaan],
  );

  // @/lib/invoices works in ServiceRow[]; LaporanService has no numeric id, so
  // synthesise one (buildLineItemsFromReport only reads name_id + price).
  const invoiceServices: ServiceRow[] = useMemo(
    () =>
      initial.services.map((s, i) => ({
        id: i + 1,
        name_id: s.name_id,
        price: s.price,
        category: s.category,
      })),
    [initial.services],
  );

  const reportSignature = useMemo(
    () => JSON.stringify({ unitCounts, selectedPerbaikan, pengerjaan }),
    [unitCounts, selectedPerbaikan, pengerjaan],
  );

  const isSubmitting =
    submitStage !== "idle" && submitStage !== "done" && submitStage !== "error";
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

  // ───────────── Invoice seeding / reset
  function seedInvoiceFromReport() {
    setInvoiceItems(buildLineItemsFromReport(reportLike, invoiceServices));
    lastSeededSig.current = reportSignature;
  }

  // Card "Reset ke pekerjaan" — re-runs autofill and clears any discount.
  function resetInvoice() {
    setInvoiceItems(buildLineItemsFromReport(reportLike, invoiceServices));
    setInvoiceDiscount(0);
    lastSeededSig.current = reportSignature;
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
    // Photos are optional per WP — don't block.
    // Seed the invoice from the current work, but only when the underlying
    // report changed since the last seed (so manual edits survive a quick
    // hop back to Step 4 and forward again).
    if (lastSeededSig.current !== reportSignature) {
      seedInvoiceFromReport();
    }
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

    // Invoice figures (authoritative — from the editable Step 5 card).
    const invoiceNumber = buildInvoiceNumber(orderId);
    const subtotal = calcSubtotal(invoiceItems);
    const total = calcTotal(invoiceItems, invoiceDiscount);
    const customerName = customerDisplayName(customer);
    const customerEmail = (customer.email ?? "").trim();

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
      // The token is the credential the token-gated invoice route needs, and
      // also the fallback the tech uses to create the invoice manually on the
      // /tech-invoice page if auto-creation below fails.
      setSubmitStage("token");
      const token = generateInvoiceToken();
      const { error: tokenErr } = await supabase
        .from("invoice_tokens")
        .insert({ token, order_id: orderId });
      if (tokenErr) {
        warnings.push(`Token invoice gagal dibuat: ${tokenErr.message}`);
      }
      const tokenLink = tokenErr
        ? null
        : `https://kayon.aeac-service.id/tech-invoice/?token=${token}`;

      // ── Invoice creation (only possible with a token) ──
      let invoiceSaved = false;
      let xenditPaymentUrl: string | null = null;

      if (!tokenErr) {
        // 5. Xendit invoice (best-effort; falls back to bank transfer).
        let xenditInvoiceId: string | null = null;
        let xenditStatus: string | null = null;
        let paymentMethod = "bank_transfer";

        if (total >= XENDIT_MIN_AMOUNT && customerEmail) {
          setSubmitStage("xendit");
          try {
            const res = await fetch("/api/xendit/create-invoice", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId,
                invoiceNumber,
                amount: total,
                email: customerEmail.split(",")[0]?.trim(),
                customerName,
                description: `AEAC Invoice ${invoiceNumber}`,
                items: invoiceItems.map((i) => ({
                  name: i.name,
                  qty: i.qty,
                  price: i.price,
                })),
              }),
            });
            const json = await res.json();
            if (res.ok && json.ok && json.data?.invoice_url) {
              xenditInvoiceId = json.data.xendit_id ?? null;
              xenditPaymentUrl = json.data.invoice_url;
              xenditStatus = "PENDING";
              paymentMethod = "xendit";
            } else {
              warnings.push(
                "Link pembayaran Xendit gagal dibuat — gunakan transfer bank (info di email).",
              );
            }
          } catch {
            warnings.push(
              "Link pembayaran Xendit gagal dibuat — gunakan transfer bank (info di email).",
            );
          }
        }

        // 6. Save invoice via the TOKEN-GATED route (create_invoice_by_token).
        setSubmitStage("invoice");
        try {
          const payload = {
            invoice_number: invoiceNumber,
            order_id: orderId,
            customer_name: customerName,
            ordered_by_name: customer.name_kanji ?? "",
            customer_email: customerEmail,
            apartment: customer.apartment ?? "",
            unit: customer.unit ?? "",
            scheduled_date: selectedOrder.scheduled_date ?? "",
            technicians: selectedTechs,
            line_items: invoiceItems,
            subtotal,
            discount: invoiceDiscount,
            total_amount: total,
            status: "pending_payment",
            payment_method: paymentMethod,
            xendit_invoice_id: xenditInvoiceId,
            xendit_payment_url: xenditPaymentUrl,
            xendit_status: xenditStatus,
          };
          const res = await fetch("/api/tech-invoice/create-invoice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, payload }),
          });
          const json = await res.json();
          if (!res.ok || !json.ok) {
            throw new Error(json.error || `HTTP ${res.status}`);
          }
          invoiceSaved = true;
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          warnings.push(
            `Invoice gagal dibuat otomatis: ${msg}. Buat manual lewat link di bawah.`,
          );
        }
      }

      // 7. Emails
      setSubmitStage("emails");

      // 7a. Report email → customer + BCC (fixed addrs + all tech emails).
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
          customerEmail,
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

      // 7b. Invoice email → only when the invoice actually saved. Mirrors the
      // tech-invoice modal payload (endpoint "invoice" via the GAS proxy).
      if (invoiceSaved) {
        const bccTechEmails = selectedTechs
          .map((name) => techByName.get(name)?.email)
          .filter((e): e is string => Boolean(e));
        try {
          const emailPayload = {
            endpoint: "invoice",
            invoiceNumber,
            orderId,
            customerName,
            customerEmail,
            apartment: customer.apartment ?? "",
            unit: customer.unit ?? "",
            scheduledDate: selectedOrder.scheduled_date ?? "",
            technicians: selectedTechs.join(", "),
            jamMulai,
            jamSelesai,
            subtotal,
            discount: invoiceDiscount,
            total,
            cc: CC_EMAIL,
            bcc: bccTechEmails.join(","),
            bankName: BANK.name,
            bankAccount: BANK.account,
            bankHolder: BANK.holder,
            receiptWa: RECEIPT_WA,
            lineItems: invoiceItems,
            xenditPaymentUrl: xenditPaymentUrl ?? "",
          };
          const res = await fetch("/api/email/send-invoice", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(emailPayload),
          });
          if (!res.ok) {
            warnings.push(`Email invoice ke customer gagal (HTTP ${res.status}).`);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          warnings.push(`Email invoice ke customer gagal: ${msg}`);
        }
      }

      // 8. Done
      setSubmitWarnings(warnings);
      setResultPaymentUrl(xenditPaymentUrl);
      setResultInvoiceNumber(invoiceNumber);
      setResultTotal(total);
      setResultTokenLink(tokenLink);
      setResultAutoCreateFailed(!invoiceSaved);
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
    setInvoiceItems([]);
    setInvoiceDiscount(0);
    lastSeededSig.current = null;
    setSubmitStage("idle");
    setSubmitError(null);
    setSubmitWarnings([]);
    setResultPaymentUrl(null);
    setResultInvoiceNumber("");
    setResultTotal(0);
    setResultTokenLink(null);
    setResultAutoCreateFailed(false);
  }

  // ───────────── Success screen
  if (isDone) {
    const paymentOk = Boolean(resultPaymentUrl) && !resultAutoCreateFailed;
    return (
      <main className="max-w-[480px] mx-auto px-3 pb-16 pt-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <div className="text-5xl mb-3">{resultAutoCreateFailed ? "⚠️" : "✅"}</div>
          <h1 className="text-lg font-semibold text-emerald-900 mb-1">
            Laporan Berhasil Dikirim!
          </h1>
          <p className="text-sm text-emerald-800 leading-relaxed">
            {resultAutoCreateFailed
              ? "Laporan tersimpan & email laporan dikirim, tetapi invoice belum otomatis dibuat."
              : "Laporan & invoice telah dibuat. Email sudah dikirim ke customer."}
          </p>

          {resultInvoiceNumber ? (
            <p className="text-xs text-emerald-700 mt-2">
              <code className="font-mono bg-white/70 px-1.5 py-0.5 rounded">
                {resultInvoiceNumber}
              </code>{" "}
              · {fmtRp(resultTotal)}
            </p>
          ) : null}

          {/* Payment QR + button — present this to the customer on-site */}
          {paymentOk && resultPaymentUrl ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-white p-4 text-center">
              <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider mb-2">
                Pembayaran Customer
              </p>
              <PaymentQR url={resultPaymentUrl} />
              <p className="text-[11px] text-neutral-500 mt-2 mb-3">
                Tunjukkan QR ini ke customer untuk membayar langsung, atau buka
                halaman pembayaran:
              </p>
              <a
                href={resultPaymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold flex items-center justify-center transition"
              >
                💳 Buka Halaman Pembayaran
              </a>
            </div>
          ) : null}

          {/* Bank-transfer fallback — always available */}
          {!resultAutoCreateFailed ? (
            <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-3 text-left">
              <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                Atau transfer bank
              </p>
              <p className="text-xs text-neutral-700">{BANK.name}</p>
              <p className="text-sm font-mono font-semibold text-neutral-900">
                {BANK.account}
              </p>
              <p className="text-xs text-neutral-600">a.n. {BANK.holder}</p>
              <p className="text-[11px] text-neutral-500 mt-1">
                Kirim bukti transfer ke WA {RECEIPT_WA}.
              </p>
            </div>
          ) : null}

          {/* Manual invoice fallback when auto-create failed */}
          {resultAutoCreateFailed ? (
            resultTokenLink ? (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-left">
                <p className="text-xs font-semibold text-amber-900 mb-1">
                  Buat invoice manual
                </p>
                <p className="text-[11px] text-amber-800 mb-2">
                  Invoice otomatis gagal. Buka link ini untuk membuat &amp;
                  mengirim invoice secara manual:
                </p>
                <a
                  href={resultTokenLink}
                  className="block w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold flex items-center justify-center transition"
                >
                  🧾 Buka Halaman Buat Invoice
                </a>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-left">
                <p className="text-xs font-semibold text-red-900 mb-1">
                  Invoice perlu dibuat manual
                </p>
                <p className="text-[11px] text-red-800">
                  Token invoice tidak terbentuk. Minta admin/finance membuat
                  invoice untuk order ini lewat halaman Invoice Admin.
                </p>
              </div>
            )
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
            invoiceItems={invoiceItems}
            setInvoiceItems={setInvoiceItems}
            invoiceDiscount={invoiceDiscount}
            setInvoiceDiscount={setInvoiceDiscount}
            onResetInvoice={resetInvoice}
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
// Payment QR — uses api.qrserver.com with a graceful text fallback if the
// image fails to load (offline / blocked). The "Buka Halaman Pembayaran"
// button below it always works regardless.
function PaymentQR({ url }: { url: string }) {
  const [imgError, setImgError] = useState(false);
  const src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
    url,
  )}`;
  if (imgError) {
    return (
      <div className="mx-auto w-[180px] h-[180px] rounded-lg border border-dashed border-amber-300 bg-amber-50 flex items-center justify-center px-3">
        <p className="text-[11px] text-amber-800 text-center">
          QR tidak dapat dimuat. Gunakan tombol &quot;Buka Halaman
          Pembayaran&quot; di bawah.
        </p>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="QR pembayaran"
      width={180}
      height={180}
      onError={() => setImgError(true)}
      className="mx-auto w-[180px] h-[180px] rounded-lg border border-neutral-200 bg-white"
    />
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
