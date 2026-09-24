// lib/b2b-penawaran.ts
// Penawaran (proposals) for the /b2b pilot — types, the three templates, and
// small helpers shared by the editor, the HTML preview and the PDF.
// Data: b2b_proposals via b2b_*_proposal RPCs (migration aeac_b2b_05_penawaran).
//
// Templates live HERE (not in the database) for v1: to change the default
// wording, edit TEMPLATES below. Every proposal stores its own edited copy,
// so changing a template never alters proposals already made.
//
// Text formatting inside blocks: **bold** only. In 'list' blocks each line
// is one bullet (a leading "- " is optional).

import { AC_LABEL, addDays, type Prospect } from '@/lib/b2b';

export type TemplateKey = 'perkenalan' | 'uji_coba' | 'harga';
export type BlockKind = 'text' | 'list' | 'table' | 'callout';

export type Block = {
  id: string;
  kind: BlockKind;
  /** Editor label; printed as a heading for 'list' blocks only. */
  title: string;
  text: string;
  visible: boolean;
  /** Table blocks only: print the "Harga Normal" column (default true). */
  show_normal?: boolean;
  /** Table blocks only: print the per-unit price column (default true). */
  show_price?: boolean;
};

export type Item = {
  label: string;
  qty: number;
  /** Free text, e.g. "Rp 90.000–120.000". */
  normal_price: string;
  /** Corporate price per unit, whole rupiah. */
  price: number;
};

export type ProposalDraft = {
  id: string | null;
  prospect_id: string;
  template: TemplateKey;
  title: string;
  recipient: string;
  proposal_date: string; // YYYY-MM-DD
  valid_until: string;   // YYYY-MM-DD or ''
  sender_name: string;
  sender_phone: string;
  blocks: Block[];
  items: Item[];
};

export type ProposalRecord = ProposalDraft & {
  id: string;
  total: number;
  status: 'draft' | 'sent';
  sent_at: string | null;
  created_by_name: string | null;
  updated_by_name: string | null;
  updated_at: string;
};

export type ProposalProspect = {
  id: string;
  business_name: string;
  address: string | null;
  pic_name: string | null;
  pic_phone: string | null;
  status: string;
  area_name: string;
  is_archived: boolean;
};

export type ProposalRow = {
  id: string;
  prospect_id: string;
  business_name: string;
  template: TemplateKey;
  proposal_date: string;
  valid_until: string | null;
  total: number;
  status: 'draft' | 'sent';
  sent_at: string | null;
  updated_at: string;
  updated_by_name: string | null;
};

export const TEMPLATE_INFO: { key: TemplateKey; label: string; hint: string }[] = [
  { key: 'perkenalan', label: 'Perkenalan', hint: 'Belum kenal · tanpa harga · ajak uji coba' },
  { key: 'uji_coba', label: 'Setelah Uji Coba', hint: 'Temuan teknisi + harga + total' },
  { key: 'harga', label: 'Harga Saja', hint: 'Sudah yakin · tabel + ketentuan' },
];
export const TEMPLATE_LABEL: Record<TemplateKey, string> = {
  perkenalan: 'Perkenalan', uji_coba: 'Setelah Uji Coba', harga: 'Harga Saja',
};

/** AEAC's WhatsApp line printed in the footer by default (editable per proposal). */
export const AEAC_WA = '0815-3280-1400';
export const DEFAULT_VALID_DAYS = 30;

// ── Shared wording (identical across templates on purpose) ─────────────────

const KETENTUAN = [
  'Harga korporat juga berlaku untuk cuci satuan di luar jadwal rutin. Perbaikan, isi freon, dan bongkar-pasang mengikuti harga normal dan ditawarkan terlebih dahulu sebelum dikerjakan.',
  'Masa kontrak minimal 6 bulan, dengan harga tetap selama masa kontrak.',
  'Pembayaran paling lambat 7 hari setelah invoice diterbitkan.',
].join('\n');

const LAPORAN =
  '**Setiap kunjungan disertai laporan tertulis dan foto sebelum & sesudah untuk setiap unit**, yang dapat digunakan sebagai arsip perawatan.';

const b = (id: string, kind: BlockKind, title: string, text: string, visible = true): Block =>
  ({ id, kind, title, text, visible });

/** Default blocks per template. Square-bracket text like [tanggal] = must be filled in. */
export function templateBlocks(t: TemplateKey): Block[] {
  switch (t) {
    case 'perkenalan':
      return [
        b('pembuka', 'text', 'Pembuka',
          'Perkenalkan, kami AEAC — layanan cuci dan perawatan AC profesional di Jakarta Selatan dan Jakarta Pusat, bagian dari PT. Maison Map Properti.'),
        b('usulan', 'text', 'Usulan',
          'Kami tidak bermaksud menggantikan vendor yang sudah ada. Silakan **coba dulu 1–2 unit** dengan harga normal, lalu nilai sendiri hasil dan laporannya.'),
        b('keunggulan', 'list', 'Mengapa AEAC',
          'Lokasi kami dekat, sehingga jadwal mudah disesuaikan.\nSetiap unit mendapat laporan dengan foto sebelum & sesudah.'),
        b('tabel', 'table', 'Tabel harga', '', false),
        b('cta', 'callout', 'Langkah berikutnya',
          'Untuk mencoba, cukup balas WhatsApp ini dan kami jadwalkan kunjungan.'),
      ];
    case 'uji_coba':
      return [
        b('pembuka', 'text', 'Pembuka',
          'Terima kasih telah mempercayakan pengerjaan AC kepada kami pada [tanggal uji coba]. Laporan teknisi beserta foto sebelum & sesudah telah kami kirimkan.'),
        b('temuan', 'text', 'Temuan dari uji coba',
          'Pada unit yang kami kerjakan, [temuan teknisi]. Kondisi seperti ini dapat dicegah dengan cuci rutin setiap [3] bulan, sesuai rekomendasi teknisi kami.'),
        b('tabel', 'table', 'Tabel harga', ''),
        b('jadwal', 'text', 'Jadwal',
          '**Jadwal: setiap [3] bulan**, seluruh unit. Pengerjaan dapat dibagi beberapa hari atau disesuaikan dengan jam operasional.'),
        b('laporan', 'text', 'Laporan & arsip', LAPORAN),
        b('ketentuan', 'list', 'Ketentuan', KETENTUAN),
        b('cta', 'callout', 'Langkah berikutnya',
          'Untuk memulai, cukup balas WhatsApp ini dan kami jadwalkan kunjungan pertama.'),
      ];
    case 'harga':
      return [
        b('pembuka', 'text', 'Pembuka',
          'Berikut penawaran perawatan rutin untuk seluruh unit AC Anda.'),
        b('tabel', 'table', 'Tabel harga', ''),
        b('jadwal', 'text', 'Jadwal', '**Jadwal: setiap [3] bulan**, seluruh unit.'),
        b('ketentuan', 'list', 'Ketentuan', KETENTUAN),
        b('cta', 'callout', 'Langkah berikutnya',
          'Untuk memulai, cukup balas WhatsApp ini dan kami jadwalkan kunjungan pertama.'),
      ];
  }
}

/** One price row per AC type counted in Peluang AC (prices left for staff to fill). */
export function itemsFromProspect(p: Pick<Prospect, 'ac_types' | 'ac_units'>): Item[] {
  const types = p.ac_types?.length ? p.ac_types : Object.keys(p.ac_units ?? {});
  return types.map((t) => ({
    label: `AC ${AC_LABEL[t] ?? t}`,
    qty: Number(p.ac_units?.[t] ?? 0) || 0,
    normal_price: '',
    price: 0,
  }));
}

export function newDraft(opts: {
  prospect: Pick<Prospect, 'id' | 'pic_name' | 'ac_types' | 'ac_units'>;
  template: TemplateKey;
  senderName: string;
  today: string;
}): ProposalDraft {
  return {
    id: null,
    prospect_id: opts.prospect.id,
    template: opts.template,
    title: 'Penawaran Perawatan AC',
    recipient: opts.prospect.pic_name ?? '',
    proposal_date: opts.today,
    valid_until: addDays(opts.today, DEFAULT_VALID_DAYS),
    sender_name: opts.senderName,
    sender_phone: AEAC_WA,
    blocks: templateBlocks(opts.template),
    items: itemsFromProspect(opts.prospect),
  };
}

// ── Numbers & text ─────────────────────────────────────────────────────────

export function lineTotal(it: Item): number {
  return (Number(it.qty) || 0) * (Number(it.price) || 0);
}
export function itemsTotal(items: Item[]): number {
  return items.reduce((s, it) => s + lineTotal(it), 0);
}
export function unitCount(items: Item[]): number {
  return items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
}

/** 2220000 → "Rp 2.220.000" */
export function rupiah(n: number): string {
  return 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
}

/** "90.000" / "Rp 90,000" / "90000" → 90000 */
export function parseRupiah(v: string): number {
  const d = v.replace(/\D/g, '');
  return d ? Number(d) : 0;
}

/** "2026-09-23" → "23 September 2026" */
export function longDate(ymd: string | null | undefined): string {
  if (!ymd) return '';
  return new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${ymd.slice(0, 10)}T00:00:00Z`));
}

/** Split "**bold** rest" into runs for the preview and the PDF. */
export function boldRuns(text: string): { t: string; bold: boolean }[] {
  const out: { t: string; bold: boolean }[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index), bold: false });
    out.push({ t: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), bold: false });
  return out;
}

/** Lines of a 'list' block, leading "- " / "• " removed, blanks dropped. */
export function listLines(text: string): string[] {
  return text.split('\n').map((l) => l.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean);
}

/** Paragraphs of a 'text' / 'callout' block (blank line = new paragraph). */
export function paragraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
}

/** Unfilled "[...]" placeholders still in visible blocks (warn before PDF). */
export function unfilledPlaceholders(d: Pick<ProposalDraft, 'blocks'>): string[] {
  const found = new Set<string>();
  for (const bl of d.blocks) {
    if (!bl.visible) continue;
    for (const m of bl.text.matchAll(/\[[^\]\n]{1,60}\]/g)) found.add(m[0]);
  }
  return [...found];
}

/** Which price columns a table block prints; old proposals default to both. */
export function tableColumns(bl: Pick<Block, 'show_normal' | 'show_price'>) {
  const price = bl.show_price !== false;
  const normal = bl.show_normal !== false;
  return {
    normal,
    price,
    /** Without the normal price there is nothing to compare against. */
    priceLabel: normal ? 'Harga Korporat' : 'Harga per Unit',
  };
}

export function hasVisibleTable(d: Pick<ProposalDraft, 'blocks'>): boolean {
  return d.blocks.some((bl) => bl.kind === 'table' && bl.visible);
}

/** Short WhatsApp message staff can copy (the PDF is attached manually). */
export function waMessage(d: ProposalDraft, sender: string): string {
  const who = d.recipient.trim() || 'Bapak/Ibu';
  const total = itemsTotal(d.items);
  const units = unitCount(d.items);
  const lines = [
    `Selamat siang ${who}, ini ${sender || 'kami'} dari AEAC. Terima kasih atas waktunya.`,
    hasVisibleTable(d) && total > 0
      ? `Terlampir penawaran perawatan AC${units ? ` untuk ${units} unit` : ''}: ${rupiah(total)} per kunjungan.`
      : 'Terlampir penawaran dari kami.',
    'Kalau ada pertanyaan atau ingin langsung dijadwalkan, silakan balas pesan ini.',
  ];
  return lines.join('\n');
}

export function pdfFilename(businessName: string, ymd: string): string {
  const slug = businessName.normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  return `AEAC-Penawaran-${slug || 'klien'}-${ymd.replace(/-/g, '')}.pdf`;
}

let _n = 0;
export function newBlockId(): string {
  _n += 1;
  return `c${Date.now().toString(36)}${_n}`;
}
