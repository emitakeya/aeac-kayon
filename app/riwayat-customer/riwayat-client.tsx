'use client';

// app/riwayat-customer/riwayat-client.tsx
// /riwayat-customer — customer service-history viewer + PDF export.
//
// Flow: search name/email/apartment → multi-select customer rows (handles the
// duplicate-rows-per-booking reality; e.g. Daitokyo = 22 rows) → period →
// optional "Belum bayar saja" → visit list → download per-visit PDF or one
// combined PDF.
//
// PDF generation is 100% client-side (@react-pdf/renderer, dynamically
// imported so it stays out of the main bundle). Photos are fetched straight
// from the public report-photos bucket during rendering, so PDFs with many
// photos can take ~10–30s and produce large files — the button shows progress.

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  type CustomerSearchRow,
  type CustomerHistory,
  type HistoryVisit,
  fmtDateID,
  fmtRupiah,
  fmtSession,
  invoiceStatusLabel,
  cleanServiceLabel,
  periodFromDate,
  displayName,
} from '@/lib/riwayat';

type Period = 1 | 3 | 6 | 12;
const PERIODS: Period[] = [1, 3, 6, 12];

function slugify(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'customer';
}

function todayStamp(): string {
  const d = new Date();
  return (
    d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0')
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function RiwayatClient() {
  const supabase = createClient();

  // Search
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<CustomerSearchRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchError, setSearchError] = useState<string | null>(null);

  // History
  const [period, setPeriod] = useState<Period>(6);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [history, setHistory] = useState<CustomerHistory | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // PDF
  const [pdfBusy, setPdfBusy] = useState<string | null>(null); // 'all' | order_id
  const [pdfError, setPdfError] = useState<string | null>(null);

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setSearchError(null);
    setResults(null);
    setSelected(new Set());
    setHistory(null);
    const { data, error } = await supabase.rpc('search_customers_for_history', {
      p_query: q,
    });
    setSearching(false);
    if (error) {
      setSearchError(error.message);
      return;
    }
    setResults((data ?? []) as CustomerSearchRow[]);
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setHistory(null);
  }

  function toggleAll() {
    if (!results) return;
    setSelected((prev) =>
      prev.size === results.length ? new Set() : new Set(results.map((r) => r.id)),
    );
    setHistory(null);
  }

  async function loadHistory(nextPeriod?: Period, nextUnpaidOnly?: boolean) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const p = nextPeriod ?? period;
    const u = nextUnpaidOnly ?? unpaidOnly;
    setLoadingHistory(true);
    setHistoryError(null);
    const { data, error } = await supabase.rpc('get_customer_history', {
      p_customer_ids: ids,
      p_from: periodFromDate(p),
      p_unpaid_only: u,
    });
    setLoadingHistory(false);
    if (error) {
      setHistoryError(error.message);
      return;
    }
    setHistory(data as CustomerHistory);
  }

  function changePeriod(p: Period) {
    setPeriod(p);
    if (history) void loadHistory(p, undefined);
  }

  function changeUnpaidOnly(v: boolean) {
    setUnpaidOnly(v);
    if (history) void loadHistory(undefined, v);
  }

  async function makePdf(mode: 'combined' | 'single', visit?: HistoryVisit) {
    if (!history) return;
    const key = mode === 'combined' ? 'all' : visit!.order_id;
    setPdfBusy(key);
    setPdfError(null);
    try {
      const [{ pdf }, { RiwayatPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./pdf-doc'),
      ]);
      const visits = mode === 'combined' ? history.visits : [visit!];
      const summary =
        mode === 'combined'
          ? history.summary
          : {
              ...history.summary,
              visit_count: 1,
              total_periode: visit!.total_amount,
              total_belum_dibayar: visit!.is_unpaid ? visit!.total_amount : 0,
              unpaid_count: visit!.is_unpaid ? 1 : 0,
            };
      const blob = await pdf(
        <RiwayatPDF
          customers={history.customers}
          visits={visits}
          summary={summary}
          mode={mode}
        />,
      ).toBlob();
      const name = slugify(displayName(history.customers));
      const filename =
        mode === 'combined'
          ? `riwayat-aeac-${name}-${todayStamp()}.pdf`
          : `laporan-${visit!.order_id}.pdf`;
      downloadBlob(blob, filename);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'Gagal membuat PDF');
    } finally {
      setPdfBusy(null);
    }
  }

  const summary = history?.summary;

  return (
    <main className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Riwayat Customer</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Laporan servis &amp; invoice per customer — unduh PDF
          </p>
        </div>
        <Link
          href="/dashboard"
          className="text-xs text-neutral-500 hover:text-neutral-900 border border-neutral-200 rounded-lg px-3 py-1.5 bg-white"
        >
          ← Dashboard
        </Link>
      </header>

      {/* ── Search ─────────────────────────── */}
      <section className="bg-white border border-neutral-200 rounded-2xl p-4 mb-3 shadow-sm">
        <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-2">
          Cari customer
        </p>
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            placeholder="Nama, email, atau apartemen…"
            className="flex-1 border border-neutral-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-aeac-amber-400"
          />
          <button
            onClick={runSearch}
            disabled={searching || query.trim().length < 2}
            className="bg-neutral-900 text-white text-sm font-semibold rounded-xl px-4 py-2 disabled:opacity-40"
          >
            {searching ? '…' : 'Cari'}
          </button>
        </div>

        {searchError && (
          <p className="text-xs text-red-600 mt-2">Gagal mencari: {searchError}</p>
        )}

        {results && results.length === 0 && (
          <p className="text-xs text-neutral-500 mt-3">
            Tidak ada customer yang cocok dengan “{query.trim()}”.
          </p>
        )}

        {results && results.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] text-neutral-500">
                {results.length} baris customer · {selected.size} dipilih
              </p>
              <button
                onClick={toggleAll}
                className="text-[11px] font-semibold text-neutral-700 border border-neutral-300 rounded-lg px-2 py-1 bg-white hover:bg-neutral-50"
              >
                {selected.size === results.length ? 'Batal pilih semua' : 'Pilih semua'}
              </button>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {results.map((r) => {
                const sel = selected.has(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() => toggleRow(r.id)}
                    className={`w-full text-left flex items-center justify-between gap-2 border rounded-xl px-3 py-2 transition ${
                      sel
                        ? 'border-aeac-amber-500 bg-aeac-amber-50'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-neutral-900 truncate">
                        {r.name_roma || r.name_kanji || '(tanpa nama)'}
                      </div>
                      <div className="text-[11px] text-neutral-500 truncate">
                        {[r.apartment, r.unit && `Unit ${r.unit}`, r.email]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {r.order_count} order
                        {r.unpaid_count > 0 && (
                          <span className="text-amber-700 font-medium">
                            {' '}
                            · {r.unpaid_count} belum bayar
                          </span>
                        )}
                        {r.last_service_date && (
                          <span> · terakhir {fmtDateID(r.last_service_date)}</span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center text-[11px] font-bold ${
                        sel
                          ? 'border-aeac-amber-600 bg-aeac-amber-500 text-black'
                          : 'border-neutral-300 text-transparent'
                      }`}
                    >
                      ✓
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* ── Period + filter + fetch ────────── */}
      {selected.size > 0 && (
        <section className="bg-white border border-neutral-200 rounded-2xl p-4 mb-3 shadow-sm">
          <p className="text-[11px] text-neutral-500 uppercase tracking-wider mb-2">
            Periode
          </p>
          <div className="flex gap-1.5 mb-3">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => changePeriod(p)}
                className={`flex-1 text-xs font-medium rounded-full border py-1.5 transition ${
                  period === p
                    ? 'bg-neutral-900 text-white border-neutral-900'
                    : 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-50'
                }`}
              >
                {p} bln
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-[13px] text-neutral-700 select-none">
            <input
              type="checkbox"
              checked={unpaidOnly}
              onChange={(e) => changeUnpaidOnly(e.target.checked)}
              className="w-4 h-4 accent-amber-500"
            />
            Belum bayar saja
          </label>

          {!history && (
            <button
              onClick={() => loadHistory()}
              disabled={loadingHistory}
              className="w-full mt-3 bg-neutral-900 text-white text-sm font-semibold rounded-xl py-2.5 disabled:opacity-40"
            >
              {loadingHistory ? 'Memuat…' : 'Tampilkan Riwayat'}
            </button>
          )}
          {historyError && (
            <p className="text-xs text-red-600 mt-2">Gagal memuat: {historyError}</p>
          )}
        </section>
      )}

      {/* ── History ────────────────────────── */}
      {history && summary && (
        <section className="bg-white border border-neutral-200 rounded-2xl p-4 mb-3 shadow-sm">
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-[11px] text-neutral-500 uppercase tracking-wider">
              {summary.visit_count} kunjungan
            </p>
            {loadingHistory && <span className="text-[11px] text-neutral-400">memuat…</span>}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[13px]">
            <div>
              <span className="text-neutral-500">Total periode:</span>{' '}
              <span className="font-mono font-semibold">{fmtRupiah(summary.total_periode)}</span>
            </div>
            {summary.total_belum_dibayar > 0 && (
              <div className="text-red-700">
                <span>Belum dibayar ({summary.unpaid_count}):</span>{' '}
                <span className="font-mono font-semibold">
                  {fmtRupiah(summary.total_belum_dibayar)}
                </span>
              </div>
            )}
          </div>

          {history.visits.length === 0 && (
            <p className="text-xs text-neutral-500">
              Tidak ada kunjungan pada periode ini.
            </p>
          )}

          <div className="space-y-2">
            {history.visits.map((v) => {
              const st = invoiceStatusLabel(v.invoice?.status);
              return (
                <div key={v.order_id} className="border border-neutral-200 rounded-xl p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-[13px] font-semibold text-neutral-900">
                      {fmtDateID(v.service_date)}
                      {v.session ? (
                        <span className="text-neutral-400 font-normal">
                          {' '}
                          · {fmtSession(v.session)}
                        </span>
                      ) : null}
                    </div>
                    <div className="font-mono text-[10px] text-neutral-500">{v.order_id}</div>
                  </div>
                  <div className="text-xs text-neutral-600 mt-0.5">
                    {(v.services ?? []).map(cleanServiceLabel).join(' · ') || '—'}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold">
                        {v.invoice ? fmtRupiah(v.total_amount) : '—'}
                      </span>
                      {v.invoice && (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            st.paid
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : 'text-amber-800 bg-amber-50 border-amber-300'
                          }`}
                        >
                          {st.label}
                        </span>
                      )}
                      {!v.has_report && (
                        <span className="text-[10px] text-neutral-400">tanpa laporan</span>
                      )}
                    </div>
                    <button
                      onClick={() => makePdf('single', v)}
                      disabled={pdfBusy !== null}
                      className="text-[11px] font-semibold text-neutral-800 border border-neutral-300 rounded-lg px-2.5 py-1 bg-white hover:bg-neutral-50 disabled:opacity-40"
                    >
                      {pdfBusy === v.order_id ? 'Menyusun…' : 'Unduh PDF'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {history.visits.length > 0 && (
            <>
              <button
                onClick={() => makePdf('combined')}
                disabled={pdfBusy !== null}
                className="w-full mt-4 bg-aeac-amber-500 text-black text-sm font-bold rounded-xl py-3 disabled:opacity-50"
              >
                {pdfBusy === 'all'
                  ? 'Menyusun PDF — mengambil foto…'
                  : `⬇ Unduh Semua — 1 PDF (${history.visits.length} kunjungan)`}
              </button>
              <p className="text-[11px] text-neutral-500 text-center mt-1.5">
                PDF berisi semua foto sebelum/sesudah — ukuran file bisa besar.
              </p>
            </>
          )}

          {pdfError && (
            <p className="text-xs text-red-600 mt-2">Gagal membuat PDF: {pdfError}</p>
          )}
        </section>
      )}
    </main>
  );
}
