// app/b2b/penawaran/_components/penawaran-pdf.tsx
// @react-pdf/renderer document for a Penawaran — one soft, print-friendly A4
// page: white header with a thin mustard rule, Archivo only (no Anton),
// pale-mustard total row and closing box. Mirrors penawaran-preview.tsx.
//
// ONLY loaded via dynamic import from the editor (see penawaran-editor.tsx),
// so react-pdf never enters the server bundle.

import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { registerPdfFonts } from '@/app/riwayat-customer/pdf-fonts';
import {
  boldRuns, itemsTotal, lineTotal, listLines, longDate, paragraphs, rupiah, tableColumns, unitCount,
  type ProposalDraft,
} from '@/lib/b2b-penawaran';

registerPdfFonts();

const INK = '#0B0B0B';
const MUSTARD = '#E8CE55';
const TINT = '#FBF3CF';

const s = StyleSheet.create({
  page: { fontFamily: 'Archivo', fontSize: 10.5, color: INK, paddingTop: 26, paddingBottom: 70, lineHeight: 1.45 },
  header: { paddingHorizontal: 42, paddingBottom: 9, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  brand: { fontWeight: 700, fontSize: 19, letterSpacing: 0.8 },
  tagline: { fontSize: 8, textAlign: 'right', lineHeight: 1.35 },
  rule: { height: 2.2, backgroundColor: MUSTARD, marginHorizontal: 42 },
  body: { paddingHorizontal: 42, paddingTop: 20 },
  eyebrow: { fontSize: 8, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
  client: { fontWeight: 600, fontSize: 19, lineHeight: 1.2 },
  meta: { fontSize: 9, marginTop: 3 },
  gap: { marginTop: 10 },
  para: {},
  bold: { fontWeight: 700 },
  // table
  tHead: { flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: INK, paddingVertical: 5 },
  tRow: { flexDirection: 'row', borderBottomWidth: 0.8, borderBottomColor: MUSTARD, paddingVertical: 5 },
  tTotal: { flexDirection: 'row', alignItems: 'center', backgroundColor: TINT, paddingVertical: 7 },
  th: { fontWeight: 600, fontSize: 9.5, paddingHorizontal: 5 },
  td: { fontSize: 9.5, paddingHorizontal: 5 },
  cLabel: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
  cQty: { width: '11%', textAlign: 'center' },
  cNormal: { width: '20%', textAlign: 'right' },
  cPrice: { width: '19%', textAlign: 'right' },
  cSub: { width: '19%', textAlign: 'right' },
  // list
  listTitle: { fontWeight: 700, marginBottom: 2 },
  li: { flexDirection: 'row', fontSize: 9.8, marginBottom: 1.5 },
  bullet: { width: 11 },
  liText: { flex: 1 },
  // callout
  callout: {
    backgroundColor: TINT, borderRadius: 4, paddingVertical: 9, paddingHorizontal: 11,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  calloutText: { fontWeight: 700, flex: 1, paddingRight: 10 },
  valid: { fontSize: 8 },
  footer: {
    position: 'absolute', left: 42, right: 42, bottom: 26, borderTopWidth: 0.8, borderTopColor: INK,
    paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between', fontSize: 8,
  },
});

function Rich({ text, style }: { text: string; style?: Style }) {
  return (
    <Text style={style}>
      {boldRuns(text).map((r, i) => (
        <Text key={i} style={r.bold ? s.bold : undefined}>{r.t}</Text>
      ))}
    </Text>
  );
}

export function PenawaranPDF({
  draft, businessName, address,
}: { draft: ProposalDraft; businessName: string; address: string | null }) {
  const total = itemsTotal(draft.items);
  const units = unitCount(draft.items);
  const meta = [address, draft.recipient ? `Kepada: ${draft.recipient}` : null, longDate(draft.proposal_date)]
    .filter(Boolean).join(' · ');
  const hasCallout = draft.blocks.some((bl) => bl.kind === 'callout' && bl.visible);

  return (
    <Document title={`${draft.title} — ${businessName}`} author="AEAC" language="id">
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <Text style={s.brand}>AEAC</Text>
          <Text style={s.tagline}>{'Servis AC Profesional\nBagian dari PT. Maison Map Properti'}</Text>
        </View>
        <View style={s.rule} />

        <View style={s.body}>
          <Text style={s.eyebrow}>{draft.title}</Text>
          <Text style={s.client}>{businessName}</Text>
          {meta ? <Text style={s.meta}>{meta}</Text> : null}

          {draft.blocks.filter((bl) => bl.visible).map((bl) => {
            if (bl.kind === 'table') {
              if (!draft.items.length) return null;
              const col = tableColumns(bl);
              return (
                <View key={bl.id} style={s.gap} wrap={false}>
                  <View style={s.tHead}>
                    <Text style={[s.th, s.cLabel]}>Jenis Unit</Text>
                    <Text style={[s.th, s.cQty]}>Jumlah</Text>
                    {col.normal ? <Text style={[s.th, s.cNormal]}>Harga Normal</Text> : null}
                    {col.price ? <Text style={[s.th, s.cPrice]}>{col.priceLabel}</Text> : null}
                    <Text style={[s.th, s.cSub]}>Subtotal</Text>
                  </View>
                  {draft.items.map((it, i) => (
                    <View key={i} style={s.tRow}>
                      <Text style={[s.td, s.cLabel]}>{it.label || '—'}</Text>
                      <Text style={[s.td, s.cQty]}>{String(it.qty)}</Text>
                      {col.normal ? <Text style={[s.td, s.cNormal]}>{it.normal_price}</Text> : null}
                      {col.price ? <Text style={[s.td, s.cPrice, s.bold]}>{rupiah(it.price)}</Text> : null}
                      <Text style={[s.td, s.cSub, s.bold]}>{rupiah(lineTotal(it))}</Text>
                    </View>
                  ))}
                  <View style={s.tTotal}>
                    <Text style={[s.td, s.bold, s.cLabel]}>
                      {`Total per kunjungan${units ? ` (${units} unit)` : ''}`}
                    </Text>
                    <Text style={[s.td, s.cSub, s.bold, { fontSize: 11.5 }]}>{rupiah(total)}</Text>
                  </View>
                </View>
              );
            }
            if (bl.kind === 'list') {
              const lines = listLines(bl.text);
              if (!lines.length) return null;
              return (
                <View key={bl.id} style={s.gap} wrap={false}>
                  {bl.title ? <Text style={s.listTitle}>{bl.title}</Text> : null}
                  {lines.map((l, i) => (
                    <View key={i} style={s.li}>
                      <Text style={s.bullet}>•</Text>
                      <Rich text={l} style={s.liText} />
                    </View>
                  ))}
                </View>
              );
            }
            if (bl.kind === 'callout') {
              if (!bl.text.trim() && !draft.valid_until) return null;
              return (
                <View key={bl.id} style={[s.gap, s.callout]} wrap={false}>
                  <Rich text={bl.text} style={s.calloutText} />
                  {draft.valid_until ? <Text style={s.valid}>{`Berlaku s/d ${longDate(draft.valid_until)}`}</Text> : null}
                </View>
              );
            }
            return paragraphs(bl.text).map((para, i) => (
              <View key={`${bl.id}-${i}`} style={s.gap}>
                <Rich text={para} style={s.para} />
              </View>
            ));
          })}

          {!hasCallout && draft.valid_until ? (
            <Text style={[s.gap, s.valid]}>{`Berlaku s/d ${longDate(draft.valid_until)}`}</Text>
          ) : null}
        </View>

        <View style={s.footer} fixed>
          <Text>
            {draft.sender_name ? 'Diajukan oleh ' : 'AEAC'}
            {draft.sender_name ? <Text style={s.bold}>{draft.sender_name}</Text> : null}
            {draft.sender_name ? ' — AEAC' : ''}
          </Text>
          <Text>{[draft.sender_phone ? `WhatsApp ${draft.sender_phone}` : null, 'aeac-service.id'].filter(Boolean).join(' · ')}</Text>
        </View>
      </Page>
    </Document>
  );
}
