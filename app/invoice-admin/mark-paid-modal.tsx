// app/invoice-admin/mark-paid-modal.tsx
"use client";

import { useEffect, useState } from "react";
import {
  type BankCandidate,
  type BankCandidatesPayload,
  type InvoiceRow,
  type MarkPaidResult,
  fmtRp,
  fmtTanggalShort,
  fmtJarakHari,
} from "@/lib/invoices";

const VISIBLE_BY_DEFAULT = 3;

export default function MarkPaidModal({
  invoice,
  onClose,
  onDone,
}: {
  invoice: InvoiceRow;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [payload, setPayload] = useState<BankCandidatesPayload | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ─── Load candidates ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch("/api/invoice-admin/bank-candidates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoice_id: invoice.id }),
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error || `HTTP ${res.status}`);
        }
        if (cancelled) return;

        const data = json.data as BankCandidatesPayload;
        setPayload(data);

        // Pre-select the exact match when it is unambiguous.
        const exact = data.candidates.filter((c) => c.exact_match);
        if (exact.length === 1) setSelected(exact[0].bank_row_id);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [invoice.id]);

  // ─── Escape to close ──────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  async function handleConfirm() {
    if (selected === null) {
      setSubmitError("Pilih dulu transaksi buku bank.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/invoice-admin/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: invoice.id,
          bank_row_id: selected,
          bank_source: "MMP",
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      const data = json.data as MarkPaidResult;
      const cr = data.commission_result;

      let msg = `✓ ${invoice.invoice_number} ditandai LUNAS.`;
      if (data.paid_date) msg += `\nTanggal lunas: ${data.paid_date}`;
      if (data.bank?.bank_code) msg += `\nBank: ${data.bank.bank_code}`;

      if (cr?.success) {
        const tech = cr.tech_commissions_created ?? 0;
        const mkt = cr.marketing_result?.created ? 1 : 0;
        msg += `\n\nKomisi dibuat: ${tech} teknisi, ${mkt} marketing.`;
        if (cr.tech_skipped && cr.tech_skipped.length > 0) {
          msg += `\nTeknisi dilewati: ${cr.tech_skipped.join(", ")}`;
        }
      } else if (cr?.error) {
        msg += `\n\n⚠ Komisi gagal dibuat: ${cr.error}`;
      }

      alert(msg);
      await onDone();
      onClose();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const candidates = payload?.candidates ?? [];
  const visible = showAll ? candidates : candidates.slice(0, VISIBLE_BY_DEFAULT);
  const hiddenCount = candidates.length - visible.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Tandai lunas"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-lg">
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-200">
          <h2 className="text-base font-semibold text-neutral-900">
            Tandai lunas
          </h2>
          <p className="text-xs text-neutral-600 mt-0.5">
            Pilih transaksi buku bank yang menutup invoice ini
          </p>
        </div>

        {/* Invoice summary */}
        <div className="px-4 py-3 bg-neutral-50 border-b border-neutral-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <code className="text-[11px] font-mono text-neutral-600">
                {invoice.invoice_number}
              </code>
              <p className="text-sm font-semibold text-neutral-900 mt-0.5 truncate">
                {invoice.customer_name || "—"}
              </p>
              <p className="text-xs text-neutral-600 mt-0.5 truncate">
                {(invoice.technicians ?? []).join(", ") || "—"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-base font-bold text-neutral-900 leading-none">
                {fmtRp(invoice.total_amount)}
              </p>
              {payload?.invoice.work_date ? (
                <p className="text-[11px] text-neutral-600 mt-1">
                  Kerja {fmtTanggalShort(payload.invoice.work_date)}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Candidate list */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-neutral-600">
              Buku bank MMP &middot; Sales AEAC
            </p>
            {candidates.length > 0 ? (
              <span className="text-[11px] text-neutral-500">
                {candidates.length} transaksi
              </span>
            ) : null}
          </div>

          {loading ? (
            <p className="text-sm text-neutral-600 py-6 text-center">
              Memuat transaksi bank...
            </p>
          ) : loadError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">
                Gagal memuat transaksi bank: {loadError}
              </p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-semibold text-amber-900">
                Tidak ada transaksi yang cocok
              </p>
              <p className="text-xs text-amber-800 mt-1">
                Belum ada pemasukan Sales AEAC di buku bank sejak tanggal
                pengerjaan. Kemungkinan invoice ini memang belum dibayar, atau
                buku bank belum diimpor Finance.
              </p>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {visible.map((c) => (
                  <CandidateRow
                    key={c.bank_row_id}
                    candidate={c}
                    selected={selected === c.bank_row_id}
                    onSelect={() => {
                      setSelected(c.bank_row_id);
                      setSubmitError(null);
                    }}
                  />
                ))}
              </ul>

              {hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="mt-2 w-full rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold px-3 py-2 transition"
                >
                  Tampilkan semua {candidates.length} transaksi
                </button>
              ) : null}
            </>
          )}

          {submitError ? (
            <p className="text-xs text-red-700 mt-2">{submitError}</p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-neutral-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-sm font-semibold px-3 py-1.5 active:scale-[0.98] disabled:opacity-50 transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || selected === null || candidates.length === 0}
            className="rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-sm font-semibold px-3 py-1.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? "Memproses..." : "Tandai lunas"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
function CandidateRow({
  candidate,
  selected,
  onSelect,
}: {
  candidate: BankCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={`w-full text-left rounded-lg border p-3 transition ${
          selected
            ? "border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300"
            : "border-neutral-200 bg-white hover:bg-neutral-50"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <code className="text-[11px] font-mono text-neutral-600">
              {candidate.bank_code}
            </code>
            <p className="text-sm text-neutral-900 mt-0.5 break-words">
              {candidate.transaction_desc || "—"}
            </p>
            <p className="text-[11px] text-neutral-600 mt-0.5">
              {fmtTanggalShort(candidate.tanggal)}
              {candidate.days_after_work != null
                ? ` · ${fmtJarakHari(candidate.days_after_work)}`
                : ""}
              {candidate.already_linked > 0
                ? ` · sudah dipakai ${candidate.already_linked} invoice`
                : ""}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-neutral-900 leading-none">
              {fmtRp(candidate.amount_in)}
            </p>
            {candidate.exact_match ? (
              <span className="inline-block mt-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                nominal cocok
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  );
}
