'use client';
// app/b2b/penawaran/_components/penawaran-preview.tsx
// Live HTML preview of the one-page A4 PDF. Mirrors penawaran-pdf.tsx —
// keep the two in step when changing the layout. Rendered at 794px (A4 @96dpi)
// and scaled down to fit the column.

import { useEffect, useRef, useState } from 'react';
import {
  boldRuns, itemsTotal, lineTotal, listLines, longDate, paragraphs, rupiah, tableColumns, unitCount,
  type ProposalDraft,
} from '@/lib/b2b-penawaran';

const INK = '#0B0B0B';
const MUSTARD = '#E8CE55';
const TINT = '#FBF3CF';
const PAGE_W = 794;
const PAGE_H = 1123;

const FONT_CSS = `
@font-face{font-family:'ArchivoPv';src:url(/fonts/archivo-latin-400-normal.woff) format('woff');font-weight:400}
@font-face{font-family:'ArchivoPv';src:url(/fonts/archivo-latin-600-normal.woff) format('woff');font-weight:600}
@font-face{font-family:'ArchivoPv';src:url(/fonts/archivo-latin-700-normal.woff) format('woff');font-weight:700}
`;

function Rich({ text }: { text: string }) {
  return (
    <>
      {boldRuns(text).map((r, i) => (r.bold ? <strong key={i} style={{ fontWeight: 700 }}>{r.t}</strong> : <span key={i}>{r.t}</span>))}
    </>
  );
}

export default function PenawaranPreview({
  draft, businessName, address,
}: { draft: ProposalDraft; businessName: string; address: string | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.55);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / PAGE_W));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = itemsTotal(draft.items);
  const units = unitCount(draft.items);
  const meta = [address, draft.recipient ? `Kepada: ${draft.recipient}` : null, longDate(draft.proposal_date)]
    .filter(Boolean).join(' · ');

  return (
    <div ref={wrap} className="w-full overflow-hidden rounded-lg border border-neutral-300 bg-white shadow-sm"
      style={{ height: PAGE_H * scale }} aria-label="Pratinjau PDF">
      <style>{FONT_CSS}</style>
      <div style={{
        width: PAGE_W, minHeight: PAGE_H, transform: `scale(${scale})`, transformOrigin: 'top left',
        fontFamily: "'ArchivoPv', 'Helvetica Neue', Arial, sans-serif", color: INK, fontSize: 14, lineHeight: 1.5,
        display: 'flex', flexDirection: 'column', background: '#fff',
      }}>
        {/* Header */}
        <div style={{ padding: '30px 56px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontWeight: 700, fontSize: 26, letterSpacing: 1, lineHeight: 1 }}>AEAC</div>
          <div style={{ fontSize: 11, textAlign: 'right', lineHeight: 1.4 }}>
            Servis AC Profesional<br />Bagian dari PT. Maison Map Properti
          </div>
        </div>
        <div style={{ height: 3, background: MUSTARD, margin: '0 56px' }} />

        <div style={{ padding: '28px 56px 0', display: 'flex', flexDirection: 'column', gap: 14, flexGrow: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>{draft.title}</div>
            <div style={{ fontWeight: 600, fontSize: 26, lineHeight: 1.2 }}>{businessName}</div>
            {meta ? <div style={{ fontSize: 12 }}>{meta}</div> : null}
          </div>

          {draft.blocks.filter((bl) => bl.visible).map((bl) => {
            if (bl.kind === 'table') {
              if (!draft.items.length) return null;
              const col = tableColumns(bl);
              const span = 2 + (col.normal ? 1 : 0) + (col.price ? 1 : 0);
              return (
                <table key={bl.id} style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${INK}` }}>
                      <th style={{ textAlign: 'left', padding: '7px 8px', fontWeight: 600 }}>Jenis Unit</th>
                      <th style={{ textAlign: 'center', padding: '7px 8px', fontWeight: 600 }}>Jumlah</th>
                      {col.normal ? <th style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 600 }}>Harga Normal</th> : null}
                      {col.price ? <th style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 600 }}>{col.priceLabel}</th> : null}
                      <th style={{ textAlign: 'right', padding: '7px 8px', fontWeight: 600 }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.items.map((it, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${MUSTARD}` }}>
                        <td style={{ padding: '7px 8px' }}>{it.label || '—'}</td>
                        <td style={{ padding: '7px 8px', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{it.qty}</td>
                        {col.normal ? <td style={{ padding: '7px 8px', textAlign: 'right' }}>{it.normal_price}</td> : null}
                        {col.price ? <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{rupiah(it.price)}</td> : null}
                        <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{rupiah(lineTotal(it))}</td>
                      </tr>
                    ))}
                    <tr style={{ background: TINT }}>
                      <td colSpan={span} style={{ padding: '10px 8px', fontWeight: 700 }}>
                        Total per kunjungan{units ? ` (${units} unit)` : ''}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                        {rupiah(total)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              );
            }
            if (bl.kind === 'list') {
              const lines = listLines(bl.text);
              if (!lines.length) return null;
              return (
                <div key={bl.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {bl.title ? <div style={{ fontWeight: 700 }}>{bl.title}</div> : null}
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {lines.map((l, i) => <li key={i}><Rich text={l} /></li>)}
                  </ul>
                </div>
              );
            }
            if (bl.kind === 'callout') {
              if (!bl.text.trim() && !draft.valid_until) return null;
              return (
                <div key={bl.id} style={{
                  background: TINT, borderRadius: 6, padding: '12px 14px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
                }}>
                  <div style={{ fontWeight: 700 }}><Rich text={bl.text} /></div>
                  {draft.valid_until ? (
                    <div style={{ fontSize: 11, whiteSpace: 'nowrap' }}>Berlaku s/d {longDate(draft.valid_until)}</div>
                  ) : null}
                </div>
              );
            }
            return paragraphs(bl.text).map((para, i) => (
              <p key={`${bl.id}-${i}`} style={{ margin: 0, whiteSpace: 'pre-line' }}><Rich text={para} /></p>
            ));
          })}

          {!draft.blocks.some((bl) => bl.kind === 'callout' && bl.visible) && draft.valid_until ? (
            <div style={{ fontSize: 11 }}>Berlaku s/d {longDate(draft.valid_until)}</div>
          ) : null}
        </div>

        <div style={{
          margin: '20px 56px 0', padding: '14px 0 26px', borderTop: `1px solid ${INK}`,
          display: 'flex', justifyContent: 'space-between', fontSize: 11,
        }}>
          <div>{draft.sender_name ? <>Diajukan oleh <strong>{draft.sender_name}</strong> — AEAC</> : 'AEAC'}</div>
          <div>{[draft.sender_phone ? `WhatsApp ${draft.sender_phone}` : null, 'aeac-service.id'].filter(Boolean).join(' · ')}</div>
        </div>
      </div>
    </div>
  );
}
