// app/riwayat-customer/pdf-doc.tsx
// @react-pdf/renderer document for the customer-facing "Riwayat Servis AC" PDF.
// Identity: mustard #E8CE55 / ink #0B0B0B / Anton display / Archivo body /
// Martian Mono numerals. Ink rules, zero radius, NO white type on mustard.
//
// Two modes:
//   'combined' — page 1 summary (ringkasan + totals) then one section per visit
//   'single'   — one visit only, no summary page
//
// This module is ONLY loaded via dynamic import in the client (see
// riwayat-client.tsx) so react-pdf never enters the server bundle.

import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { registerPdfFonts } from './pdf-fonts';
import {
  type HistoryCustomer,
  type HistoryVisit,
  type HistorySummary,
  fmtDateID,
  fmtDateIDLong,
  fmtPaidDate,
  cleanServiceLabel,
  fmtRupiah,
  fmtSession,
  invoiceStatusLabel,
  unitLines,
  normaliseLineItem,
  displayName,
  distinctJoin,
} from '@/lib/riwayat';

registerPdfFonts();

// ── Identity tokens ─────────────────────────
const MUSTARD = '#E8CE55';
const INK = '#0B0B0B';
const PAPER = '#FFFFFF';
const ALERT = '#8F1D14';

const WA_CONTACT = 'aeac-service.id';

const s = StyleSheet.create({
  page: {
    backgroundColor: PAPER,
    color: INK,
    fontFamily: 'Archivo',
    fontSize: 10,
    paddingBottom: 64,
  },

  // Header bands
  band: {
    backgroundColor: MUSTARD,
    borderBottomWidth: 2.5,
    borderBottomColor: INK,
    paddingHorizontal: 40,
    paddingTop: 24,
    paddingBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  logo: { width: 132, height: 44, objectFit: 'contain' },
  docTitle: { fontFamily: 'Anton', fontSize: 18, textAlign: 'right' },
  docMeta: {
    fontFamily: 'MartianMono',
    fontSize: 7.5,
    textAlign: 'right',
    marginTop: 4,
  },

  visitBand: {
    backgroundColor: MUSTARD,
    borderBottomWidth: 2.5,
    borderBottomColor: INK,
    paddingHorizontal: 40,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  visitDate: { fontFamily: 'Anton', fontSize: 17 },
  visitMeta: { fontFamily: 'MartianMono', fontSize: 8 },

  body: { paddingHorizontal: 40, paddingTop: 22 },

  // Customer block (summary page)
  custRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 2,
    borderBottomColor: INK,
    paddingBottom: 14,
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  custName: { fontFamily: 'Anton', fontSize: 18 },
  custLine: { fontSize: 9.5, marginTop: 2 },
  periodVal: { fontFamily: 'MartianMono', fontSize: 9, fontWeight: 600 },
  right: { textAlign: 'right', alignItems: 'flex-end' },

  // Section titles
  secTitle: {
    fontFamily: 'Anton',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
    paddingBottom: 3,
    marginBottom: 6,
  },
  sec: { marginBottom: 16 },

  // Tables
  th: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 0.75,
    borderBottomColor: INK,
    paddingVertical: 5,
  },
  trHead: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
    paddingBottom: 3,
  },
  trTotal: {
    flexDirection: 'row',
    borderTopWidth: 2,
    borderTopColor: INK,
    paddingTop: 6,
    marginTop: -0.75,
  },
  num: { fontFamily: 'MartianMono', fontSize: 8.5, textAlign: 'right' },
  mono: { fontFamily: 'MartianMono', fontSize: 8 },
  bold: { fontWeight: 700 },
  alert: { color: ALERT },

  // Lists
  li: { flexDirection: 'row', marginBottom: 2 },
  liDash: { width: 12 },
  liText: { flex: 1, fontSize: 9.5, lineHeight: 1.45 },

  twoCol: { flexDirection: 'row', gap: 24 },
  col: { flex: 1 },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoCell: { width: '31.6%' },
  photoTag: {
    backgroundColor: INK,
    color: PAPER,
    fontSize: 6.5,
    fontWeight: 700,
    letterSpacing: 0.8,
    paddingVertical: 2,
    paddingHorizontal: 6,
    alignSelf: 'flex-start',
  },
  photo: {
    width: '100%',
    height: 106,
    objectFit: 'cover',
    borderWidth: 1.2,
    borderColor: INK,
  },

  // Paid stamp
  stamp: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderColor: INK,
    paddingVertical: 3,
    paddingHorizontal: 12,
    marginTop: 10,
    transform: 'rotate(-3deg)',
  },
  stampText: { fontFamily: 'Anton', fontSize: 12, letterSpacing: 0.8 },
  unpaidNote: {
    borderWidth: 2,
    borderColor: ALERT,
    color: ALERT,
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 12,
    marginTop: 10,
    fontFamily: 'Anton',
    fontSize: 12,
    letterSpacing: 0.8,
    transform: 'rotate(-3deg)',
  },

  // Footer
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1.5,
    borderTopColor: INK,
    backgroundColor: PAPER,
    paddingHorizontal: 40,
    paddingVertical: 9,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: { fontSize: 7.5 },
  footerPage: { fontFamily: 'MartianMono', fontSize: 7.5 },
});

// Summary table column widths
const C_DATE = { width: '15%' };
const C_OID = { width: '25%' };
const C_SVC = { width: '30%' };
const C_TOT = { width: '17%' };
const C_STA = { width: '13%', textAlign: 'right' as const };

// Invoice table column widths
const I_NAME = { width: '52%' };
const I_QTY = { width: '10%' };
const I_PRICE = { width: '19%' };
const I_AMT = { width: '19%' };

function Footer() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>
        AEAC — Servis AC di Jakarta · {WA_CONTACT}
      </Text>
      <Text
        style={s.footerPage}
        render={({ pageNumber, totalPages }) => `Hal. ${pageNumber}/${totalPages}`}
      />
    </View>
  );
}

function DashList({ items }: { items: string[] }) {
  return (
    <View>
      {items.map((t, idx) => (
        <View key={idx} style={s.li}>
          <Text style={s.liDash}>—</Text>
          <Text style={s.liText}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

function VisitSection({ visit, breakBefore }: { visit: HistoryVisit; breakBefore: boolean }) {
  const r = visit.report;
  const inv = visit.invoice;
  const status = invoiceStatusLabel(inv?.status);

  const layanan =
    r && unitLines(r).length > 0
      ? unitLines(r)
      : (visit.services ?? []).map(cleanServiceLabel);

  const techLine = r?.technicians?.length ? ` · Teknisi: ${r.technicians.join(', ')}` : '';
  const sessionLabel = visit.session ? ` (${fmtSession(visit.session)})` : '';

  const photosSebelum = r?.photo_sebelum ?? [];
  const photosSesudah = r?.photo_sesudah ?? [];

  return (
    <View break={breakBefore}>
      <View style={s.visitBand}>
        <Text style={s.visitDate}>
          {fmtDateIDLong(visit.service_date)}
          {sessionLabel}
        </Text>
        <Text style={s.visitMeta}>
          {visit.order_id}
          {techLine}
        </Text>
      </View>

      <View style={s.body}>
        {layanan.length > 0 && (
          <View style={s.sec}>
            <Text style={s.secTitle}>Layanan</Text>
            <DashList items={layanan} />
          </View>
        )}

        {r && (r.kondisi_sebelum?.length || r.tindakan_dilakukan?.length) ? (
          <View style={[s.sec, s.twoCol]}>
            <View style={s.col}>
              <Text style={s.secTitle}>Kondisi Ditemukan</Text>
              <DashList items={r.kondisi_sebelum ?? []} />
            </View>
            <View style={s.col}>
              <Text style={s.secTitle}>Tindakan</Text>
              <DashList items={r.tindakan_dilakukan ?? []} />
            </View>
          </View>
        ) : null}

        {r?.perbaikan_dilakukan?.length ? (
          <View style={s.sec}>
            <Text style={s.secTitle}>Perbaikan Dilakukan</Text>
            <DashList items={r.perbaikan_dilakukan} />
          </View>
        ) : null}

        {r?.opsi_rekomendasi?.length ? (
          <View style={s.sec}>
            <Text style={s.secTitle}>Rekomendasi</Text>
            <DashList items={r.opsi_rekomendasi} />
          </View>
        ) : null}

        {photosSebelum.length + photosSesudah.length > 0 && (
          <View style={s.sec}>
            <Text style={s.secTitle}>Foto Sebelum / Sesudah</Text>
            <View style={s.photoGrid}>
              {photosSebelum.map((url, idx) => (
                <View key={`b${idx}`} style={s.photoCell} wrap={false}>
                  <Text style={s.photoTag}>SEBELUM</Text>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image style={s.photo} src={url} />
                </View>
              ))}
              {photosSesudah.map((url, idx) => (
                <View key={`a${idx}`} style={s.photoCell} wrap={false}>
                  <Text style={s.photoTag}>SESUDAH</Text>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image style={s.photo} src={url} />
                </View>
              ))}
            </View>
          </View>
        )}

        {inv ? (
          <View style={s.sec} wrap={false}>
            <Text style={s.secTitle}>
              Invoice{inv.invoice_number ? ` — ${inv.invoice_number}` : ''}
            </Text>
            <View style={s.trHead}>
              <Text style={[s.th, I_NAME]}>Item</Text>
              <Text style={[s.th, I_QTY, { textAlign: 'right' }]}>Qty</Text>
              <Text style={[s.th, I_PRICE, { textAlign: 'right' }]}>Harga</Text>
              <Text style={[s.th, I_AMT, { textAlign: 'right' }]}>Jumlah</Text>
            </View>
            {(inv.line_items ?? []).map((raw, idx) => {
              const li = normaliseLineItem(raw);
              return (
                <View key={idx} style={s.tr}>
                  <Text style={[I_NAME, { fontSize: 9.5 }]}>{li.name}</Text>
                  <Text style={[s.num, I_QTY]}>{li.qty}</Text>
                  <Text style={[s.num, I_PRICE]}>{fmtRupiah(li.price)}</Text>
                  <Text style={[s.num, I_AMT]}>{fmtRupiah(li.amount)}</Text>
                </View>
              );
            })}
            {inv.discount ? (
              <View style={s.tr}>
                <Text style={[I_NAME, { fontSize: 9.5 }]}>Diskon</Text>
                <Text style={[s.num, I_QTY]} />
                <Text style={[s.num, I_PRICE]} />
                <Text style={[s.num, I_AMT]}>-{fmtRupiah(inv.discount)}</Text>
              </View>
            ) : null}
            <View style={s.trTotal}>
              <Text style={[I_NAME, s.bold, { fontSize: 10 }]}>TOTAL</Text>
              <Text style={[s.num, I_QTY]} />
              <Text style={[s.num, I_PRICE]} />
              <Text style={[s.num, I_AMT, s.bold, { fontSize: 9.5 }]}>
                {fmtRupiah(inv.total_amount)}
              </Text>
            </View>

            {status.paid ? (
              <View style={s.stamp}>
                <Text style={s.stampText}>
                  LUNAS{inv.paid_date ? ` — ${fmtPaidDate(inv.paid_date)}` : ''}
                </Text>
              </View>
            ) : (
              <Text style={s.unpaidNote}>BELUM BAYAR</Text>
            )}
          </View>
        ) : (
          <View style={s.sec}>
            <Text style={s.secTitle}>Invoice</Text>
            <Text style={{ fontSize: 9.5 }}>
              Invoice untuk kunjungan ini belum tersedia.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function RiwayatPDF({
  customers,
  visits,
  summary,
  mode,
}: {
  customers: HistoryCustomer[];
  visits: HistoryVisit[];
  summary: HistorySummary;
  mode: 'combined' | 'single';
}) {
  const name = displayName(customers);
  const alamat = [distinctJoin(customers, 'apartment'), distinctJoin(customers, 'unit')]
    .filter(Boolean)
    .join(' — ');
  const kontak = [distinctJoin(customers, 'email'), distinctJoin(customers, 'mobile')]
    .filter(Boolean)
    .join(' · ');

  const first = visits[visits.length - 1];
  const last = visits[0];
  const periodText =
    visits.length > 0
      ? `${fmtDateID(first?.service_date)} — ${fmtDateID(last?.service_date)}`
      : '—';

  return (
    <Document
      title={`Riwayat Servis AC — ${name}`}
      author="AEAC"
      language="id"
    >
      <Page size="A4" style={s.page}>
        {mode === 'combined' && (
          <>
            <View style={s.band}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image style={s.logo} src="/pdf/logo-aeac.png" />
              <View>
                <Text style={s.docTitle}>RIWAYAT SERVIS AC</Text>
                <Text style={s.docMeta}>Dibuat: {summary.generated_at}</Text>
              </View>
            </View>

            <View style={s.body}>
              <View style={s.custRow}>
                <View style={{ maxWidth: '58%' }}>
                  <Text style={s.eyebrow}>Customer</Text>
                  <Text style={s.custName}>{name.toUpperCase()}</Text>
                  {alamat ? <Text style={s.custLine}>{alamat}</Text> : null}
                  {kontak ? <Text style={s.custLine}>{kontak}</Text> : null}
                </View>
                <View style={s.right}>
                  <Text style={s.eyebrow}>Periode</Text>
                  <Text style={s.periodVal}>{periodText}</Text>
                  <Text style={[s.custLine, { marginTop: 5 }]}>
                    {summary.visit_count} kunjungan servis
                  </Text>
                </View>
              </View>

              <Text style={s.secTitle}>Ringkasan Kunjungan</Text>
              <View style={s.trHead}>
                <Text style={[s.th, C_DATE]}>Tanggal</Text>
                <Text style={[s.th, C_OID]}>Order ID</Text>
                <Text style={[s.th, C_SVC]}>Layanan</Text>
                <Text style={[s.th, C_TOT, { textAlign: 'right' }]}>Total</Text>
                <Text style={[s.th, C_STA]}>Status</Text>
              </View>
              {visits.map((v) => {
                const st = invoiceStatusLabel(v.invoice?.status);
                return (
                  <View key={v.order_id} style={s.tr}>
                    <Text style={[C_DATE, { fontSize: 9 }]}>
                      {fmtDateID(v.service_date)}
                    </Text>
                    <Text style={[s.mono, C_OID, { fontSize: 6.5, paddingRight: 6 }]}>
                      {v.order_id}
                    </Text>
                    <Text style={[C_SVC, { fontSize: 9 }]}>
                      {(v.services ?? []).map(cleanServiceLabel).join(', ') || '—'}
                    </Text>
                    <Text style={[s.num, C_TOT]}>
                      {v.invoice ? fmtRupiah(v.total_amount) : '—'}
                    </Text>
                    <Text
                      style={[
                        C_STA,
                        { fontSize: 8.5, fontWeight: 700 },
                        st.paid ? {} : s.alert,
                      ]}
                    >
                      {v.invoice ? st.label : '—'}
                    </Text>
                  </View>
                );
              })}
              <View style={s.trTotal}>
                <Text style={[C_DATE, s.bold, { fontSize: 10, width: '70%' }]}>
                  TOTAL PERIODE
                </Text>
                <Text style={[s.num, C_TOT, s.bold]}>
                  {fmtRupiah(summary.total_periode)}
                </Text>
                <Text style={[C_STA]} />
              </View>
              {summary.total_belum_dibayar > 0 && (
                <View style={[s.trTotal, { borderTopWidth: 0, paddingTop: 2 }]}>
                  <Text style={[s.bold, s.alert, { fontSize: 10, width: '70%' }]}>
                    TOTAL BELUM DIBAYAR ({summary.unpaid_count} kunjungan)
                  </Text>
                  <Text style={[s.num, C_TOT, s.bold, s.alert]}>
                    {fmtRupiah(summary.total_belum_dibayar)}
                  </Text>
                  <Text style={[C_STA]} />
                </View>
              )}
            </View>
          </>
        )}

        {visits.map((v, idx) => (
          <VisitSection
            key={v.order_id}
            visit={v}
            breakBefore={mode === 'combined' || idx > 0}
          />
        ))}

        <Footer />
      </Page>
    </Document>
  );
}
